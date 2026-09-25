#!/usr/bin/env node
/**
 * Migrate `matchattempts` from a flat 90-day TTL on `createdAt` to a tiered,
 * per-row TTL on `expiresAt`, and keep the backstop index sized to the
 * retention ceiling.
 *
 * Re-run it whenever BACKSTOP_RETENTION_DAYS changes in MatchAttempt.ts. The
 * admin panel restamps rows itself when the window is changed there, so a
 * run is not needed for day-to-day changes — only for index changes.
 *
 * Two things Mongo will not do on its own, hence this script:
 *   1. `createIndex` refuses to change `expireAfterSeconds` on an existing
 *      index — it raises IndexOptionsConflict. The old `createdAt_1` TTL has
 *      to be dropped before the new one can be built.
 *   2. Rows written before this change have no `expiresAt`. A missing field is
 *      invisible to a TTL index, so without a backfill every existing document
 *      would live forever once the old index is gone. The same applies to rows
 *      an older build writes while the new one is still rolling out, which is
 *      why the backstop index below is created rather than relying on deploy
 *      order.
 *
 * Safe to re-run: each step checks the current state first.
 *
 * Usage:  node scripts/migrate-matchattempt-ttl.js [--dry-run]
 */

const path = require('path');
const fs = require('fs');
const { MongoClient } = require('mongodb');

// Mirrors src/lib/models/MatchAttempt.ts. The window resolves the same way
// the API resolves it at write time — admin panel first, then the env var,
// then the code default — so a deployment that moved the window gets its
// existing rows restamped to match instead of keeping whatever the previous
// run wrote.
const DEFAULT_RETENTION_DAYS = 7;

// Must match MATCH_ATTEMPT_MAX_RETENTION_DAYS in src/lib/models/SystemSettings.ts.
const MAX_RETENTION_DAYS = 30;
const capDays = (d) => Math.min(d, MAX_RETENTION_DAYS);

function resolveRetention(raw) {
  if (!raw || !raw.trim()) return { default: DEFAULT_RETENTION_DAYS };

  const flat = Number(raw.trim());
  if (Number.isFinite(flat) && flat > 0) return { default: capDays(flat) };

  const parsed = { default: DEFAULT_RETENTION_DAYS };
  for (const pair of raw.split(',')) {
    const [key, value] = pair.split(':').map((p) => p.trim());
    const days = Number(value);
    if (key && Number.isFinite(days) && days > 0) parsed[key] = capDays(days);
  }
  return parsed;
}

// Filled in main() once the admin document has been read; the env var is
// only the fallback.
let RETENTION_DAYS = resolveRetention(process.env.MATCH_ATTEMPT_RETENTION_DAYS);

const DAY_MS = 24 * 60 * 60 * 1000;
const DRY_RUN = process.argv.includes('--dry-run');
const OLD_TTL_INDEX = 'createdAt_1';
const NEW_TTL_INDEX = 'match_attempt_ttl';
const BACKSTOP_INDEX = 'match_attempt_ttl_backstop';

// Must match BACKSTOP_RETENTION_DAYS in src/lib/models/MatchAttempt.ts. Sized
// against the ceiling, not the current window, so the admin can move the
// window without another index rebuild.
const BACKSTOP_DAYS = MAX_RETENTION_DAYS + 1;

function loadUri() {
  if (process.env.MONGODB_URI) return process.env.MONGODB_URI;
  for (const f of ['.env.local', '.env']) {
    const p = path.join(__dirname, '..', f);
    if (!fs.existsSync(p)) continue;
    const line = fs
      .readFileSync(p, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('MONGODB_URI='));
    if (line) return line.slice('MONGODB_URI='.length).trim().replace(/^["']|["']$/g, '');
  }
  throw new Error('MONGODB_URI not set and not found in .env.local / .env');
}

async function main() {
  const client = new MongoClient(loadUri());
  await client.connect();
  const col = client.db().collection('matchattempts');

  const log = (...a) => console.log(DRY_RUN ? '[dry-run]' : '        ', ...a);
  console.log(`\nmatchattempts TTL migration${DRY_RUN ? ' (DRY RUN — no writes)' : ''}\n`);

  const before = await col.estimatedDocumentCount();
  console.log(`  documents: ${before}`);

  // ── 0. Which window is in force ─────────────────────────────────────────
  // The admin panel's value overrides the environment outright, flat across
  // every reason, exactly as recordMatchAttempt() applies it.
  const settings = await client.db().collection('systemsettings').findOne({ _id: 'global' });
  const adminDays = Number(settings?.matchAttempts?.retentionDays);
  if (Number.isFinite(adminDays) && adminDays > 0) {
    RETENTION_DAYS = { default: capDays(Math.round(adminDays)) };
    console.log(`  window: ${RETENTION_DAYS.default}d (admin panel)`);
  } else {
    console.log(
      `  window: ${JSON.stringify(RETENTION_DAYS)} (${
        process.env.MATCH_ATTEMPT_RETENTION_DAYS ? 'MATCH_ATTEMPT_RETENTION_DAYS' : 'code default'
      })`
    );
  }

  // ── 1. Stamp expiresAt on every row ─────────────────────────────────────
  // Restamps unconditionally rather than only filling gaps: a row written
  // under an earlier, longer policy already has an expiresAt, and leaving it
  // alone would let it outlive the current window. expiresAt is always
  // computed from createdAt, so a row that is already past due lands in the
  // past and is reaped on the next sweep instead of getting a fresh lease.
  //
  // Done BEFORE the index swap so rows are never governed by neither TTL.
  const missing = await col.countDocuments({ expiresAt: { $exists: false } });
  console.log(`  missing expiresAt: ${missing}`);

  const reasons = await col.distinct('reason');
  let restamped = 0;

  for (const reason of reasons) {
    const days = RETENTION_DAYS[reason] ?? RETENTION_DAYS.default;
    const target = { $add: [{ $ifNull: ['$createdAt', new Date()] }, days * DAY_MS] };

    // Only rows whose stamp disagrees with the current policy.
    const filter = { reason, $expr: { $ne: ['$expiresAt', target] } };
    const n = await col.countDocuments(filter);
    if (n === 0) {
      console.log(`  ${String(reason).padEnd(18)} +${days}d  (already correct)`);
      continue;
    }

    log(`  stamp ${String(reason).padEnd(18)} +${days}d from createdAt  (${n} rows)`);
    if (!DRY_RUN) {
      const res = await col.updateMany(filter, [{ $set: { expiresAt: target } }]);
      restamped += res.modifiedCount;
    }
  }
  if (!DRY_RUN && restamped) console.log(`  stamped: ${restamped}`);

  // ── 2. Swap the index ───────────────────────────────────────────────────
  const indexes = await col.indexes();
  const oldTtl = indexes.find(
    (i) => i.name === OLD_TTL_INDEX && i.expireAfterSeconds !== undefined
  );
  const newTtl = indexes.find((i) => i.name === NEW_TTL_INDEX);

  if (newTtl) {
    console.log(`  ${NEW_TTL_INDEX}: already present`);
  } else {
    log(`  create ${NEW_TTL_INDEX} { expiresAt: 1 } expireAfterSeconds: 0`);
    if (!DRY_RUN) {
      await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: NEW_TTL_INDEX });
    }
  }

  if (oldTtl) {
    log(`  drop ${OLD_TTL_INDEX} (flat TTL ${oldTtl.expireAfterSeconds}s)`);
    if (!DRY_RUN) await col.dropIndex(OLD_TTL_INDEX);
  } else {
    console.log(`  ${OLD_TTL_INDEX}: no flat TTL to drop`);
  }

  // ── 2b. Backstop TTL, for rows with no expiresAt at all ─────────────────
  // Same key pattern as the index just dropped, but a different name and a
  // window deliberately longer than any real retention, so it only ever
  // catches rows the primary TTL cannot see.
  const wantBackstopSecs = BACKSTOP_DAYS * 24 * 60 * 60;
  const backstop = (await col.indexes()).find((i) => i.name === BACKSTOP_INDEX);

  if (backstop && backstop.expireAfterSeconds !== wantBackstopSecs) {
    // Mongo cannot edit expireAfterSeconds in place; recreate it.
    log(
      `  recreate ${BACKSTOP_INDEX} (${backstop.expireAfterSeconds}s -> ${wantBackstopSecs}s)`
    );
    if (!DRY_RUN) {
      await col.dropIndex(BACKSTOP_INDEX);
      await col.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: wantBackstopSecs, name: BACKSTOP_INDEX }
      );
    }
  } else if (backstop) {
    console.log(`  ${BACKSTOP_INDEX}: already present (${BACKSTOP_DAYS}d)`);
  } else {
    log(`  create ${BACKSTOP_INDEX} { createdAt: 1 } ${BACKSTOP_DAYS}d`);
    if (!DRY_RUN) {
      await col.createIndex(
        { createdAt: 1 },
        { expireAfterSeconds: wantBackstopSecs, name: BACKSTOP_INDEX }
      );
    }
  }

  // ── 3. What the next TTL sweep will remove ──────────────────────────────
  const branches = Object.entries(RETENTION_DAYS)
    .filter(([k]) => k !== 'default')
    .map(([k, v]) => ({ case: { $eq: ['$reason', k] }, then: v }));

  // $switch rejects an empty branch list, which is the normal case for a flat
  // policy — fall back to the plain default then.
  const daysExpr = branches.length
    ? { $switch: { branches, default: RETENTION_DAYS.default } }
    : RETENTION_DAYS.default;

  const due = DRY_RUN
    ? await col.countDocuments({
        $expr: {
          $lt: [
            { $add: ['$createdAt', { $multiply: [DAY_MS, daysExpr] }] },
            new Date(),
          ],
        },
      })
    : await col.countDocuments({ expiresAt: { $lt: new Date() } });

  console.log(`\n  already past retention (reaped within ~60s): ${due}`);
  console.log(`  remaining after sweep: ${before - due}\n`);

  await client.close();
}

main().catch((e) => {
  console.error('migration failed:', e.message);
  process.exit(1);
});

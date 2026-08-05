'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { smartLinkApi, EventDefinitionDto } from '@/lib/api';

const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)' };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--color-text-tertiary)', marginBottom: 16 }}>
      {'// '}
      {children}
    </div>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: 'var(--color-bg-card)', border: '1px solid var(--color-border)', padding: 24, ...style }}>
      {children}
    </div>
  );
}

const th: React.CSSProperties = {
  ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
  color: 'var(--color-text-tertiary)', padding: '8px 12px', fontWeight: 600, textAlign: 'left',
};

const td: React.CSSProperties = { ...mono, fontSize: 12, padding: '10px 12px', color: 'var(--color-text)' };

const inputStyle: React.CSSProperties = {
  ...mono, fontSize: 12, padding: '6px 10px', background: 'var(--color-bg)',
  border: '1px solid var(--color-border)', color: 'var(--color-text)', width: '100%',
};

/**
 * The tenant's event vocabulary.
 *
 * Names auto-register the first time they arrive, so this page is about
 * curation rather than creation: giving a raw `ticket_purchase` a readable
 * label, filing it under a category, and deciding whether it counts as a
 * conversion.
 */
export default function EventDefinitionsPage() {
  const [definitions, setDefinitions] = useState<EventDefinitionDto[]>([]);
  const [limit, setLimit] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState<string | null>(null);

  // Local edits, keyed by event name, so typing doesn't fire a request per keystroke.
  const [drafts, setDrafts] = useState<Record<string, { label: string; category: string }>>({});

  const fetchDefinitions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await smartLinkApi.listEventDefinitions();
      setDefinitions(result.definitions || []);
      setLimit(result.limit || 200);
      setDrafts({});
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load definitions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDefinitions(); }, [fetchDefinitions]);

  const save = async (
    name: string,
    patch: Partial<Pick<EventDefinitionDto, 'label' | 'category' | 'isConversion' | 'expectsValue' | 'status'>>
  ) => {
    setSavingName(name);
    setError(null);
    try {
      const { definition } = await smartLinkApi.updateEventDefinition({ name, ...patch });
      // Replace in place rather than refetching — the list can be long and the
      // row the user is looking at should not jump.
      setDefinitions((prev) => prev.map((d) => (d.name === name ? { ...d, ...definition } : d)));
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingName(null);
    }
  };

  const draftFor = (d: EventDefinitionDto) =>
    drafts[d.name] || { label: d.label, category: d.category || '' };

  const isDirty = (d: EventDefinitionDto) => {
    const draft = drafts[d.name];
    if (!draft) return false;
    return draft.label !== d.label || draft.category !== (d.category || '');
  };

  const budgetUsed = limit > 0 ? Math.round((definitions.length / limit) * 100) : 0;
  const conversionCount = definitions.filter((d) => d.isConversion).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: 32 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Link href="/dashboard/events" style={{ ...mono, fontSize: 11, color: 'var(--color-text-tertiary)', textDecoration: 'none' }}>
              ← events
            </Link>
            <h1 style={{ ...mono, fontSize: 24, fontWeight: 700, color: 'var(--color-text)', margin: '8px 0 4px' }}>event definitions</h1>
            <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)' }}>
              your vocabulary — names register themselves, you give them meaning
            </p>
          </div>
          <div style={{ ...mono, fontSize: 11, color: budgetUsed > 80 ? 'var(--color-warning)' : 'var(--color-text-tertiary)' }}>
            {definitions.length} / {limit} names · {conversionCount} marked as conversions
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--color-warning)', padding: '12px 16px', marginBottom: 24, ...mono, fontSize: 12, color: 'var(--color-warning)' }}>
            {error}
          </div>
        )}

        <Card style={{ marginBottom: 24 }}>
          <SectionLabel>how conversions work</SectionLabel>
          <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7, maxWidth: '70ch' }}>
            A conversion is a <strong style={{ color: 'var(--color-text)' }}>label</strong> over your events, not a separate
            counter. Flipping the toggle reclassifies history immediately — every report that asks for conversions picks
            up the change, and nothing is double-counted because one row still means one thing.
          </p>
          <p style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', lineHeight: 1.7, marginTop: 12, maxWidth: '70ch' }}>
            Event names themselves are not editable. The name is the join key on every row ever recorded, so renaming one
            would either orphan its history or require rewriting the collection.
          </p>
        </Card>

        <Card>
          <SectionLabel>definitions</SectionLabel>

          {loading ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', padding: '32px 0', textAlign: 'center' }}>
              loading…
            </div>
          ) : definitions.length === 0 ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--color-text-tertiary)', padding: '32px 0', textAlign: 'center', lineHeight: 1.8 }}>
              no events tracked yet.<br />
              names appear here automatically the first time your app sends them.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ ...th, width: 200 }}>name</th>
                    <th style={{ ...th, width: 200 }}>label</th>
                    <th style={{ ...th, width: 150 }}>category</th>
                    <th style={{ ...th, textAlign: 'center', width: 110 }}>conversion</th>
                    <th style={{ ...th, textAlign: 'right', width: 90 }}>count</th>
                    <th style={{ ...th, textAlign: 'right', width: 110 }}>last seen</th>
                    <th style={{ ...th, width: 90 }} />
                  </tr>
                </thead>
                <tbody>
                  {definitions.map((d) => {
                    const draft = draftFor(d);
                    const dirty = isDirty(d);
                    const saving = savingName === d.name;

                    return (
                      <tr key={d.name} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: 'var(--color-primary)' }}>{d.name}</span>
                            {d.isSystem && (
                              <span
                                title="Emitted automatically by the SDK"
                                style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '2px 5px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-tertiary)' }}
                              >
                                sdk
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={td}>
                          <input
                            style={inputStyle}
                            value={draft.label}
                            disabled={saving}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [d.name]: { ...draft, label: e.target.value } }))
                            }
                          />
                        </td>
                        <td style={td}>
                          <input
                            style={inputStyle}
                            value={draft.category}
                            placeholder="uncategorized"
                            disabled={saving}
                            onChange={(e) =>
                              setDrafts((prev) => ({ ...prev, [d.name]: { ...draft, category: e.target.value } }))
                            }
                          />
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button
                            onClick={() => save(d.name, { isConversion: !d.isConversion })}
                            disabled={saving}
                            aria-pressed={d.isConversion}
                            style={{
                              ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                              padding: '4px 10px', cursor: saving ? 'wait' : 'pointer',
                              border: `1px solid ${d.isConversion ? '#10b981' : 'var(--color-border)'}`,
                              background: d.isConversion ? 'rgba(16,185,129,0.12)' : 'transparent',
                              color: d.isConversion ? '#10b981' : 'var(--color-text-tertiary)',
                            }}
                          >
                            {d.isConversion ? 'yes' : 'no'}
                          </button>
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{d.eventCount.toLocaleString()}</td>
                        <td style={{ ...td, textAlign: 'right', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                          {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleDateString() : '—'}
                        </td>
                        <td style={td}>
                          {dirty && (
                            <button
                              onClick={() => save(d.name, { label: draft.label, category: draft.category || undefined })}
                              disabled={saving}
                              style={{
                                ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em',
                                padding: '5px 12px', cursor: saving ? 'wait' : 'pointer', border: 'none',
                                background: 'var(--color-primary)', color: 'var(--color-bg)',
                              }}
                            >
                              {saving ? '…' : 'save'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

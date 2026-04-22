# AE-LINK Deployment Guide

Complete instructions for deploying AE-LINK to Vercel with MongoDB Atlas.

## Prerequisites

- Node.js 18+
- Vercel account
- MongoDB Atlas account
- Git repository

## Step 1: MongoDB Atlas Setup

1. Create a MongoDB Atlas cluster:
   - Go to https://www.mongodb.com/cloud/atlas
   - Create a new project
   - Create a M0 free cluster (or higher for production)
   - Create a database user with strong password
   - Whitelist Vercel IP range: `0.0.0.0/0` (for production, use specific IPs)

2. Get connection string:
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy connection string (save for next step)

## Step 2: Vercel Deployment

### Option A: Using Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Set up project
vercel link

# Set environment variables
vercel env add MONGODB_URI
# Paste your MongoDB connection string

vercel env add NODE_ENV
# Set to "production"

# Deploy
vercel deploy --prod
```

### Option B: Using GitHub Integration

1. Push code to GitHub
2. Go to https://vercel.com/new
3. Import your repository
4. Set environment variables in Vercel dashboard
5. Deploy

## Step 3: Configure Environment Variables

In Vercel dashboard, add the following environment variables:

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/ae-link?retryWrites=true&w=majority
NODE_ENV=production
NEXT_PUBLIC_APP_URL=https://ae-link.allevents.app
DEFAULT_FINGERPRINT_TTL_HOURS=72
DEFAULT_MATCH_THRESHOLD=70
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_PUBLIC_REQUESTS=100
RATE_LIMIT_AUTH_REQUESTS=1000
ALLOWED_ORIGINS=https://allevents.in,https://allevents.app
ENABLE_ANALYTICS=true
ENABLE_DEFERRED_LINKING=true
```

## Step 4: Domain Configuration

1. Add your domain to Vercel:
   - Go to Project Settings → Domains
   - Add `ae-link.allevents.app`
   - Update DNS records as shown

2. Configure DNS (if using external provider):
   - Add CNAME record: `ae-link.allevents.app` → `cname.vercel-dns.com`
   - Or add A records as instructed by Vercel

## Step 5: Database Initialization (Optional)

Run database migrations if needed:

```bash
# Create indexes
npm run db:migrate
```

## Step 6: Verify Deployment

Test your deployment:

```bash
# Health check
curl https://ae-link.allevents.app/api/health

# Response should be:
# {
#   "success": true,
#   "data": {
#     "status": "healthy",
#     "timestamp": "2024-04-21T...",
#     "database": "connected"
#   }
# }
```

## Monitoring & Logging

### View Vercel Logs

```bash
vercel logs ae-link
```

### Environment-Specific Logging

- Development: Pretty-printed logs with timestamps
- Production: JSON logs suitable for log aggregation

### Performance Monitoring

1. Enable Vercel Analytics:
   - Go to Project Settings → Analytics
   - Enable Web Analytics

2. Set up error tracking (recommended):
   - Sentry
   - DataDog
   - New Relic

## Scaling Considerations

### MongoDB Atlas Upgrades

As traffic increases:

1. **M0 → M2/M5**: More resources, backup capability
2. **Auto-scaling**: Enable on production cluster
3. **Read replicas**: Add for read-heavy operations
4. **Sharding**: Enable for datasets > 100GB

### Vercel Auto-scaling

- Vercel automatically scales functions
- No configuration needed for most cases
- Monitor function duration in logs

### Rate Limiting Adjustments

Modify in `.env`:

```
RATE_LIMIT_PUBLIC_REQUESTS=100      # Per minute per IP
RATE_LIMIT_AUTH_REQUESTS=1000       # Per minute per API key
```

## Backup & Recovery

### MongoDB Backups

1. Enable automatic backups in MongoDB Atlas
2. Configure backup retention (default: 35 days)
3. Test restore procedures monthly

### Database Export

```bash
# Install MongoDB CLI tools
npm install -g mongodb-cli-tools

# Export database
mongoexport --uri="$MONGODB_URI" --db=ae-link --collection=links --out=links_backup.json

# Import database
mongoimport --uri="$MONGODB_URI" --db=ae-link --collection=links --file=links_backup.json
```

## Maintenance

### Regular Tasks

1. **Weekly**: Check error logs and performance metrics
2. **Monthly**: Review and optimize slow queries
3. **Quarterly**: Test disaster recovery procedures
4. **Annually**: Security audit and dependency updates

### Database Maintenance

```bash
# Cleanup expired fingerprints and deferred links
# (MongoDB TTL indexes handle this automatically)

# Rebuild indexes if needed
npm run db:migrate
```

## Troubleshooting

### Common Issues

#### MongoDB Connection Fails

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution:**
- Verify MONGODB_URI is correct
- Check IP whitelist in MongoDB Atlas
- Ensure network connectivity

#### Rate Limiting Too Strict

**Solution:**
- Increase RATE_LIMIT_PUBLIC_REQUESTS in .env
- Deploy new version with updated limits

#### Fingerprint Matching Not Working

**Solution:**
- Check tenant's matchThreshold setting (default 70)
- Verify fingerprint TTL window (default 72 hours)
- Review fingerprint matching algorithm in fingerprint.service.ts

## Security Checklist

- [ ] HTTPS enabled (automatic with Vercel)
- [ ] MongoDB user with strong password
- [ ] MongoDB network restrictions configured
- [ ] Environment variables not in git repository
- [ ] API keys rotated regularly
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] Regular security updates

## Production Runbook

### Incident Response

1. **Monitor**: Check Vercel Analytics and logs
2. **Triage**: Identify affected services
3. **Communicate**: Notify stakeholders
4. **Investigate**: Review logs and metrics
5. **Fix**: Apply hotfix if needed
6. **Deploy**: Push fix to production
7. **Verify**: Test affected functionality
8. **Postmortem**: Document and learn

### Rollback Procedure

```bash
# List recent deployments
vercel deployments

# Rollback to previous version
vercel promote <deployment-url>
```

## Support & Resources

- Vercel Docs: https://vercel.com/docs
- MongoDB Atlas Docs: https://docs.atlas.mongodb.com/
- Next.js 14 Docs: https://nextjs.org/docs
- GitHub Issues: Open an issue in your repository

## Cost Optimization

1. **Vercel**: Free tier includes 100GB bandwidth/month
2. **MongoDB Atlas**: Free M0 tier or $9/month for M2
3. **Monitor usage**: Check Vercel and MongoDB dashboards monthly

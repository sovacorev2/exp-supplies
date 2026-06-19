# SupplyPortal Deployment Guide

## Understanding Your Deployment URLs

### Current Setup
- **Repository**: `sovacorev2/exp-supplies` on GitHub
- **Vercel Project ID**: `prj_WkM9UfR6rjX8QSGaQPu9F6cy0vJU`
- **Current Branch**: `v0/iscolevv-9617-952c91a8` (Development)

### Deployment Types

#### 1. Preview Deployments (Current Branches)
Each branch gets its own preview URL that **stays the same** as long as commits are pushed to that branch.

**Your current preview URL:**
```
https://exp-supplies-[hash].vercel.app
```

**How it works:**
- When you push to `v0/iscolevv-9617-952c91a8`, the same preview URL is updated
- The URL does NOT change with each commit
- Only changes when you switch to a different branch

#### 2. Production Deployment (Main Branch)
The `main` branch gets a stable production URL.

**Production URL:**
```
https://exp-supplies.vercel.app (or custom domain if configured)
```

## Keeping a Stable Domain

### Option A: Continue Development on Current Branch ✅ RECOMMENDED
This is what you're currently doing. It's perfect for active development.

```bash
# Push to the same branch - URL stays the same
git push origin v0/iscolevv-9617-952c91a8
```

**Benefits:**
- ✓ URL stays stable: `exp-supplies-[hash].vercel.app`
- ✓ Share with team for testing
- ✓ Can update safely without affecting production

### Option B: Merge to Main for Production
When ready to deploy to production, merge to `main`.

```bash
# Merge to main
git checkout main
git pull origin main
git merge v0/iscolevv-9617-952c91a8
git push origin main

# Or create a PR and merge via GitHub
```

**Benefits:**
- ✓ Gets stable production domain
- ✓ Can use custom domain
- ✓ Official release version

### Option C: Add Custom Domain
Go to Vercel Dashboard → Project Settings → Domains

```
1. Click "Add Domain"
2. Enter your domain (e.g., supplierportal.exp.com)
3. Configure DNS records
4. Your domain will point to your deployment
```

## Deployment Status

### Check Current Deployments
```bash
# View deployed commits
git log --oneline -10

# See current branch
git branch -v
```

### Monitor on Vercel
1. Go to `vercel.com`
2. Select `exp-supplies` project
3. View deployment history
4. Check each deployment's URL and status

## FAQ

**Q: Why does my URL change with each update?**
A: It shouldn't! If using the same branch, the preview URL stays stable. If you're switching branches, each branch gets its own URL.

**Q: How do I share a stable link with suppliers?**
A: Use your current preview URL or merge to `main` for production. Both stay stable across updates.

**Q: Can I have multiple domains?**
A: Yes! Use preview domains for testing, production domain for live suppliers.

**Q: How do I revert a deployment?**
A: Go to Vercel dashboard, find the previous deployment, and redeploy it.

## Next Steps

1. **For Development**: Continue pushing to `v0/iscolevv-9617-952c91a8`
   - Share the preview URL with your team
   - Each commit updates the same URL

2. **For Production**: When ready, run:
   ```bash
   git checkout main && git merge v0/iscolevv-9617-952c91a8 && git push origin main
   ```

3. **For Custom Domain**: Go to Vercel project settings → Domains and add your domain

## Environment Variables

All environment variables are automatically synced from Vercel:
- `DATABASE_URL` - Neon database connection
- `BETTER_AUTH_SECRET` - Auth session signing secret
- `NEXT_PUBLIC_ADMIN_PASSWORD` - Admin login password (currently: `exp.admin`)

To update them:
1. Go to Vercel Project Settings → Environment Variables
2. Edit values
3. Redeploy or push new changes to update deployments

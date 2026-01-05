# Dashboard Deprecation Screen

## Overview

The dashboard has been deprecated and replaced with a new website. All access to the old dashboard routes is now blocked, and users are shown a deprecation screen with instructions to use the new dashboard.

## Changes Made

### 1. Deprecation Screen Component
**File:** `src/components/deprecation-screen.tsx`

A new component that displays:
- A deprecation warning message
- The new dashboard URL: `https://app.greenloop.dev/`
- Login credentials (email and password)
- Show/Hide password toggle
- A redirect button to the new dashboard
- A note that users can change their password after logging in

**Props:**
- `newWebsiteUrl` (optional): Defaults to `https://app.greenloop.dev/`
- `email` (optional): Defaults to `greenhauscc@gmail.com`
- `password` (optional): Defaults to `GreenHaus420!`

### 2. Main Page Update
**File:** `src/app/page.tsx`

- Replaced the dashboard home page with the deprecation screen
- Removed all dashboard navigation links
- Added logic to hide header/footer when deprecation screen is active

### 3. Middleware for Route Blocking
**File:** `middleware.ts`

Created middleware that:
- Blocks access to all dashboard routes (analytics, ambassadors, tools, promotions, etc.)
- Redirects blocked routes to the home page (deprecation screen)
- Allows access to:
  - Root path (`/`) - shows deprecation screen
  - Legal pages (`/legal/*`)
  - Auth pages (`/auth/*`)
  - API routes (`/api/*`)
  - Static files and Next.js internals (`/_next/*`, `/favicon.ico`)
  - Referral routes (`/r/*`, `/s/*`)

### 4. Layout Update
**File:** `src/app/layout.tsx`

- Updated to hide navigation on the root path to keep the deprecation screen clean

## User Experience

When users try to access:
- The old dashboard URL (any Vercel link)
- Any dashboard route (e.g., `/analytics`, `/ambassadors`, `/tools`)
- Any internal dashboard link

They will:
1. See the deprecation screen with a clear message
2. View their login credentials (email and password)
3. Be able to toggle password visibility
4. Click a button to redirect to the new dashboard at `https://app.greenloop.dev/`

## Technical Details

### Route Protection
The middleware intercepts all requests and checks if the path is allowed. If not, it redirects to `/` which displays the deprecation screen.

### Credentials Display
- Email is always visible
- Password is masked by default with a show/hide toggle
- Credentials are hardcoded in the component (can be made configurable via environment variables if needed)

### Styling
The deprecation screen uses:
- Fixed positioning to cover the entire viewport
- High z-index (z-50) to ensure it appears above all content
- GreenHaus brand colors (accent color: `#73A633`)
- Responsive design for mobile and desktop

## Future Considerations

If you need to:
- **Update credentials**: Modify the default props in `src/components/deprecation-screen.tsx`
- **Change the new dashboard URL**: Update the `newWebsiteUrl` prop default value
- **Allow specific routes**: Add them to the `allowedPaths` array in `middleware.ts`
- **Make credentials configurable**: Add environment variables and update the component to read from them

## Deployment

After pushing to GitHub, the changes will automatically deploy to Vercel (if auto-deployment is enabled). The deprecation screen will be live immediately after deployment.

## Rollback

If you need to rollback these changes:
1. Revert the commit: `git revert <commit-hash>`
2. Or restore the previous version of:
   - `src/app/page.tsx`
   - `middleware.ts` (delete if it didn't exist before)
   - `src/components/deprecation-screen.tsx` (delete)
   - `src/app/layout.tsx`

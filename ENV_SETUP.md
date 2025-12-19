# Environment Variables Setup

All Firebase and API functionality is intact and ready to use. You just need to ensure your environment variables are set.

## Required Environment Variables

### Firebase (Client-side)
These are needed for Analytics, Ambassadors, and Firestore features:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`

### Firebase Admin (Server-side)
These are needed for API routes that access Firestore:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

### Caption Generator
- `GEMINI_API_KEY` (for AI caption generation)
- `GOOGLE_DRIVE_PRIVATE_KEY` (for Google Drive integration)
- `GOOGLE_DRIVE_CLIENT_EMAIL` (for Google Drive integration)
- `BLOB_READ_WRITE_TOKEN` (for Vercel Blob storage)

### Other APIs (if needed)
- `ADMIN_API_KEY` or `NEXT_PUBLIC_VITE_ADMIN_API_KEY`
- `STAFF_PIN`
- `STORE_IP_ALLOWLIST_CSV`
- `NEXT_PUBLIC_SITE_BASE`

## Setup

1. **For Local Development:**
   - Create/update `.env.local` file with all the variables above
   - Use the same values from your original setup

2. **For Vercel Deployment:**
   - Add all environment variables in Vercel project settings
   - Use the same values from your original deployment

## What's Working

✅ All API routes are intact and accessible
✅ Firebase configuration is ready (just needs env vars)
✅ Analytics dashboard - connected to `/api/analytics`
✅ Ambassadors dashboard - connected to `/api/ambassadors` and Firestore
✅ Caption Generator - connected to `/api/tools/generate-caption`
✅ All other features remain functional

## What Was Hidden (Not Removed)

- Promotions page (hidden from navigation, but API routes still exist)
- Broadcast page (hidden from navigation, but API routes still exist)
- Stores page (hidden from navigation)
- Settings page (hidden from navigation)

All the code and API routes are still there - they're just not visible in the navigation menu.


## GreenHaus Admin

A Next.js 14 admin shell for managing GreenHaus mobile experiences. The project ships with Tailwind CSS, a sticky top navigation, and starter dashboards for Promotions, Analytics, Stores, Ambassadors, and Settings.

### Environment Setup

1. Copy the sample environment file and fill in your Firebase Web App credentials:

   ```bash
   cp .env.local.sample .env.local
   ```

2. Provide values for:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_ALLOWED_ADMINS` (comma-separated email list with dashboard access)

3. Provide values for the push service:
   - `VITE_API_URL` – base URL for your deployed admin API (e.g. `https://greenhaus-admin.vercel.app/api`)
   - `VITE_ADMIN_API_KEY` – shared secret used by admin routes and the dashboard.

   The same values must be available at build and runtime (e.g. configure them in Vercel `Environment Variables`).

4. Install dependencies and start the development server:

   ```bash
   npm install
   npm run dev
   ```

With Firebase configured, the Promotions dashboard lets admins compose promos, target stores, and schedule windows while streaming recent entries from Firestore.

### Push API

- `POST /api/push/register`: Save Expo push tokens. Expected payload: `{ token, env?, storeId?, deviceId?, platform?, appVersion? }`.
- `POST /api/push/send`: Send a push to a provided list of tokens or to a segment (`env`, optional `storeId`). Requires `x-admin-key` header.
- `POST /api/push/broadcast`: Broadcast the message to every stored token in the specified segment. Also requires `x-admin-key`.

#### Mobile app configuration

Point the Expo app to the deployed admin API by updating its environment/config to call:

```
POST https://<your-vercel-app>.vercel.app/api/push/register
POST https://<your-vercel-app>.vercel.app/api/push/send
POST https://<your-vercel-app>.vercel.app/api/push/broadcast
```

Pass the shared admin key via the `x-admin-key` header when invoking `/send` or `/broadcast`. The app should call `/register` after obtaining its Expo push token.

### Authentication

- The `/auth/login` route offers Google Sign-In backed by Firebase Auth.
- `/promotions` enforces auth via middleware and client guard; other dashboards still use the runtime guard.
- Only emails whitelisted in `NEXT_PUBLIC_ALLOWED_ADMINS` may publish promos. Everyone else sees a read-only feed.

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
   - `NEXT_PUBLIC_SITE_BASE` (base URL for ambassador QR codes, e.g. `https://greenhaus-site.vercel.app`)
   - `STAFF_PIN` (4-6 digit PIN for staff QR access, e.g. `4200`)
   - `STORE_IP_ALLOWLIST_CSV` (comma-separated IPs/CIDR blocks for store Wi-Fi, e.g. `11.22.33.44,55.66.77.0/24`)

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

### Promotions API

The system provides a public API for fetching active promotions:

#### GET /api/promotions

Returns a list of active promotions matching the specified criteria.

**Query Parameters:**
- `env` (optional): Environment filter - "prod" or "staging" (default: "prod")
- `storeId` (optional): Store identifier - "cookeville" or "crossville" (if omitted, returns from both stores)
- `limit` (optional): Maximum number of results (default: 5, max: 10)

**Response Format:**
```json
[
  {
    "id": "promo_123",
    "title": "Earth Day Sale",
    "body": "Get 20% off all eco-friendly products",
    "imageUrl": "https://example.com/sale.jpg",
    "ctaUrl": "https://greenhaus.app/sale",
    "startsAt": "2024-04-22T00:00:00.000Z",
    "endsAt": "2024-04-23T23:59:59.000Z"
  }
]
```

**Firestore Schema:**
The `promotions` collection uses the following schema:
- `title` (string, required): Promotion title
- `body` (string, optional): Promotion description
- `imageUrl` (string, optional): Absolute URL to promotion image
- `ctaUrl` (string, optional): Call-to-action URL
- `enabled` (boolean, default: false): Whether promotion is active
- `env` ("prod" | "staging", default: "prod"): Environment
- `storeId` (string, default: "store_123"): Store identifier
- `startsAt` (Timestamp, optional): Promotion start time
- `endsAt` (Timestamp, optional): Promotion end time
- `createdAt` (Timestamp): Document creation time
- `updatedAt` (Timestamp): Last update time

**Migration:**
To migrate existing promotions to the new schema:
```bash
# Via API (requires admin key)
POST /api/promotions/migrate
Headers: x-admin-key: <your-admin-key>

# Via script
npx ts-node scripts/migratePromotions.ts
```

**Promotions Maintenance:**
Run the maintenance script to migrate promotions and check active promos:
```bash
npm run promos:maintain
```

This script will:
1. Run the migration endpoint to update all promotions to the new schema
2. Fetch and display active promotions from production
3. Show a summary with counts and sample titles

Expected output:
- Migration results: count of updated/skipped documents
- Active promotions list: titles, dates, and CTAs
- Color-coded status messages for easy scanning

Requires `NEXT_PUBLIC_VITE_ADMIN_API_KEY` to be set in `.env.local`.

### Store Segmentation (Phase 2)

The system now uses canonical store IDs for precise targeting in both Broadcast and Promotions:

#### Canonical Store IDs
- `greenhaus-tn-crossville` (label: "Crossville, TN")
- `greenhaus-tn-cookeville` (label: "Cookeville, TN")

#### Environment
- All targeting is fixed to `env="prod"`

#### Broadcast UI (/broadcast)
- Store ID is now a Select dropdown with the two canonical options
- Environment is fixed to "prod"
- Status line shows: "Targeting env=prod, store=<selected>"

#### Promotions
- Promo create/edit form uses the same store Select dropdown
- Environment is fixed to "prod"
- GET /api/promotions now requires both `env` and `storeId` parameters (no defaults)

#### Migration Endpoint
To migrate existing data from the legacy `store_123` format:

```bash
POST /api/maintenance/migrate-store-segmentation
Headers: x-admin-key: <your-admin-key>
```

This endpoint will:
- Update pushTokens with `env=="prod"` AND `storeId=="store_123"` to `storeId="greenhaus-tn-crossville"`
- Update promotions with `env=="prod"` AND `storeId=="store_123"` to `storeId="greenhaus-tn-crossville"`

Returns: `{updatedTokens, updatedPromotions}`

**Note**: The app will re-assign tokens to the user's chosen store on next launch. This endpoint is just to avoid "No tokens for this segment" while users roll forward.

#### Example Broadcast Payload
```json
{
  "title": "Store Update",
  "body": "New products available!",
  "segment": {
    "env": "prod",
    "storeId": "greenhaus-tn-crossville"
  }
}
```

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

### Ambassador QR System

The admin dashboard includes a comprehensive ambassador tracking system with anti-cheat protection and dual QR types:

#### Features
- **Public QR Codes**: Anyone can scan, with anti-cheat (1 scan per IP per day)
- **Staff QR Codes**: Require store Wi-Fi IP or 4-digit PIN for access
- **Dual QR Support**: Each ambassador can have both public and staff QR codes
- **Scan Analytics**: Separate tracking for public vs staff scans
- **Anti-Cheat Protection**: Prevents duplicate scans from same IP on same day

#### QR Code Types
- **Public**: `https://your-site.com/r/{code}` - Anyone can scan, anti-cheat enabled
- **Staff**: `https://your-site.com/s/{code}` - Store Wi-Fi or PIN required

#### Environment Variables
- `STAFF_PIN`: 4-6 digit PIN for staff access (e.g. `4200`)
- `STORE_IP_ALLOWLIST_CSV`: Comma-separated store IPs/CIDR blocks (e.g. `11.22.33.44,55.66.77.0/24`)
- `NEXT_PUBLIC_SITE_BASE`: Base URL for QR code generation

#### Migration
Run the migration API to update existing ambassadors:
```bash
POST /api/migrate-ambassadors-v2
{ "action": "migrate" }
```

### Phase 2: Lightspeed Integration

When Lightspeed access is granted, the system will be enhanced to track verified sales instead of just scans:

#### Planned Features
- **Webhook Integration**: Receive order notifications from Lightspeed
- **UTM Campaign Tracking**: Match orders with `utm_campaign={code}` parameter
- **Loyalty Tag Mapping**: Map applied loyalty tags to ambassador codes
- **Verified Sales Counter**: Replace scan-based counting with actual sales data
- **Sales Analytics**: Track revenue generated per ambassador

#### Implementation Notes
- Replace `scanCount` with `verifiedSales` counter
- Add webhook endpoint: `POST /api/lightspeed/webhook`
- Implement order-to-ambassador mapping logic
- Update dashboard to show sales metrics instead of scan counts

### Authentication

- The `/auth/login` route offers Google Sign-In backed by Firebase Auth.
- `/promotions` enforces auth via middleware and client guard; other dashboards still use the runtime guard.
- Only emails whitelisted in `NEXT_PUBLIC_ALLOWED_ADMINS` may publish promos. Everyone else sees a read-only feed.

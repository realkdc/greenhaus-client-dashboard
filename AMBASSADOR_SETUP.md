# Ambassador Tracking Setup

## Environment Variables

Add the following environment variable to your Vercel project (Production & Preview):

```
AMBASSADOR_STAFF_PIN=9462
```

**Important:** 
- Use a 4-6 digit PIN for security
- Do NOT hardcode this value in the client code
- The PIN is only used server-side for validation

## Features Implemented

### Firestore Schema
- **Collection**: `ambassadors` (doc id: ambassadorId)
  - `name`: string
  - `code`: string (e.g., "JaneDoe-WK93", unique)
  - `codeLower`: string (lowercase version for case-insensitive queries)
  - `storeId`: string (default "store_123")
  - `createdAt`: Timestamp
  - `uses`: number (running count, default 0)
- **Subcollection**: `ambassadors/{ambassadorId}/uses`
  - Each doc: `{ usedAt: Timestamp, staff: string | null, note?: string }`

### API Endpoints
1. **POST /api/ambassadors/use**
   - Body: `{ code: string, staffPin: string, staffName?: string, note?: string }`
   - Validates staff PIN against `AMBASSADOR_STAFF_PIN`
   - Finds ambassador by code (case-insensitive)
   - Creates use record and increments uses atomically
   - Returns updated uses total and last use id

2. **GET /api/ambassadors/export.csv**
   - Returns CSV of all ambassadors
   - Columns: name, code, storeId, uses, createdAtISO
   - Downloads as `ambassadors.csv`

### Pages
1. **/ambassadors** - Updated dashboard
   - Table with: Name, Code, Store, Uses, Actions
   - QR button → modal with generated QR code
   - Download QR button (downloads PNG)
   - Export CSV button
   - Scan QR button → navigates to scan page

2. **/use** - Mobile-friendly usage page
   - Reads `?code=...` from URL
   - Form: Staff PIN (required), Staff name (optional), Note (optional)
   - Success: "✅ Recorded for {code}. Total uses: X"
   - Error handling with clear messages

3. **/ambassadors/scan** - QR code scanner
   - Uses device camera to scan QR codes
   - After scanning, navigates to `/use?code=<value>`
   - Full-width camera frame with Cancel button

## Usage Flow

1. **Create Ambassador**: Use existing `/crew` page to create ambassadors
2. **Generate QR**: Click "QR" button on `/ambassadors` page
3. **Download QR**: Download PNG for printing/sharing
4. **Scan QR**: Use `/ambassadors/scan` to scan QR codes
5. **Record Usage**: Staff enters PIN and optional details on `/use` page
6. **Export Data**: Download CSV from `/ambassadors` page

## Security Notes

- Staff PIN is validated server-side only
- PIN is never exposed in client code
- All API endpoints use proper validation with Zod
- Case-insensitive code lookups for better UX
- Atomic transactions prevent race conditions

## Mobile Compatibility

- `/use` page is optimized for mobile devices
- QR scanner works on mobile browsers
- Touch-friendly interface elements
- Responsive design for all screen sizes

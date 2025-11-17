# Testing the Analytics API Endpoint

## Quick Test Methods

### Method 1: Using curl (Command Line)

**Basic test (no auth):**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "APP_OPEN",
    "metadata": {}
  }'
```

**With user ID:**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "VIEW_TAB",
    "metadata": { "tab": "Home" },
    "userId": "test-user-123"
  }'
```

**With Firebase Auth token:**
```bash
curl -X POST https://your-vercel-app.vercel.app/api/analytics/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "eventType": "START_ORDER_CLICK",
    "metadata": {}
  }'
```

### Method 2: Using Browser Console (Local Dev)

If testing locally at `http://localhost:3000`:

```javascript
// Test APP_OPEN event
fetch('http://localhost:3000/api/analytics/events', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    eventType: 'APP_OPEN',
    metadata: {}
  })
})
.then(res => res.json())
.then(data => console.log('Success:', data))
.catch(err => console.error('Error:', err));
```

### Method 3: Using Browser Console (Production)

Replace with your actual Vercel URL:

```javascript
// Test multiple event types
const events = [
  { eventType: 'APP_OPEN', metadata: {} },
  { eventType: 'VIEW_TAB', metadata: { tab: 'Home' } },
  { eventType: 'START_ORDER_CLICK', metadata: {} },
  { eventType: 'JOIN_CREW_CLICK', metadata: {} },
];

events.forEach((event, i) => {
  setTimeout(() => {
    fetch('https://your-vercel-app.vercel.app/api/analytics/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    })
    .then(res => res.json())
    .then(data => console.log(`Event ${i+1} (${event.eventType}):`, data))
    .catch(err => console.error(`Event ${i+1} error:`, err));
  }, i * 500); // Stagger requests
});
```

### Method 4: Using Postman/Insomnia

1. **Method:** POST
2. **URL:** `https://your-vercel-app.vercel.app/api/analytics/events`
3. **Headers:**
   - `Content-Type: application/json`
   - `Authorization: Bearer YOUR_TOKEN` (optional)
4. **Body (JSON):**
```json
{
  "eventType": "APP_OPEN",
  "metadata": {},
  "userId": "optional-user-id"
}
```

### Method 5: Test Script (Node.js)

Create a file `test-analytics.js`:

```javascript
const API_URL = process.env.API_URL || 'http://localhost:3000/api/analytics/events';

const testEvents = [
  { eventType: 'APP_OPEN', metadata: {} },
  { eventType: 'VIEW_TAB', metadata: { tab: 'Home' } },
  { eventType: 'VIEW_TAB', metadata: { tab: 'Loyalty' } },
  { eventType: 'START_ORDER_CLICK', metadata: {} },
  { eventType: 'JOIN_CREW_CLICK', metadata: {} },
  { eventType: 'PUSH_OPEN', metadata: { campaignId: 'test-123', title: 'Test Push' } },
  { eventType: 'REFERRAL_LINK_CLICK', metadata: { referralCode: 'TEST123' } },
];

async function testEvent(event) {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    
    const data = await response.json();
    console.log(`✅ ${event.eventType}:`, response.status, data);
    return { success: true, eventType: event.eventType };
  } catch (error) {
    console.error(`❌ ${event.eventType}:`, error.message);
    return { success: false, eventType: event.eventType, error: error.message };
  }
}

async function runTests() {
  console.log(`Testing analytics API at: ${API_URL}\n`);
  
  const results = [];
  for (const event of testEvents) {
    const result = await testEvent(event);
    results.push(result);
    await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
  }
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n📊 Results: ${successCount}/${results.length} events sent successfully`);
}

runTests();
```

Run it:
```bash
node test-analytics.js
# Or with custom URL:
API_URL=https://your-app.vercel.app/api/analytics/events node test-analytics.js
```

## Expected Responses

### Success (200)
```json
{
  "ok": true
}
```

### Validation Error (400)
```json
{
  "error": "Invalid request data",
  "details": [...]
}
```

### Rate Limited (429)
```json
{
  "error": "Too many requests, please try again later"
}
```

## Verify Events in Dashboard

After sending test events:

1. Wait a few seconds for Firestore to index
2. Navigate to `/analytics` in your admin dashboard
3. Check the "Recent Events" table - your test events should appear
4. Verify the summary metrics update (APP_OPEN count, etc.)

## Testing Rate Limiting

To test rate limiting (100 events/hour per IP):

```bash
# Send 101 requests quickly
for i in {1..101}; do
  curl -X POST https://your-app.vercel.app/api/analytics/events \
    -H "Content-Type: application/json" \
    -d '{"eventType":"APP_OPEN","metadata":{}}' &
done
wait

# The 101st request should return 429
```

## Troubleshooting

**Events not appearing in dashboard:**
- Check browser console for errors
- Verify Firestore is configured correctly
- Check Vercel function logs
- Ensure events were sent successfully (check response)

**429 Rate Limit:**
- Wait an hour or test from a different IP
- Rate limit is per IP, so you can test from different machines

**CORS Issues:**
- Shouldn't occur with proper setup, but if you see CORS errors, check Vercel configuration


# Mobile App Analytics Integration Guide

This document provides instructions for integrating analytics event tracking into the GreenLoop mobile app (Expo/React Native).

## API Endpoint

**URL:** `POST https://<your-vercel-app>.vercel.app/api/analytics/events`

**Base URL:** Use the same base URL as your other API endpoints (e.g., `https://greenhaus-admin.vercel.app`).

## Request Format

### Headers

- `Content-Type: application/json`
- `Authorization: Bearer <firebase-auth-token>` (optional - if user is logged in)

### Request Body

```typescript
{
  eventType: string;        // Required: Event type identifier
  metadata?: object;        // Optional: Additional event data
  userId?: string | null;   // Optional: User ID (if not provided via auth token)
}
```

## Event Types

Track the following events in your mobile app:

### 1. APP_OPEN
Fired when the app becomes active or main navigator mounts.

```json
{
  "eventType": "APP_OPEN",
  "metadata": {}
}
```

**When to fire:**
- App launch
- App returns to foreground
- Main navigator component mounts

### 2. VIEW_TAB
Fired when user navigates to a main tab/screen.

```json
{
  "eventType": "VIEW_TAB",
  "metadata": {
    "tab": "Home" | "Loyalty" | "Menu" | "Profile" | "Crew"
  }
}
```

**When to fire:**
- User switches to a different main tab
- User navigates to a primary screen

### 3. START_ORDER_CLICK
Fired when user taps the main "Start Order" / "Shop Now" button.

```json
{
  "eventType": "START_ORDER_CLICK",
  "metadata": {}
}
```

**When to fire:**
- User taps any button that initiates the ordering flow
- User taps "Shop Now" or equivalent CTA

### 4. JOIN_CREW_CLICK
Fired when user taps any button that leads to the "GreenHaus Crew" / ambassador area.

```json
{
  "eventType": "JOIN_CREW_CLICK",
  "metadata": {}
}
```

**When to fire:**
- User taps button to access ambassador/crew features
- User navigates to crew/ambassador section

### 5. PUSH_OPEN
Fired when a push notification is opened.

```json
{
  "eventType": "PUSH_OPEN",
  "metadata": {
    "campaignId": "string (optional)",
    "title": "string (optional)"
  }
}
```

**When to fire:**
- User taps on a push notification
- App opens from a push notification

### 6. REFERRAL_LINK_CLICK
Fired when user taps any in-shell referral links/buttons (before WebView).

```json
{
  "eventType": "REFERRAL_LINK_CLICK",
  "metadata": {
    "referralCode": "string (optional)"
  }
}
```

**When to fire:**
- User taps referral link/button in the app shell
- User shares referral code

## Implementation Example

### TypeScript/JavaScript Helper Function

```typescript
/**
 * Track an analytics event
 * Fails silently - never throws errors
 */
async function trackEvent(
  eventType: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    // Get Firebase auth token if user is logged in
    const auth = getAuth();
    const user = auth.currentUser;
    const token = user ? await user.getIdToken() : null;

    // Get user ID
    const userId = user?.uid || null;

    // Prepare request
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Send event to analytics API
    const response = await fetch(
      'https://<your-vercel-app>.vercel.app/api/analytics/events',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          eventType,
          metadata: metadata || {},
          userId,
        }),
      }
    );

    if (!response.ok) {
      console.warn(`[Analytics] Event tracking failed: ${response.status}`);
    }
  } catch (error) {
    // Fail silently - never throw
    console.warn('[Analytics] Failed to track event:', error);
  }
}
```

### React Native / Expo Integration

#### 1. App Open Tracking

```typescript
import { useEffect } from 'react';
import { AppState } from 'react-native';

useEffect(() => {
  // Track initial app open
  trackEvent('APP_OPEN');

  // Track app returning to foreground
  const subscription = AppState.addEventListener('change', (nextAppState) => {
    if (nextAppState === 'active') {
      trackEvent('APP_OPEN');
    }
  });

  return () => subscription.remove();
}, []);
```

#### 2. Tab Navigation Tracking

```typescript
import { useNavigationState } from '@react-navigation/native';

const navigationState = useNavigationState((state) => state);

useEffect(() => {
  if (navigationState) {
    const currentRoute = navigationState.routes[navigationState.index];
    const tabName = getTabNameFromRoute(currentRoute.name);
    
    if (tabName) {
      trackEvent('VIEW_TAB', { tab: tabName });
    }
  }
}, [navigationState]);
```

#### 3. Button Click Tracking

```typescript
const handleStartOrder = () => {
  trackEvent('START_ORDER_CLICK');
  // ... rest of your order flow logic
};

const handleJoinCrew = () => {
  trackEvent('JOIN_CREW_CLICK');
  // ... rest of your crew flow logic
};
```

#### 4. Push Notification Tracking

```typescript
import * as Notifications from 'expo-notifications';

Notifications.addNotificationResponseReceivedListener((response) => {
  const { notification } = response;
  trackEvent('PUSH_OPEN', {
    campaignId: notification.request.content.data?.campaignId,
    title: notification.request.content.title,
  });
});
```

## Error Handling

**Important:** All analytics calls must fail silently and never block app functionality.

- Never throw errors from `trackEvent()`
- Never await analytics calls in critical paths
- Use `console.warn()` for debugging, not `console.error()`
- If the API is unavailable, the app should continue working normally

## Rate Limiting

The API endpoint has rate limiting:
- **Limit:** 100 events per IP per hour
- **Response:** 429 Too Many Requests if exceeded
- **Behavior:** Events are silently dropped if rate limited

This should not affect normal app usage, but be aware that very high-frequency events may be throttled.

## Authentication

Authentication is **optional**:

- If a Firebase Auth token is provided in the `Authorization` header, the user ID will be extracted from the token
- If no token is provided, the `userId` from the request body will be used
- If neither is provided, the event will be logged as anonymous (`userId: null`)
- **Never reject events due to missing or invalid auth**

## Testing

### Test Event Submission

```bash
curl -X POST https://<your-vercel-app>.vercel.app/api/analytics/events \
  -H "Content-Type: application/json" \
  -d '{
    "eventType": "APP_OPEN",
    "metadata": {}
  }'
```

### Verify Events in Admin Dashboard

1. Navigate to `/analytics` in the admin dashboard
2. Check the "Recent Events" table
3. Verify your test events appear within a few seconds

## Best Practices

1. **Fire-and-forget:** Don't await analytics calls in critical user flows
2. **Batch when possible:** Consider batching multiple events if needed (future enhancement)
3. **Consistent metadata:** Use consistent keys in metadata objects
4. **Privacy:** Don't send PII in metadata unless necessary
5. **Performance:** Analytics should never impact app performance

## Troubleshooting

### Events not appearing in dashboard

1. Check network requests in dev tools
2. Verify API endpoint URL is correct
3. Check for rate limiting (429 responses)
4. Verify Firestore is configured correctly

### High error rates

1. Check API endpoint availability
2. Verify request format matches documentation
3. Check for CORS issues (shouldn't occur with proper setup)

## Support

For issues or questions, contact the backend team or check the admin dashboard logs.


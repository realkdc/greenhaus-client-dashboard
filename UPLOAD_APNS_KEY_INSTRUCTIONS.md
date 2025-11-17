# Upload APNs Key to Expo - Step by Step

## Your Details
- **APNs Key File**: `/Users/drippo/Downloads/AuthKey_PCPW3GC2W2.p8`
- **Key ID**: `PCPW3GC2W2`
- **Team ID**: `P99524QAS9`
- **New Bundle ID**: `com.greenhauscc.customer`
- **Expo Project**: `@indieplant/greenloop-loyalty-ordering-platform`

---

## Web Interface Method (EASIEST - 2 minutes)

1. **Go to your Expo project credentials page**:
   ```
   https://expo.dev/accounts/indieplant/projects/greenloop-loyalty-ordering-platform/credentials
   ```

2. **In the iOS section**:
   - You should see the old bundle ID: `com.greenhaus.customer`
   - Click the **"+ Add Bundle Identifier"** button

3. **Add the new bundle ID**:
   - Enter: `com.greenhauscc.customer`
   - Click "Create"

4. **Upload the Push Key**:
   - Find the newly created bundle ID: `com.greenhauscc.customer`
   - Click **"Upload Push Key (.p8)"**
   - Select file: `/Users/drippo/Downloads/AuthKey_PCPW3GC2W2.p8`
   - Enter **Key ID**: `PCPW3GC2W2`
   - Confirm **Team ID**: `P99524QAS9`
   - Click "Save"

5. **Done!** The push notifications will now work with the new organization account.

---

## Why This Is Needed

- Your old bundle ID was: `com.greenhaus.customer`
- Your new bundle ID is: `com.greenhauscc.customer` (note the "cc" difference)
- The admin dashboard push notifications need the new APNs key configured for the new bundle ID
- This ensures push notifications work with your new Apple organization account

---

## Verification

After uploading, you should see:
- Bundle ID: `com.greenhauscc.customer`
- Push Key: `PCPW3GC2W2`
- Team: `P99524QAS9 (GREENHAUS JS LLC)`
- Status: Active

Your admin dashboard at `/Users/drippo/Desktop/greenhaus-admin` will automatically use this new configuration once Expo's push notification service is aware of it.




# Release Checklist

## Preflight (required)
1. `npm ci`
2. `npm run preflight`
3. `npx expo config --type public`

## Product-critical smoke tests
1. Sign in with password and magic code.
2. Open Discover, Bookings, Messages, Chat, Profile, Subscription.
3. Create booking and reach confirmation.
4. Send text message, image, and video (dev/prod build, not Expo Go).
5. Purchase Pro, then restore purchases.
6. Confirm Friends gating for Free vs Pro users.

## Supabase checks
1. Latest migrations applied.
2. Edge functions deployed and secrets configured.
3. RevenueCat webhook endpoint reachable and authenticated.

## Monitoring checks
1. Sentry DSN configured for target environment.
2. Verify events:
   - `auth_signin_success` / `auth_signin_fail`
   - `booking_create_success` / `booking_create_fail`
   - `message_send_success` / `message_send_fail`
   - `pro_purchase_started` / `pro_purchase_succeeded` / `pro_purchase_failed`
   - `pro_restore_succeeded` / `pro_restore_failed`

## Rollout
1. Internal QA build.
2. Beta cohort.
3. 10% rollout.
4. 50% rollout.
5. 100% rollout after error-rate review.

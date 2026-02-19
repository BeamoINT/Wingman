# Supabase Deploy Order

## Required secrets

### Functions runtime secrets
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `REVENUECAT_SECRET_API_KEY`
- `REVENUECAT_WEBHOOK_AUTH`
- `REVENUECAT_ENTITLEMENT_PRO`
- `GOOGLE_PLACES_API_KEY` (for existing city search/geocoding functions)
- `GOOGLE_MAPS_SERVER_API_KEY` (for in-app directions Edge function)
- `STRIPE_SECRET_KEY`
- `STRIPE_IDENTITY_WEBHOOK_SECRET`
- `STRIPE_IDENTITY_RETURN_URL` (optional, recommended)
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `ID_VERIFICATION_MAINTENANCE_SECRET` (required if securing scheduled maintenance endpoint)
- `LIVE_LOCATION_MAINTENANCE_SECRET` (recommended for scheduled live-location cleanup)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`
- `SAFETY_MAINTENANCE_SECRET` (recommended for scheduled safety maintenance endpoint)
- `EMERGENCY_LINK_SIGNING_SECRET` (required for secure external emergency live-location links)
- `GOOGLE_MAPS_WEB_API_KEY` (optional, only for map tiles in external emergency viewer)
- `SAFETY_AUDIO_CLOUD_MAINTENANCE_SECRET` (recommended for scheduled cloud-audio retention maintenance)
- `SAFETY_AUDIO_CLOUD_BUCKET` (optional override, defaults to `safety-audio-cloud`)

Security note: if a RevenueCat `sk_` secret key is ever shared in plaintext, rotate it after deployment and update `REVENUECAT_SECRET_API_KEY` immediately.

Stripe key mode note: `STRIPE_SECRET_KEY` must match the environment where Stripe Identity is enabled.
- `sk_test_...` key -> enable Identity in test mode.
- `sk_live_...` key -> enable Identity in live mode.

## Deploy sequence
1. Link the project and verify environment:
```bash
supabase link --project-ref <project-ref>
```
2. Apply migrations:
```bash
supabase db push
```
Important: `20260301_wingman_onboarding_stripe_agreement.sql` introduces immediate hard enforcement for wingmen.
Users with expired/unverified ID or missing current agreement acceptance will be blocked from companion profile writes until re-compliant.
`20260304_local_safety_audio_recording.sql` extends `safety_preferences` and adds v2 RPCs used by the on-device safety audio toggle.
`20260306_pro_cloud_safety_audio.sql` adds Pro cloud safety-audio storage, retention notices, downgrade grace lifecycle, and v3 safety preference RPCs.
3. Deploy edge functions:
```bash
supabase functions deploy create-media-upload-url
supabase functions deploy get-media-download-url
supabase functions deploy revenuecat-webhook
supabase functions deploy sync-pro-entitlement
supabase functions deploy resolve-metro-area
supabase functions deploy get-directions
supabase functions deploy live-location-maintenance
supabase functions deploy create-id-verification-session --no-verify-jwt
supabase functions deploy stripe-identity-webhook --no-verify-jwt
supabase functions deploy id-verification-maintenance
supabase functions deploy send-emergency-contact-otp --no-verify-jwt
supabase functions deploy verify-emergency-contact-otp --no-verify-jwt
supabase functions deploy trigger-emergency-alert --no-verify-jwt
supabase functions deploy safety-maintenance
supabase functions deploy emergency-live-location-view
supabase functions deploy create-safety-audio-upload-url
supabase functions deploy get-safety-audio-download-url
supabase functions deploy safety-audio-cloud-maintenance
```
4. Set secrets:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set REVENUECAT_SECRET_API_KEY=...
supabase secrets set REVENUECAT_WEBHOOK_AUTH=...
supabase secrets set REVENUECAT_ENTITLEMENT_PRO=pro
supabase secrets set GOOGLE_PLACES_API_KEY=...
supabase secrets set GOOGLE_MAPS_SERVER_API_KEY=...
supabase secrets set STRIPE_SECRET_KEY=...
supabase secrets set STRIPE_IDENTITY_WEBHOOK_SECRET=...
supabase secrets set STRIPE_IDENTITY_RETURN_URL=...
supabase secrets set RESEND_API_KEY=...
supabase secrets set RESEND_FROM_EMAIL=...
supabase secrets set ID_VERIFICATION_MAINTENANCE_SECRET=...
supabase secrets set LIVE_LOCATION_MAINTENANCE_SECRET=...
supabase secrets set TWILIO_ACCOUNT_SID=...
supabase secrets set TWILIO_AUTH_TOKEN=...
supabase secrets set TWILIO_VERIFY_SERVICE_SID=...
supabase secrets set TWILIO_MESSAGING_SERVICE_SID=...
supabase secrets set TWILIO_FROM_NUMBER=...
supabase secrets set SAFETY_MAINTENANCE_SECRET=...
supabase secrets set EMERGENCY_LINK_SIGNING_SECRET=...
supabase secrets set GOOGLE_MAPS_WEB_API_KEY=...
supabase secrets set SAFETY_AUDIO_CLOUD_MAINTENANCE_SECRET=...
supabase secrets set SAFETY_AUDIO_CLOUD_BUCKET=safety-audio-cloud
```
5. Configure Stripe Identity webhook endpoint:
```bash
# Endpoint:
# https://<project-ref>.functions.supabase.co/stripe-identity-webhook
#
# Subscribe to identity.verification_session.* events.
```
6. Enable Stripe Identity capability in both environments before smoke testing:
```bash
# Test mode
# https://dashboard.stripe.com/test/settings/identity
#
# Live mode
# https://dashboard.stripe.com/settings/identity
```
Expected result after enablement: account setting shows Identity active and session creation returns a hosted verification URL.
7. Configure a daily scheduler to call maintenance:
```bash
# POST https://<project-ref>.functions.supabase.co/id-verification-maintenance
# Header: x-maintenance-secret: <ID_VERIFICATION_MAINTENANCE_SECRET>
```
8. Configure a 5-minute scheduler for live location cleanup:
```bash
# POST https://<project-ref>.functions.supabase.co/live-location-maintenance
# Header: x-maintenance-secret: <LIVE_LOCATION_MAINTENANCE_SECRET>
```
9. Configure a 1-minute scheduler for safety monitoring:
```bash
# POST https://<project-ref>.functions.supabase.co/safety-maintenance
# Header: x-maintenance-secret: <SAFETY_MAINTENANCE_SECRET>
```
10. Configure a daily scheduler for cloud safety-audio retention:
```bash
# POST https://<project-ref>.functions.supabase.co/safety-audio-cloud-maintenance
# Header: x-maintenance-secret: <SAFETY_AUDIO_CLOUD_MAINTENANCE_SECRET>
```
11. Verify function health with authenticated calls from a staging build.
12. Verify companion onboarding RPCs:
```bash
# Authenticated RPC smoke tests
# public.get_wingman_onboarding_state_v1()
# public.accept_companion_agreement_v1('1.0', 'onboarding')
# public.upsert_wingman_profile_v1(...)
```

## Stripe troubleshooting
1. Error: `account is not set up to use Identity`
- Confirm Identity is enabled in Stripe Dashboard for the same mode as the secret key.
- Test URL: `https://dashboard.stripe.com/test/settings/identity`
- Live URL: `https://dashboard.stripe.com/settings/identity`

2. Error: `invalid api key` / `authentication_error`
- Rotate and re-set `STRIPE_SECRET_KEY`.
- Confirm key belongs to the same Stripe account that has Identity enabled.

3. Error: user sees setup CTA unexpectedly
- Confirm function is deployed with `--no-verify-jwt`.
- Confirm app sends a valid Supabase session token and the user is signed in.

## Validation checklist
1. `conversation_members` and `participant_ids` are present on `conversations`.
2. `message_device_identities`, `message_key_boxes`, `message_attachments` tables exist with RLS.
3. `get_or_create_direct_conversation_v2` RPC is callable by authenticated users.
4. RevenueCat webhook writes `subscription_events` and updates `profiles.subscription_tier`.
5. `resolve-metro-area` returns metro payloads for US city aliases (for example Franklin, TN -> Nashville Metro).
6. `create-id-verification-session` returns a Stripe Identity hosted URL for authenticated users with camera-captured profile photo readiness state.
7. `stripe-identity-webhook` marks successful matches as `profiles.id_verification_status='verified'` with a 3-year expiry.
8. `id-verification-maintenance` marks expired users and sends 90/30/7/1-day Resend reminders.
9. `get-directions` returns recommended route + alternatives for authenticated users.
10. `live-location-maintenance` expires stale shares and removes expired points.
11. `stripe-identity-webhook` writes failure reason code/message for failed verification attempts.
12. `companion_agreement_acceptance_log` captures immutable acceptance records with agreement version + timestamp.
13. `upsert_wingman_profile_v1` auto-publishes companion profiles only when active ID verification and current agreement acceptance are both satisfied.
14. `send-emergency-contact-otp` and `verify-emergency-contact-otp` complete Twilio Verify OTP for emergency contacts.
15. `trigger-emergency-alert` sends SMS only to verified emergency contacts and logs dispatch outcomes.
16. `safety-maintenance` activates sessions, creates check-ins, escalates timeouts, and cleans emergency live-location state.
17. `emergency-live-location-view` serves tokenized external viewer links and returns inactive/expired states safely.
18. `get_safety_preferences_v2` and `update_safety_preferences_v2` are callable by authenticated users and persist `auto_record_safety_audio_on_visit`.
19. `create-safety-audio-upload-url` rejects non-Pro writes and returns signed upload URL + recording metadata row for Pro users.
20. `get-safety-audio-download-url` returns short-lived signed URLs only for owner-scoped Pro/grace users.
21. `safety-audio-cloud-maintenance` emits 30/7/1 notices, enforces 3-month auto-delete/auto-download lifecycle, and clears expired downgrade grace data.

## iOS native warning runbook
For iOS build warning policy, suppression boundaries, and warning-audit usage, see:
- `docs/ios-warning-policy.md`
- `docs/ios-warning-matrix.md`

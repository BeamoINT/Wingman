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

Security note: if a RevenueCat `sk_` secret key is ever shared in plaintext, rotate it after deployment and update `REVENUECAT_SECRET_API_KEY` immediately.

## Deploy sequence
1. Link the project and verify environment:
```bash
supabase link --project-ref <project-ref>
```
2. Apply migrations:
```bash
supabase db push
```
3. Deploy edge functions:
```bash
supabase functions deploy create-media-upload-url
supabase functions deploy get-media-download-url
supabase functions deploy revenuecat-webhook
supabase functions deploy sync-pro-entitlement
supabase functions deploy resolve-metro-area
supabase functions deploy get-directions
supabase functions deploy live-location-maintenance
supabase functions deploy create-id-verification-session
supabase functions deploy stripe-identity-webhook
supabase functions deploy id-verification-maintenance
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
```
5. Configure Stripe Identity webhook endpoint:
```bash
# Endpoint:
# https://<project-ref>.functions.supabase.co/stripe-identity-webhook
#
# Subscribe to identity.verification_session.* events.
```
6. Configure a daily scheduler to call maintenance:
```bash
# POST https://<project-ref>.functions.supabase.co/id-verification-maintenance
# Header: x-maintenance-secret: <ID_VERIFICATION_MAINTENANCE_SECRET>
```
7. Configure a 5-minute scheduler for live location cleanup:
```bash
# POST https://<project-ref>.functions.supabase.co/live-location-maintenance
# Header: x-maintenance-secret: <LIVE_LOCATION_MAINTENANCE_SECRET>
```
8. Verify function health with authenticated calls from a staging build.

## Validation checklist
1. `conversation_members` and `participant_ids` are present on `conversations`.
2. `message_device_identities`, `message_key_boxes`, `message_attachments` tables exist with RLS.
3. `get_or_create_direct_conversation_v2` RPC is callable by authenticated users.
4. RevenueCat webhook writes `subscription_events` and updates `profiles.subscription_tier`.
5. `resolve-metro-area` returns metro payloads for US city aliases (for example Franklin, TN -> Nashville Metro).
6. `create-id-verification-session` returns a Stripe Identity hosted URL for authenticated users with photo-ID attestation.
7. `stripe-identity-webhook` marks successful matches as `profiles.id_verification_status='verified'` with a 3-year expiry.
8. `id-verification-maintenance` marks expired users and sends 90/30/7/1-day Resend reminders.
9. `get-directions` returns recommended route + alternatives for authenticated users.
10. `live-location-maintenance` expires stale shares and removes expired points.

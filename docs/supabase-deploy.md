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
```
4. Set secrets:
```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=...
supabase secrets set REVENUECAT_SECRET_API_KEY=...
supabase secrets set REVENUECAT_WEBHOOK_AUTH=...
supabase secrets set REVENUECAT_ENTITLEMENT_PRO=pro
supabase secrets set GOOGLE_PLACES_API_KEY=...
```
5. Verify function health with authenticated calls from a staging build.

## Validation checklist
1. `conversation_members` and `participant_ids` are present on `conversations`.
2. `message_device_identities`, `message_key_boxes`, `message_attachments` tables exist with RLS.
3. `get_or_create_direct_conversation_v2` RPC is callable by authenticated users.
4. RevenueCat webhook writes `subscription_events` and updates `profiles.subscription_tier`.
5. `resolve-metro-area` returns metro payloads for US city aliases (for example Franklin, TN -> Nashville Metro).

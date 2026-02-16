# Production Runbook

## Alert thresholds
1. Messaging send failure rate > 3% for 15m.
2. Booking creation failure rate > 2% for 15m.
3. RevenueCat webhook non-2xx rate > 1% for 15m.
4. App crash-free users < 99.5% daily.

## Immediate rollback controls
Feature flags:
- `messages_v2_enabled`
- `messages_media_enabled`
- `group_event_chat_enabled`
- `friends_pro_model_enabled`
- `friends_ranked_list_enabled`
- `friends_connection_requests_enabled`

## Incident triage
1. Confirm if issue is app build, Supabase schema/function, or third-party dependency.
2. Check Sentry issue grouping and release tags.
3. Check Supabase logs for RPC/function/storage errors.
4. If data access fails, disable affected feature flag first, then patch.

## Recovery playbooks
### Messaging schema mismatch
1. Disable `messages_v2_enabled`.
2. Confirm latest migration applied in target project.
3. Re-enable after successful schema probe in app.

### Media upload/download failures
1. Disable `messages_media_enabled`.
2. Validate `message-media-encrypted` bucket policy and function secrets.
3. Re-enable after upload and signed URL checks pass.

### Pro entitlement drift
1. Validate RevenueCat webhook auth secret.
2. Run `sync-pro-entitlement` for affected users.
3. Confirm `profiles.subscription_tier`, `pro_status`, and `subscription_events`.

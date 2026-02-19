#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/artifacts/ios-warning-audit"
LOG_FILE="$OUT_DIR/build.log"
WARN_FILE="$OUT_DIR/warnings.log"
UNMATCHED_FILE="$OUT_DIR/unmatched-warnings.log"
REPORT_FILE="$OUT_DIR/report.md"
POD_LOG_FILE="$OUT_DIR/pod-install.log"
POD_SUMMARY_FILE="$OUT_DIR/pod-install-summary.txt"
ALLOWLIST_FILE="$ROOT_DIR/scripts/ios/warning-allowlist.txt"
DESTINATION="${IOS_SIMULATOR_DESTINATION:-generic/platform=iOS Simulator}"
SCHEME="${IOS_SCHEME:-Wingman}"
WORKSPACE="$ROOT_DIR/ios/Wingman.xcworkspace"
if [ -n "${IOS_WARNING_AUDIT_POD_MODE:-}" ]; then
  POD_MODE="${IOS_WARNING_AUDIT_POD_MODE}"
elif [ "${CI:-}" = "true" ]; then
  POD_MODE="deployment"
else
  POD_MODE="repo-update"
fi
if [ -n "${IOS_WARNING_AUDIT_POD_RETRIES:-}" ]; then
  POD_RETRIES="${IOS_WARNING_AUDIT_POD_RETRIES}"
elif [ "${CI:-}" = "true" ]; then
  POD_RETRIES="2"
else
  POD_RETRIES="1"
fi

mkdir -p "$OUT_DIR"
rm -f "$LOG_FILE" "$WARN_FILE" "$UNMATCHED_FILE" "$REPORT_FILE" "$POD_LOG_FILE" "$POD_SUMMARY_FILE"

if [ ! -d "$WORKSPACE" ]; then
  echo "iOS workspace not found, generating native iOS project..."
  (cd "$ROOT_DIR" && CI=1 npx expo prebuild --platform ios)
fi

if ! [[ "$POD_RETRIES" =~ ^[0-9]+$ ]] || [ "$POD_RETRIES" -lt 1 ]; then
  echo "Invalid IOS_WARNING_AUDIT_POD_RETRIES value: $POD_RETRIES"
  exit 1
fi

pod_install_args=("install")
case "$POD_MODE" in
  deployment)
    pod_install_args+=("--deployment")
    ;;
  repo-update)
    pod_install_args+=("--repo-update")
    ;;
  *)
    echo "Invalid IOS_WARNING_AUDIT_POD_MODE value: $POD_MODE"
    echo "Expected one of: deployment, repo-update"
    exit 1
    ;;
esac

echo "Installing CocoaPods dependencies (mode=$POD_MODE retries=$POD_RETRIES)..."
pod_status=1
pod_attempt=1
pod_attempts_used=0
while [ "$pod_attempt" -le "$POD_RETRIES" ]; do
  pod_attempts_used="$pod_attempt"
  echo "pod install attempt $pod_attempt/$POD_RETRIES"
  {
    echo "=== pod install attempt $pod_attempt/$POD_RETRIES ==="
    echo "mode=$POD_MODE"
    echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  } >> "$POD_LOG_FILE"

  set +e
  (
    cd "$ROOT_DIR/ios"
    pod "${pod_install_args[@]}"
  ) >> "$POD_LOG_FILE" 2>&1
  pod_status=$?
  set -e

  if [ "$pod_status" -eq 0 ]; then
    break
  fi

  if [ "$pod_attempt" -lt "$POD_RETRIES" ]; then
    sleep_seconds=$((pod_attempt * 2))
    echo "pod install failed with status $pod_status; retrying in ${sleep_seconds}s..."
    sleep "$sleep_seconds"
  fi

  pod_attempt=$((pod_attempt + 1))
done

{
  echo "mode=$POD_MODE"
  echo "retries=$POD_RETRIES"
  echo "attempts=$pod_attempts_used"
  echo "exit_code=$pod_status"
} > "$POD_SUMMARY_FILE"

if [ "$pod_status" -ne 0 ]; then
  echo "Failing audit: pod install failed with status $pod_status (mode=$POD_MODE, attempts=$pod_attempts_used/$POD_RETRIES)."
  echo "Recent pod install output:"
  tail -n 120 "$POD_LOG_FILE" || true
  exit "$pod_status"
fi

echo "Running canonical iOS warning audit build..."
set +e
(
  cd "$ROOT_DIR"
  xcodebuild \
    -workspace ios/Wingman.xcworkspace \
    -scheme "$SCHEME" \
    -configuration Debug \
    -destination "$DESTINATION" \
    build \
    CODE_SIGNING_ALLOWED=NO
) 2>&1 | tee "$LOG_FILE"
build_status=${PIPESTATUS[0]}
set -e

# Keep only top-level warning records (exclude snippet/context lines that contain "warning:").
rg "^[^ ].*:[0-9]+:[0-9]+: warning:|^Run script build phase .* warning:|^[^ ].* warning: The iOS Simulator deployment target" "$LOG_FILE" > "$WARN_FILE" || true
cp "$WARN_FILE" "$UNMATCHED_FILE"

total_warnings=$(wc -l < "$WARN_FILE" | tr -d ' ')
app_warning_count=$(rg -n "/ios/Wingman/|/Wingman/Wingman/" "$WARN_FILE" | wc -l | tr -d ' ' || true)

while IFS= read -r pattern || [ -n "$pattern" ]; do
  if [[ -z "$pattern" || "$pattern" == \#* ]]; then
    continue
  fi
  tmp_file="$(mktemp)"
  rg -v "$pattern" "$UNMATCHED_FILE" > "$tmp_file" || true
  mv "$tmp_file" "$UNMATCHED_FILE"
done < "$ALLOWLIST_FILE"

unmatched_count=$(wc -l < "$UNMATCHED_FILE" | tr -d ' ')

{
  echo "# iOS Warning Audit Report"
  echo
  echo "- Scheme: \`$SCHEME\`"
  echo "- Destination: \`$DESTINATION\`"
  echo "- Pod install mode: \`$POD_MODE\`"
  echo "- Pod install retries: \`$POD_RETRIES\`"
  echo "- Build status: **$build_status**"
  echo "- Total warnings: **$total_warnings**"
  echo "- App-owned warnings: **$app_warning_count**"
  echo "- Unmatched third-party warnings: **$unmatched_count**"
  echo
  echo "## Top Warning Families"
  echo
  if [ -s "$WARN_FILE" ]; then
    awk -F'\\[-W' '{if (NF>1) {split($2,a,"]"); print a[1]} else {print "unclassified"}}' "$WARN_FILE" \
      | sed '/^$/d' \
      | sort \
      | uniq -c \
      | sort -nr \
      | head -20 \
      | sed 's/^/- /'
  else
    echo "- none"
  fi
} > "$REPORT_FILE"

if [ "$build_status" -ne 0 ]; then
  echo "Failing audit: xcodebuild failed with status $build_status."
  rg -n "error:|\\*\\* BUILD FAILED \\*\\*" "$LOG_FILE" | sed -n '1,120p' || true
  exit "$build_status"
fi

if [ "$app_warning_count" -gt 0 ]; then
  echo "Failing audit: app-owned warnings detected."
  rg -n "/ios/Wingman/|/Wingman/Wingman/" "$WARN_FILE" | sed -n '1,50p'
  exit 1
fi

if [ "$unmatched_count" -gt 0 ]; then
  echo "Failing audit: unsanctioned third-party warnings detected."
  sed -n '1,100p' "$UNMATCHED_FILE"
  exit 1
fi

echo "iOS warning audit passed."

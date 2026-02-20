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
DESTINATION_REQUESTED="${IOS_SIMULATOR_DESTINATION:-generic/platform=iOS Simulator}"
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
if [ -n "${IOS_WARNING_AUDIT_POD_ALLOW_FALLBACK:-}" ]; then
  POD_ALLOW_FALLBACK="${IOS_WARNING_AUDIT_POD_ALLOW_FALLBACK}"
elif [ "${CI:-}" = "true" ]; then
  POD_ALLOW_FALLBACK="1"
else
  POD_ALLOW_FALLBACK="0"
fi
if [ -n "${IOS_WARNING_AUDIT_POD_FALLBACK_MODE:-}" ]; then
  POD_FALLBACK_MODE="${IOS_WARNING_AUDIT_POD_FALLBACK_MODE}"
else
  POD_FALLBACK_MODE="repo-update"
fi
if [ -n "${IOS_WARNING_AUDIT_POD_FALLBACK_RETRIES:-}" ]; then
  POD_FALLBACK_RETRIES="${IOS_WARNING_AUDIT_POD_FALLBACK_RETRIES}"
else
  POD_FALLBACK_RETRIES="1"
fi
if [ -n "${IOS_WARNING_AUDIT_RETRY_DESTINATION_ON_FAILURE:-}" ]; then
  RETRY_DESTINATION_ON_FAILURE="${IOS_WARNING_AUDIT_RETRY_DESTINATION_ON_FAILURE}"
else
  RETRY_DESTINATION_ON_FAILURE="1"
fi

mkdir -p "$OUT_DIR"
rm -f "$LOG_FILE" "$WARN_FILE" "$UNMATCHED_FILE" "$REPORT_FILE" "$POD_LOG_FILE" "$POD_SUMMARY_FILE"
echo "[ios-warning-audit] scheme=$SCHEME destination=$DESTINATION_REQUESTED workspace=$WORKSPACE"

if [ ! -d "$WORKSPACE" ]; then
  echo "iOS workspace not found, generating native iOS project..."
  (cd "$ROOT_DIR" && CI=1 npx expo prebuild --platform ios)
fi

if ! [[ "$POD_RETRIES" =~ ^[0-9]+$ ]] || [ "$POD_RETRIES" -lt 1 ]; then
  echo "Invalid IOS_WARNING_AUDIT_POD_RETRIES value: $POD_RETRIES"
  exit 1
fi
if ! [[ "$POD_FALLBACK_RETRIES" =~ ^[0-9]+$ ]] || [ "$POD_FALLBACK_RETRIES" -lt 1 ]; then
  echo "Invalid IOS_WARNING_AUDIT_POD_FALLBACK_RETRIES value: $POD_FALLBACK_RETRIES"
  exit 1
fi
if ! [[ "$POD_ALLOW_FALLBACK" =~ ^[01]$ ]]; then
  echo "Invalid IOS_WARNING_AUDIT_POD_ALLOW_FALLBACK value: $POD_ALLOW_FALLBACK"
  echo "Expected one of: 0, 1"
  exit 1
fi
if ! [[ "$RETRY_DESTINATION_ON_FAILURE" =~ ^[01]$ ]]; then
  echo "Invalid IOS_WARNING_AUDIT_RETRY_DESTINATION_ON_FAILURE value: $RETRY_DESTINATION_ON_FAILURE"
  echo "Expected one of: 0, 1"
  exit 1
fi
if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods is not installed or not available in PATH."
  exit 1
fi

POD_EXECUTABLE_VERSION="$(pod --version 2>/dev/null || echo unknown)"

pod_args_for_mode() {
  local mode="$1"
  case "$mode" in
    deployment)
      echo "install --deployment"
      ;;
    repo-update)
      echo "install --repo-update"
      ;;
    *)
      return 1
      ;;
  esac
}

discover_simulator_destination() {
  local destinations_output
  local simulator_id

  set +e
  destinations_output="$(
    cd "$ROOT_DIR" && \
    xcodebuild \
      -workspace ios/Wingman.xcworkspace \
      -scheme "$SCHEME" \
      -showdestinations \
      2>/dev/null
  )"
  local showdestinations_status=$?
  set -e

  if [ "$showdestinations_status" -ne 0 ]; then
    return 1
  fi

  simulator_id="$(
    printf '%s\n' "$destinations_output" | awk '
      /platform:iOS Simulator/ && /id:/ {
        if (match($0, /id:[^,}]*/)) {
          id = substr($0, RSTART + 3, RLENGTH - 3)
          gsub(/^[[:space:]]+|[[:space:]]+$/, "", id)
          if (id != "dvtdevice-DVTiOSDeviceSimulatorPlaceholder-iphonesimulator:placeholder") {
            print id
            exit
          }
        }
      }
    '
  )"

  if [ -z "$simulator_id" ]; then
    return 1
  fi

  printf 'id=%s' "$simulator_id"
}

run_xcodebuild() {
  local destination="$1"
  local log_mode="${2:-truncate}"

  if [ "$log_mode" = "truncate" ]; then
    : > "$LOG_FILE"
  fi

  set +e
  (
    cd "$ROOT_DIR"
    xcodebuild \
      -workspace ios/Wingman.xcworkspace \
      -scheme "$SCHEME" \
      -configuration Debug \
      -destination "$destination" \
      build \
      CODE_SIGNING_ALLOWED=NO
  ) 2>&1 | tee -a "$LOG_FILE"
  local status=${PIPESTATUS[0]}
  set -e
  return "$status"
}

run_pod_install() {
  local mode="$1"
  local retries="$2"
  local status=1
  local attempt=1
  local attempts_used=0
  local raw_args
  raw_args="$(pod_args_for_mode "$mode")" || return 2
  IFS=' ' read -r -a pod_install_args <<< "$raw_args"
  while [ "$attempt" -le "$retries" ]; do
    attempts_used="$attempt"
    echo "pod install ($mode) attempt $attempt/$retries"
    {
      echo "=== pod install ($mode) attempt $attempt/$retries ==="
      echo "mode=$mode"
      echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
      echo "pod_version=$POD_EXECUTABLE_VERSION"
    } >> "$POD_LOG_FILE"

    set +e
    (
      cd "$ROOT_DIR/ios"
      pod "${pod_install_args[@]}"
    ) >> "$POD_LOG_FILE" 2>&1
    status=$?
    set -e

    if [ "$status" -eq 0 ]; then
      break
    fi

    if [ "$attempt" -lt "$retries" ]; then
      local sleep_seconds=$((attempt * 2))
      echo "pod install ($mode) failed with status $status; retrying in ${sleep_seconds}s..."
      sleep "$sleep_seconds"
    fi

    attempt=$((attempt + 1))
  done

  POD_LAST_MODE="$mode"
  POD_LAST_STATUS="$status"
  POD_LAST_ATTEMPTS="$attempts_used"
}

if ! pod_args_for_mode "$POD_MODE" >/dev/null; then
  echo "Invalid IOS_WARNING_AUDIT_POD_MODE value: $POD_MODE"
  echo "Expected one of: deployment, repo-update"
  exit 1
fi
if ! pod_args_for_mode "$POD_FALLBACK_MODE" >/dev/null; then
  echo "Invalid IOS_WARNING_AUDIT_POD_FALLBACK_MODE value: $POD_FALLBACK_MODE"
  echo "Expected one of: deployment, repo-update"
  exit 1
fi

echo "Installing CocoaPods dependencies (mode=$POD_MODE retries=$POD_RETRIES fallback=$POD_ALLOW_FALLBACK pod=$POD_EXECUTABLE_VERSION)..."
POD_LAST_MODE=""
POD_LAST_STATUS=1
POD_LAST_ATTEMPTS=0
PRIMARY_POD_STATUS=1
PRIMARY_POD_ATTEMPTS=0
FALLBACK_POD_STATUS="not-run"
FALLBACK_POD_ATTEMPTS=0
FALLBACK_USED="0"

run_pod_install "$POD_MODE" "$POD_RETRIES"
PRIMARY_POD_STATUS="$POD_LAST_STATUS"
PRIMARY_POD_ATTEMPTS="$POD_LAST_ATTEMPTS"

if [ "$PRIMARY_POD_STATUS" -ne 0 ] && [ "$POD_ALLOW_FALLBACK" = "1" ] && [ "$POD_FALLBACK_MODE" != "$POD_MODE" ]; then
  FALLBACK_USED="1"
  echo "Primary pod install failed; attempting fallback mode '$POD_FALLBACK_MODE'..."
  run_pod_install "$POD_FALLBACK_MODE" "$POD_FALLBACK_RETRIES"
  FALLBACK_POD_STATUS="$POD_LAST_STATUS"
  FALLBACK_POD_ATTEMPTS="$POD_LAST_ATTEMPTS"
fi

pod_status="$POD_LAST_STATUS"
pod_mode_used="$POD_LAST_MODE"
pod_attempts_used="$POD_LAST_ATTEMPTS"

if [ "$PRIMARY_POD_STATUS" -eq 0 ]; then
  FALLBACK_POD_STATUS="not-needed"
  FALLBACK_POD_ATTEMPTS=0
fi

{
  echo "pod_version=$POD_EXECUTABLE_VERSION"
  echo "configured_mode=$POD_MODE"
  echo "configured_retries=$POD_RETRIES"
  echo "fallback_enabled=$POD_ALLOW_FALLBACK"
  echo "fallback_mode=$POD_FALLBACK_MODE"
  echo "fallback_retries=$POD_FALLBACK_RETRIES"
  echo "primary_exit_code=$PRIMARY_POD_STATUS"
  echo "primary_attempts=$PRIMARY_POD_ATTEMPTS"
  echo "fallback_used=$FALLBACK_USED"
  echo "fallback_exit_code=$FALLBACK_POD_STATUS"
  echo "fallback_attempts=$FALLBACK_POD_ATTEMPTS"
  echo "final_mode=$pod_mode_used"
  echo "final_attempts=$pod_attempts_used"
  echo "final_exit_code=$pod_status"
} > "$POD_SUMMARY_FILE"

if [ "$pod_status" -ne 0 ]; then
  echo "Failing audit: pod install failed with status $pod_status (final mode=$pod_mode_used, attempts=$pod_attempts_used)."
  echo "Recent pod install output:"
  tail -n 120 "$POD_LOG_FILE" || true
  exit "$pod_status"
fi

if [ "$FALLBACK_USED" = "1" ] && [ "$pod_mode_used" = "$POD_FALLBACK_MODE" ]; then
  echo "CocoaPods fallback mode '$POD_FALLBACK_MODE' succeeded after primary mode '$POD_MODE' failed."
fi

echo "Running canonical iOS warning audit build..."
destination_used="$DESTINATION_REQUESTED"
destination_fallback_used="0"

if run_xcodebuild "$destination_used" "truncate"; then
  build_status=0
else
  build_status=$?
fi

if { [ "$build_status" -eq 65 ] || [ "$build_status" -eq 70 ]; } && [ "$RETRY_DESTINATION_ON_FAILURE" = "1" ]; then
  fallback_candidates=()

  fallback_destination="$(discover_simulator_destination || true)"
  if [ -n "$fallback_destination" ] && [ "$fallback_destination" != "$destination_used" ]; then
    fallback_candidates+=("$fallback_destination")
  fi

  # Try the opposite generic platform next when destination resolution or signing context fails.
  if [[ "$DESTINATION_REQUESTED" == *"iOS Simulator"* ]]; then
    if [ "$destination_used" != "generic/platform=iOS" ]; then
      fallback_candidates+=("generic/platform=iOS")
    fi
  elif [ "$destination_used" != "generic/platform=iOS Simulator" ]; then
    fallback_candidates+=("generic/platform=iOS Simulator")
  fi

  for candidate in "${fallback_candidates[@]}"; do
    destination_fallback_used="1"
    destination_used="$candidate"
    echo "Retrying xcodebuild with fallback destination: $destination_used"
    {
      echo
      echo "=== Retrying xcodebuild with fallback destination: $destination_used ==="
    } >> "$LOG_FILE"
    if run_xcodebuild "$destination_used" "append"; then
      build_status=0
      break
    else
      build_status=$?
    fi
  done
fi

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
  echo "- Requested destination: \`$DESTINATION_REQUESTED\`"
  echo "- Final destination: \`$destination_used\`"
  echo "- Destination fallback used: \`$destination_fallback_used\`"
  echo "- CocoaPods version: \`$POD_EXECUTABLE_VERSION\`"
  echo "- Pod install configured mode: \`$POD_MODE\`"
  echo "- Pod install configured retries: \`$POD_RETRIES\`"
  echo "- Pod install fallback used: \`$FALLBACK_USED\`"
  echo "- Pod install final mode: \`$pod_mode_used\`"
  echo "- Pod install final attempts: \`$pod_attempts_used\`"
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

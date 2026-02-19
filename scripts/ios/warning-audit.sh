#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
OUT_DIR="$ROOT_DIR/artifacts/ios-warning-audit"
LOG_FILE="$OUT_DIR/build.log"
WARN_FILE="$OUT_DIR/warnings.log"
UNMATCHED_FILE="$OUT_DIR/unmatched-warnings.log"
REPORT_FILE="$OUT_DIR/report.md"
ALLOWLIST_FILE="$ROOT_DIR/scripts/ios/warning-allowlist.txt"
DESTINATION="${IOS_SIMULATOR_DESTINATION:-generic/platform=iOS Simulator}"
SCHEME="${IOS_SCHEME:-Wingman}"
WORKSPACE="$ROOT_DIR/ios/Wingman.xcworkspace"

mkdir -p "$OUT_DIR"
rm -f "$LOG_FILE" "$WARN_FILE" "$UNMATCHED_FILE" "$REPORT_FILE"

if [ ! -d "$WORKSPACE" ]; then
  echo "iOS workspace not found, generating native iOS project..."
  (cd "$ROOT_DIR" && CI=1 npx expo prebuild --platform ios)
fi

echo "Installing CocoaPods dependencies..."
(cd "$ROOT_DIR/ios" && pod install --repo-update >/dev/null)

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

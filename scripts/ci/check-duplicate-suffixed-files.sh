#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

declare -a offenders=()
while IFS= read -r -d '' path; do
  if [ ! -e "$ROOT_DIR/$path" ]; then
    continue
  fi
  filename="$(basename "$path")"
  if [[ "$filename" =~ [[:space:]][2-9][0-9]*\.[^./]+$ ]]; then
    offenders+=("$path")
  fi
done < <(git -C "$ROOT_DIR" ls-files -z)

if [ "${#offenders[@]}" -gt 0 ]; then
  echo "Found tracked duplicate-suffixed files (for example: \"File 2.ext\"):"
  for path in "${offenders[@]}"; do
    echo "  - $path"
  done
  echo "Remove or rename these files before merging."
  exit 1
fi

echo "No duplicate-suffixed tracked files detected."

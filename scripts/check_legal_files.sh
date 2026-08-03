#!/usr/bin/env bash
set -e
missing=0
for f in docs/terms.md docs/privacy.md docs/cookie.md docs/dpa.md docs/accessibility.md docs/security.md; do
  if [ ! -f "$f" ]; then
    echo "Missing $f"
    missing=1
  fi
done
if [ "$missing" -eq 1 ]; then
  echo "One or more legal docs are missing. Please add them."
  exit 2
fi
echo "All legal files present."
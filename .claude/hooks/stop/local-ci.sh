#!/usr/bin/env bash

echo ""
echo "Running: pnpm run local-ci"
output=$(pnpm run local-ci 2>&1)
if [ $? -eq 1 ]; then
  echo "" >&2
  echo "$output" >&2
  echo "" >&2
  echo "Please fix the issues above" >&2
  exit 2
fi

exit 0

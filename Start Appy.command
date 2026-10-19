#!/bin/bash

cd -- "$(dirname -- "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Appy needs Node.js 22.18 or newer. Install it, then open this file again."
  echo "If Node is installed through a shell manager, run npm start from your terminal."
  read -r -p "Press Return to close. "
  exit 1
fi

node scripts/start.mjs
status=$?
if [ "$status" -ne 0 ] && [ "$status" -ne 130 ] && [ "$status" -ne 143 ]; then
  read -r -p "Appy stopped. Press Return to close. "
fi
exit "$status"

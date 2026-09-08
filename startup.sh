#!/bin/sh
set -eu
cd "$(dirname "$0")"
# Filament is 4850. Local Vosk. Empty ear stays empty.
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:4850/health; then
  exit 0
fi
npm run dev >>/tmp/filament-ear.log 2>&1 &

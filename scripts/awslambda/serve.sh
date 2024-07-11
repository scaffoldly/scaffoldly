#!/bin/sh

set -e

if [ -z "$SLY_SERVE" ]; then
  echo "Missing SLY_SERVE environment variable"
  exit 1
fi

( $SLY_SERVE ) &
PID=$!

# Print the PID
echo "[awslambda-entrypoint] Started '${SLY_SERVE}' with PID $PID"

exec "$@"
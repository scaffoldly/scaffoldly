#!/bin/sh

set -e

if [ -z "$SLY_SERVE" ]; then
  echo "Missing SLY_SERVE environment variable"
  exit 1
fi

eval "$SLY_SERVE &"

echo "[awslambda-entrypoint] Started '${SLY_SERVE}'"

exec "$@"
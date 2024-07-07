#!/bin/sh

if [ -z "$SERVE_CMD" ]; then
  echo "Missing SERVE_CMD environment variable"
  exit 1
fi

( $SERVE_CMD ) &
PID=$!

# Print the PID
echo "[awslambda-bootstrap] Started '${SERVE_CMD}' with PID $PID"

exec "$@"
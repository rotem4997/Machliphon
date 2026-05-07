#!/bin/bash
# Usage: ./set-status.sh <agent> <status> <task> [progress]
# Example: ./set-status.sh backend-developer working "Building POST /api/substitutes" 30
AGENT="$1"
STATUS="$2"
TASK="$3"
PROGRESS="${4:-0}"
curl -s -X POST http://localhost:4040/api/status \
  -H "Content-Type: application/json" \
  -d "{\"$AGENT\":{\"status\":\"$STATUS\",\"task\":\"$TASK\",\"progress\":$PROGRESS}}" > /dev/null

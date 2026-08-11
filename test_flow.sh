#!/bin/bash
set -e

echo "--- 1. Health Checks ---"
curl -s http://localhost:3000/api/users/health | jq
curl -s http://localhost:3000/api/notifications/health | jq

echo "--- 2. Get JWT Token ---"
TOKEN=$(curl -s -X POST http://localhost:3000/auth/token \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@example.com"}' | jq -r '.token')
echo "Token: ${TOKEN:0:20}..."

echo "--- 3. Create User ---"
USER_JSON=$(curl -s -X POST http://localhost:3000/api/users \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"email":"john.doe@example.com","name":"John Doe"}')
echo "$USER_JSON" | jq
USER_ID=$(echo "$USER_JSON" | jq -r '.id')

echo "Waiting 2 seconds for event processing..."
sleep 2

echo "--- 4. Check Notifications for user.created ---"
curl -s "http://localhost:3000/api/notifications/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq

echo "--- 5. Update User ---"
UPDATE_JSON=$(curl -s -X PUT "http://localhost:3000/api/users/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"John Updated"}')
echo "$UPDATE_JSON" | jq

echo "Waiting 2 seconds for event processing..."
sleep 2

echo "--- 6. Check Notifications for user.updated ---"
curl -s "http://localhost:3000/api/notifications/$USER_ID" \
  -H "Authorization: Bearer $TOKEN" | jq


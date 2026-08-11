#!/bin/bash
set -e
export BASE_URL="http://localhost:3000"
TOKEN=$(curl -s -X POST $BASE_URL/auth/token -H 'Content-Type: application/json' -d '{"email":"test@example.com"}' | jq -r '.token')

echo "=== 9. Verify Duplicate Event Processing is Idempotent ==="
# We will create a user, wait for notification, then get the eventId and inject it directly into NATS to simulate a duplicate.
USER_JSON=$(curl -s -X POST $BASE_URL/api/users -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"email":"idempotent@example.com","name":"Idempotent User"}')
USER_ID=$(echo "$USER_JSON" | jq -r '.id')
sleep 3
NOTIFS=$(curl -s -X GET $BASE_URL/api/notifications/$USER_ID -H "Authorization: Bearer $TOKEN")
EVENT_ID=$(echo "$NOTIFS" | jq -r '.notifications[0].eventId')
NOTIF_ID=$(echo "$NOTIFS" | jq -r '.notifications[0].id')
echo "Original event ID: $EVENT_ID"
echo "Original notification ID: $NOTIF_ID"

# Inject duplicate event using a quick node script
cat << 'NODE' > inject_duplicate.js
const { connect, StringCodec } = require('nats');
async function run() {
  const nc = await connect({ servers: "nats://localhost:4222" });
  const js = await nc.jetstream();
  const sc = StringCodec();
  const event = {
    eventId: process.env.EVENT_ID,
    eventType: "user.created",
    timestamp: new Date().toISOString(),
    correlationId: "duplicate-test",
    data: {
      userId: process.env.USER_ID,
      email: "idempotent@example.com",
      name: "Idempotent User",
      createdAt: new Date().toISOString()
    }
  };
  await js.publish("user.created", sc.encode(JSON.stringify(event)));
  console.log("Duplicate event published to NATS");
  await nc.close();
}
run().catch(console.error);
NODE
npm install nats --no-save > /dev/null
EVENT_ID=$EVENT_ID USER_ID=$USER_ID node inject_duplicate.js
sleep 3

# Check notifications again, there should still only be 1 notification
NOTIF_COUNT=$(curl -s -X GET $BASE_URL/api/notifications/$USER_ID -H "Authorization: Bearer $TOKEN" | jq '.notifications | length')
if [ "$NOTIF_COUNT" -eq 1 ]; then
    echo "PASS: Idempotency verified. Duplicate event ignored."
else
    echo "FAIL: Expected 1 notification, found $NOTIF_COUNT."
    exit 1
fi

echo "=== 10. Failure/Retry Scenario ==="
# Edit .env temporarily
sed -i.bak 's/SIMULATE_FAILURE_EVERY_N=.*/SIMULATE_FAILURE_EVERY_N=2/' .env || echo "SIMULATE_FAILURE_EVERY_N=2" >> .env
# Restart notification service to pick up the env var
docker compose up -d --build notification-service
sleep 5
until docker compose ps | grep notification-service | grep healthy; do sleep 1; done

# Since it fails every 2nd event (counting from startup), the very first event processed should succeed, and the second should fail.
echo "Creating user F1 (should succeed)..."
F1_JSON=$(curl -s -X POST $BASE_URL/api/users -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"email":"f1@example.com","name":"F1"}')
F1_ID=$(echo "$F1_JSON" | jq -r '.id')
sleep 2

echo "Creating user F2 (should fail on 1st try)..."
F2_JSON=$(curl -s -X POST $BASE_URL/api/users -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"email":"f2@example.com","name":"F2"}')
F2_ID=$(echo "$F2_JSON" | jq -r '.id')
sleep 2

# Check F2 notifications - should be 0 because it failed
F2_COUNT=$(curl -s -X GET $BASE_URL/api/notifications/$F2_ID -H "Authorization: Bearer $TOKEN" | jq '.notifications | length')
if [ "$F2_COUNT" -eq 0 ]; then
    echo "PASS: Second event failed as expected (simulated failure)"
else
    echo "FAIL: Second event unexpectedly succeeded on first try. Count: $F2_COUNT"
fi

# Wait for NATS to redeliver (AckWait is 30s)
echo "Waiting 35 seconds for NATS to redeliver the failed event..."
sleep 35

# Check F2 notifications again - should be 1
F2_COUNT_RETRY=$(curl -s -X GET $BASE_URL/api/notifications/$F2_ID -H "Authorization: Bearer $TOKEN" | jq '.notifications | length')
if [ "$F2_COUNT_RETRY" -eq 1 ]; then
    echo "PASS: Second event was successfully redelivered and processed!"
else
    echo "FAIL: Event was not redelivered or failed again. Count: $F2_COUNT_RETRY"
fi

# Restore .env
mv .env.bak .env || sed -i '' '/SIMULATE_FAILURE/d' .env
docker compose up -d --build notification-service


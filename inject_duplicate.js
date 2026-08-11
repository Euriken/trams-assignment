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

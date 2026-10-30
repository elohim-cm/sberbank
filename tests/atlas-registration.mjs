import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import nextEnv from "@next/env";
import { setServers } from "node:dns/promises";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
if (process.env.MONGODB_DNS_SERVERS) setServers(process.env.MONGODB_DNS_SERVERS.split(",").map(value => value.trim()).filter(Boolean));
const uri = process.env.DATABASE_MONGODB_URI || process.env.MONGODB_URI;
assert.ok(uri, "Set DATABASE_MONGODB_URI in .env.local before this integration test.");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000 });
const db = client.db(process.env.MONGODB_DB || "bank");
const run = randomUUID();
const emails = [`atlas-integration-${run}-a@example.invalid`, `atlas-integration-${run}-b@example.invalid`];
const sample = (index, product) => ({
  lastName: `AtlasIntegration-${run}`, firstName: index === 0 ? "FirstAccount" : "SecondAccount",
  birth: "1990-01-21", citizenship: "Test citizenship", residence: "Test country",
  city: "Test city", address: "Test address", email: emails[index], phone: "+7 (900) 000-00-01",
  occupation: "Наёмный работник", income: "42000,50", product,
});

async function request(path, { method = "GET", body, cookie, origin } = {}) {
  return fetch(`${base}${path}`, {
    method, redirect: "manual", signal: AbortSignal.timeout(45_000),
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function runTest() {
let connected = false;
try {
  await client.connect();
  connected = true;
  await db.command({ ping: 1 });
  console.log("PASS: Atlas connection.");
  assert.equal((await request("/api/account")).status, 401);
  assert.equal((await request("/api/accounts", { method: "POST", body: {}, origin: "https://example.invalid" })).status, 403);
  assert.equal((await request("/api/accounts", { method: "POST", body: { ...sample(0, "virtual"), email: "invalid" } })).status, 400);
  assert.equal(await db.collection("accounts").countDocuments({ email: { $in: emails } }), 0);
  console.log("PASS: anonymous access, foreign origin and invalid form rejected.");

  const created = [];
  for (const [index, product] of ["virtual", "credit"].entries()) {
    const input = sample(index, product);
    const response = await request("/api/accounts", { method: "POST", body: { ...input, balance: 999999, kycStatus: "approved" } });
    assert.equal(response.status, 201, "Account creation must be acknowledged by Atlas.");
    const result = await response.json();
    const cookieHeader = response.headers.get("set-cookie") || "";
    assert.match(cookieHeader, /HttpOnly/i);
    assert.match(cookieHeader, /SameSite=Lax/i);
    const cookie = cookieHeader.split(";")[0];
    assert.match(cookie, /^bank_session=[a-f0-9]{64}$/);
    const document = await db.collection("accounts").findOne({ _id: new ObjectId(result.profile.id) });
    assert.ok(document);
    for (const [key, value] of Object.entries(input)) assert.equal(document[key], value, `Persisted field ${key}`);
    assert.equal(document.kycStatus, "not_started");
    assert.equal(document.balance, undefined);
    assert.equal(result.profile.balance, 0);
    const token = cookie.slice("bank_session=".length);
    const sessionHash = createHash("sha256").update(token).digest("hex");
    assert.ok(await db.collection("sessions").findOne({ _id: sessionHash, accountId: document._id }));
    assert.equal(await db.collection("sessions").countDocuments({ _id: token }), 0);
    for (let reload = 0; reload < 2; reload++) {
      const current = await request("/api/account", { cookie });
      assert.equal(current.status, 200);
      assert.match(current.headers.get("cache-control") || "", /no-store/);
      const loaded = (await current.json()).profile;
      for (const key of ["id", "name", "firstName", "lastName", "birth", "city", "address", "email", "phone", "citizenship", "residence", "occupation", "income", "product"]) assert.equal(loaded[key], result.profile[key], `Reloaded field ${key}`);
    }
    created.push({ cookie, profile: result.profile });
    console.log(`PASS: ${product} account - all registration fields verified directly in Atlas and reread through the authenticated API.`);
  }

  const duplicate = await request("/api/accounts", { method: "POST", body: { ...sample(0, "credit"), email: emails[0].toUpperCase() } });
  assert.equal(duplicate.status, 409);
  for (const [index, account] of created.entries()) {
    const other = created[1 - index];
    const current = await request(`/api/account?profile=${other.profile.id}`, { cookie: account.cookie });
    assert.equal((await current.json()).profile.id, account.profile.id);
    const dashboard = await request(`/dashboard?section=profile&profile=${other.profile.id}&product=${other.profile.product}`, { cookie: account.cookie });
    assert.equal(dashboard.status, 200);
    const html = await dashboard.text();
    assert.ok(html.includes(account.profile.email), "Dashboard must show the session owner's stored profile.");
    assert.ok(!html.includes(other.profile.email), "Dashboard must not expose the other account.");
    for (const text of [account.profile.name, account.profile.birth, account.profile.city, account.profile.address, account.profile.phone, account.profile.citizenship, account.profile.residence, account.profile.occupation, account.profile.income]) assert.ok(html.includes(text), "Dashboard field must come from the persisted account.");
  }
  assert.equal((await request("/api/account", { cookie: `bank_session=${"a".repeat(64)}` })).status, 401);
  console.log("PASS: dashboard reload, duplicate email, account isolation and forged session checks.");
  assert.equal((await request("/api/account", { method: "DELETE", cookie: created[0].cookie })).status, 200);
  assert.equal((await request("/api/account", { cookie: created[0].cookie })).status, 401);
  assert.equal((await request("/api/account", { cookie: created[1].cookie })).status, 200);
  assert.equal(await db.collection("accounts").countDocuments({ email: { $in: emails } }), 2);
  console.log("PASS: logout invalidates only its session and preserves saved accounts.");
} finally {
  // Delete only records with the two unique emails generated by this test run.
  try {
    if (connected) {
      const documents = await db.collection("accounts").find({ email: { $in: emails } }, { projection: { _id: 1 } }).toArray();
      await db.collection("sessions").deleteMany({ accountId: { $in: documents.map(document => document._id) } });
      await db.collection("accounts").deleteMany({ email: { $in: emails } });
      console.log("Test records removed; existing accounts untouched.");
    }
  } finally { await client.close(); }
}
}

runTest().catch(error => {
  // Driver errors can contain connection details; print assertion messages only.
  console.error(error?.name === "AssertionError" ? error.message : `Atlas integration test failed (${error?.name || "Error"}). Connection details hidden.`);
  process.exitCode = 1;
});

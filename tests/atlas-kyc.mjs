import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { MongoClient, ObjectId } from "mongodb";
import { setServers } from "node:dns/promises";
import sharp from "sharp";
import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
if (process.env.MONGODB_DNS_SERVERS) setServers(process.env.MONGODB_DNS_SERVERS.split(",").map(value => value.trim()).filter(Boolean));
const client = new MongoClient(process.env.DATABASE_MONGODB_URI || process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000, maxPoolSize: 2 });
const db = client.db(process.env.MONGODB_DB || "bank");
const base = process.env.TEST_BASE_URL || "http://localhost:3000";
const runId = randomUUID();
const emails = [0, 1, 2].map(index => `kyc-integration-${runId}-${index}@example.invalid`);
const jsonRequest = async (path, method = "GET", body, cookie, origin) => fetch(base + path, {
  method, redirect: "manual", signal: AbortSignal.timeout(60_000),
  headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

async function main() {
  let connected = false;
  try {
    await client.connect(); connected = true;
    // Synthetic solid-colour images only; no identity documents or real faces.
    const document = await sharp({ create: { width: 640, height: 400, channels: 3, background: "#77b99b" } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const selfie = await sharp({ create: { width: 320, height: 320, channels: 3, background: "#96bdde" } }).png().toBuffer();
    async function upload(requestId, slot, cookie, bytes = document, type = "image/jpeg") {
      const form = new FormData();
      form.set("requestId", requestId); form.set("slot", slot);
      form.set("file", new Blob([bytes], { type }), "synthetic-test-image");
      return fetch(base + "/api/account/kyc/files", { method: "POST", headers: cookie ? { Cookie: cookie } : {}, body: form, signal: AbortSignal.timeout(60_000) });
    }
    assert.equal((await jsonRequest("/api/account/kyc")).status, 401);
    assert.equal((await jsonRequest("/api/account/kyc", "POST", { documentKind: "identity", gender: "male" })).status, 401);
    assert.equal((await jsonRequest("/api/account/kyc/submit", "POST", { requestId: new ObjectId().toHexString() })).status, 401);
    const accounts = [];
    for (const [index, documentKind] of ["identity", "passport", "licence"].entries()) {
      const response = await jsonRequest("/api/accounts", "POST", {
        lastName: `KycIntegration-${runId}`, firstName: `Synthetic-${index}`, birth: "1990-01-21",
        citizenship: "Test country", residence: "Test country", city: "Test city", address: "Test address",
        email: emails[index], phone: "+7 (900) 000-00-01", occupation: "Наёмный работник", income: "0", product: "virtual",
      });
      assert.equal(response.status, 201);
      const profile = (await response.json()).profile;
      const cookie = response.headers.get("set-cookie").split(";")[0];
      accounts.push({ profile, cookie });
      assert.equal((await jsonRequest("/api/account/kyc", "POST", { documentKind, gender: "male" }, cookie, "https://example.invalid")).status, 403);
      let draft = await jsonRequest("/api/account/kyc", "POST", { documentKind, gender: "male" }, cookie);
      assert.equal(draft.status, 200);
      let requestId = (await draft.json()).requestId;
      const repeated = await jsonRequest("/api/account/kyc", "POST", { documentKind, gender: "male" }, cookie);
      assert.equal((await repeated.json()).requestId, requestId);
      assert.equal((await upload(requestId, "front", undefined)).status, 401);
      assert.equal((await upload(requestId, "selfie", cookie, selfie, "image/png")).status, 409);
      assert.equal((await jsonRequest("/api/account/kyc/submit", "POST", { requestId }, cookie)).status, 409);
      assert.equal((await upload(requestId, "front", cookie, Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).status, 400);
      assert.equal((await upload(requestId, "front", cookie, Buffer.alloc(3 * 1024 * 1024 + 1))).status, 413);
      assert.equal(await db.collection("kyc_files").countDocuments({ accountId: new ObjectId(profile.id) }), 0);

      // Switching types discards only this account's previous unfinished images;
      // stale requests cannot upload to the new draft.
      if (documentKind === "licence") {
        const old = requestId;
        const stored = await upload(old, "front", cookie);
        assert.equal(stored.status, 200);
        const oldFile = (await stored.json()).fileId;
        const switched = await jsonRequest("/api/account/kyc", "POST", { documentKind: "passport", gender: "male" }, cookie);
        assert.notEqual((await switched.json()).requestId, old);
        assert.equal((await upload(old, "front", cookie)).status, 404);
        assert.equal((await jsonRequest(`/api/account/kyc/files/${oldFile}`, "GET", undefined, cookie)).status, 404);
        draft = await jsonRequest("/api/account/kyc", "POST", { documentKind, gender: "male" }, cookie);
        requestId = (await draft.json()).requestId;
      }

      const slots = documentKind === "passport" ? ["front"] : ["back", "front"];
      const savedIds = {};
      for (const slot of slots) {
        const uploaded = await upload(requestId, slot, cookie);
        assert.equal(uploaded.status, 200);
        savedIds[slot] = (await uploaded.json()).fileId;
      }
      if (documentKind === "passport") assert.equal((await upload(requestId, "back", cookie)).status, 400);
      // Retrying a side replaces its image rather than creating extra files.
      assert.equal((await upload(requestId, "front", cookie)).status, 200);
      assert.equal(await db.collection("kyc_files").countDocuments({ requestId: new ObjectId(requestId) }), slots.length);
      assert.equal((await jsonRequest("/api/account/kyc/submit", "POST", { requestId }, cookie)).status, 409);
      assert.equal((await jsonRequest("/api/account", "GET", undefined, cookie).then(r => r.json())).profile.kycStatus, "not_started");
      const uploadedSelfie = await upload(requestId, "selfie", cookie, selfie, "image/png");
      assert.equal(uploadedSelfie.status, 200);
      savedIds.selfie = (await uploadedSelfie.json()).fileId;
      for (const slot of [...slots, "selfie"]) {
        const file = await db.collection("kyc_files").findOne({ _id: new ObjectId(savedIds[slot]) });
        assert.ok(file?.bytes);
        assert.equal(file.accountId.toHexString(), profile.id);
        assert.equal(file.requestId.toHexString(), requestId);
        assert.equal(file.slot, slot);
        const view = await jsonRequest(`/api/account/kyc/files/${savedIds[slot]}`, "GET", undefined, cookie);
        assert.equal(view.status, 200);
        assert.equal(view.headers.get("content-type"), "image/jpeg");
        assert.match(view.headers.get("cache-control"), /private, no-store/);
        const metadata = await sharp(Buffer.from(await view.arrayBuffer())).metadata();
        assert.ok(metadata.width >= 100 && metadata.height >= 100);
        assert.equal(metadata.exif, undefined);
        assert.equal((await jsonRequest(`/api/account/kyc/files/${savedIds[slot]}`)).status, 401);
      }
      const submitted = await jsonRequest("/api/account/kyc/submit", "POST", { requestId }, cookie);
      assert.equal(submitted.status, 200);
      assert.equal((await submitted.json()).status, "pending");
      assert.equal((await jsonRequest("/api/account/kyc/submit", "POST", { requestId }, cookie)).status, 200);
      assert.equal((await upload(requestId, "front", cookie)).status, 409);
      assert.equal((await jsonRequest("/api/account/kyc", "POST", { documentKind, gender: "male" }, cookie)).status, 409);
      const persisted = await db.collection("accounts").findOne({ _id: new ObjectId(profile.id) });
      assert.equal(persisted.kycStatus, "pending");
      const request = await db.collection("kyc_requests").findOne({ _id: new ObjectId(requestId) });
      assert.equal(request.status, "pending");
      assert.equal(await db.collection("email_notifications").countDocuments({ accountId: new ObjectId(profile.id), "event.kind": "account_created" }), 1);
      assert.equal(await db.collection("email_notifications").countDocuments({ accountId: new ObjectId(profile.id), "event.kind": "kyc_received" }), 1);
      assert.ok(request.submittedAt instanceof Date);
      assert.equal((await jsonRequest("/api/account", "GET", undefined, cookie).then(r => r.json())).profile.kycStatus, "pending");
      const dashboard = await jsonRequest("/dashboard", "GET", undefined, cookie);
      const html = await dashboard.text();
      assert.ok(html.includes("Документы получены. Проверка в процессе"));
      assert.ok(!html.includes(">Пройти проверку KYC</button>"));
      if (index > 0) {
        const other = accounts[0];
        assert.equal((await jsonRequest(`/api/account/kyc/files/${savedIds.selfie}`, "GET", undefined, other.cookie)).status, 404);
        assert.equal((await jsonRequest("/api/account/kyc/submit", "POST", { requestId }, other.cookie)).status, 404);
        assert.equal((await upload(requestId, "front", other.cookie)).status, 404);
      }
      console.log(`PASS: ${documentKind} - required document sides, selfie, real Atlas persistence, protected image retrieval and server pending status.`);
    }
    console.log("PASS: incomplete dossiers, invalid images, oversized uploads, stale drafts, duplicate submissions and cross-account access checked.");
  } finally {
    if (connected) {
      const documents = await db.collection("accounts").find({ email: { $in: emails } }, { projection: { _id: 1 } }).toArray();
      const ids = documents.map(item => item._id);
      await db.collection("email_notifications").deleteMany({ accountId: { $in: ids } });
      await db.collection("kyc_files").deleteMany({ accountId: { $in: ids } });
      await db.collection("kyc_requests").deleteMany({ accountId: { $in: ids } });
      await db.collection("sessions").deleteMany({ accountId: { $in: ids } });
      await db.collection("accounts").deleteMany({ email: { $in: emails } });
      console.log("Synthetic accounts, requests and images removed; existing dossiers untouched.");
    }
    await client.close();
  }
}

main().catch(error => {
  console.error(error?.name === "AssertionError" ? error.message : `KYC integration test failed (${error?.name || "Error"}). Connection details hidden.`);
  process.exitCode = 1;
});

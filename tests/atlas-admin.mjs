import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { setServers } from "node:dns/promises";
import { MongoClient, ObjectId } from "mongodb";
import nextEnv from "@next/env";
import sharp from "sharp";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
if (process.env.MONGODB_DNS_SERVERS) setServers(process.env.MONGODB_DNS_SERVERS.split(",").map(value => value.trim()).filter(Boolean));
const uri = process.env.DATABASE_MONGODB_URI || process.env.MONGODB_URI;
assert.ok(uri, "Configure the Atlas connection before this test.");
const client = new MongoClient(uri, { maxPoolSize: 2, serverSelectionTimeoutMS: 10_000, connectTimeoutMS: 10_000 });
const db = client.db(process.env.MONGODB_DB || "bank");
const local = process.env.TEST_BASE_URL || "http://localhost:3000";
const production = "http://127.0.0.1:3002";
const run = randomUUID();
const code = randomBytes(32).toString("hex");
const emails = [0, 1].map(index => `admin-integration-${run}-${index}@example.invalid`);
const profile = index => ({ firstName: "AdminIntegration", lastName: `Synthetic-${run}-${index}`, email: emails[index], birth: "1990-01-21", citizenship: "Test", residence: "Test", city: "Test", address: "Test address", phone: "+79000000001", occupation: "Наёмный работник", income: "0", product: "virtual" });
let server;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function request(base, path, { method = "GET", body, cookie, origin, headers = {} } = {}) {
  return fetch(`${base}${path}`, { method, redirect: "manual", signal: AbortSignal.timeout(60_000), headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...(cookie ? { Cookie: cookie } : {}), ...(method !== "GET" ? { Origin: origin || base } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
}

async function main() {
  let connected = false;
  try {
    await client.connect(); connected = true;
    server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", "3002", "-H", "127.0.0.1"], { env: { ...process.env, NODE_ENV: "production", ADMIN_ACCESS_CODE: code }, stdio: "ignore", windowsHide: true });
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      if (server.exitCode !== null) throw new Error("Production test server exited");
      try { if ((await request(production, "/sberbank/admin/api/overview")).status === 401) { ready = true; break; } } catch { /* Wait for the isolated test server. */ }
      await sleep(500);
    }
    assert.ok(ready, "Production test server must start on port 3002");
    const page = await request(production, "/sberbank/admin");
    const html = await page.text();
    assert.ok(html.includes("Доступ администратора"));
    assert.ok(!html.includes(code), "The access code must never be serialized");
    assert.equal((await request(production, "/sberbank/admin/api/accounts/" + new ObjectId())).status, 401);
    assert.equal((await request(production, "/sberbank/admin/api/files/" + new ObjectId())).status, 401);
    assert.equal((await request(production, "/sberbank/admin/api/overview", { headers: { "x-forwarded-host": "localhost:3002" } })).status, 401);
    assert.equal((await request(production, "/sberbank/admin/api/auth", { method: "POST", body: { code: "wrong" } })).status, 401);
    assert.equal((await request(production, "/sberbank/admin/api/auth", { method: "POST", body: { code }, origin: "https://foreign.example" })).status, 403);
    const login = await request(production, "/sberbank/admin/api/auth", { method: "POST", body: { code } });
    assert.equal(login.status, 200);
    const setCookie = login.headers.get("set-cookie");
    for (const flag of [/HttpOnly/i, /Secure/i, /SameSite=strict/i, /Path=\/sberbank\/admin/i]) assert.match(setCookie, flag);
    const adminSession = setCookie.split(";")[0];
    assert.equal((await request(production, "/sberbank/admin/api/overview", { cookie: adminSession })).status, 200);
    assert.equal((await request(production, "/sberbank/admin/api/overview", { cookie: adminSession.slice(0, -1) + "x" })).status, 401);
    assert.equal((await request(local, "/sberbank/admin/api/overview")).status, 200, "Local development requires no admin account or code");
    console.log("PASS: production requires a code even on loopback; local dev is open; forged sessions and foreign origins rejected.");

    const created = [];
    const image = await sharp({ create: { width: 400, height: 260, channels: 3, background: "#deebe2" } }).jpeg().toBuffer();
    for (const index of [0, 1]) {
      const response = await request(local, "/api/accounts", { method: "POST", body: profile(index) });
      assert.equal(response.status, 201);
      const account = (await response.json()).profile;
      const cookie = response.headers.get("set-cookie").split(";")[0];
      assert.equal((await request(production, "/sberbank/admin/api/overview", { cookie })).status, 401, "A customer session is not an admin session");
      const draftResponse = await request(local, "/api/account/kyc", { method: "POST", cookie, body: { documentKind: "identity", gender: "male" } });
      assert.equal(draftResponse.status, 200);
      const { requestId } = await draftResponse.json();
      created.push({ id: new ObjectId(account.id), cookie, requestId });
      if (index === 1) {
        assert.equal((await request(production, `/sberbank/admin/api/kyc/${requestId}/approve`, { method: "POST", cookie: adminSession, body: { reviewed: true } })).status, 409);
        await db.collection("kyc_requests").updateOne({ _id: new ObjectId(requestId) }, { $set: { status: "pending", submittedAt: new Date() } });
        await db.collection("accounts").updateOne({ _id: created[index].id }, { $set: { kycStatus: "pending" } });
        assert.equal((await request(production, `/sberbank/admin/api/kyc/${requestId}/approve`, { method: "POST", cookie: adminSession, body: { reviewed: true } })).status, 409, "A corrupt incomplete submitted dossier must not be approved");
        continue;
      }
      for (const slot of ["front", "back", "selfie"]) {
        const form = new FormData(); form.set("requestId", requestId); form.set("slot", slot); form.set("file", new Blob([image], { type: "image/jpeg" }), `${slot}.jpg`);
        const upload = await fetch(`${local}/api/account/kyc/files`, { method: "POST", headers: { Origin: local, Cookie: cookie }, body: form, signal: AbortSignal.timeout(60_000) });
        assert.equal(upload.status, 200);
      }
      assert.equal((await request(local, "/api/account/kyc/submit", { method: "POST", cookie, body: { requestId } })).status, 200);
    }
    const { id, cookie, requestId } = created[0];
    const listing = await request(local, `/sberbank/admin/api/overview?status=pending&q=${encodeURIComponent(emails[0])}`).then(response => response.json());
    assert.equal(listing.total, 1); assert.equal(listing.accounts[0].id, id.toHexString());
    const detail = await request(production, `/sberbank/admin/api/accounts/${id}`, { cookie: adminSession }).then(response => response.json());
    assert.equal(detail.files.length, 3); assert.equal(detail.request.complete, true);
    assert.ok(!JSON.stringify(detail).includes('"bytes"'));
    for (const file of detail.files) {
      const download = await request(production, `/sberbank/admin/api/files/${file.id}?download=1`, { cookie: adminSession });
      assert.equal(download.status, 200); assert.match(download.headers.get("content-disposition"), /^attachment;/); assert.match(download.headers.get("cache-control"), /private, no-store/);
      assert.equal((await sharp(Buffer.from(await download.arrayBuffer())).metadata()).format, "jpeg");
    }
    const approval = `/sberbank/admin/api/kyc/${requestId}/approve`;
    const creditPath = `/sberbank/admin/api/accounts/${id}/credits`;
    const creditBody = amountMinor => ({ amountMinor, operationKey: randomUUID(), confirmed: true });
    assert.equal((await request(production, creditPath, { method: "POST", cookie: adminSession, body: creditBody(5000) })).status, 409, "Credit before KYC approval must be rejected");
    assert.equal((await request(production, approval, { method: "POST", body: { reviewed: true } })).status, 401);
    assert.equal((await request(production, approval, { method: "POST", cookie: adminSession, body: { reviewed: false } })).status, 400);
    assert.equal((await request(production, approval, { method: "POST", cookie: adminSession, origin: "https://foreign.example", body: { reviewed: true } })).status, 403);
    if (process.env.ADMIN_BROWSER_TEST === "1") {
      const { checkAdminBrowser } = await import("./admin-browser.mjs");
      await checkAdminBrowser(emails[0]);
    }
    const approvals = await Promise.all([0, 1].map(() => request(production, approval, { method: "POST", cookie: adminSession, body: { reviewed: true } })));
    assert.deepEqual(approvals.map(response => response.status), [200, 200]);
    assert.equal((await db.collection("accounts").findOne({ _id: id })).kycStatus, "approved");
    assert.equal((await db.collection("kyc_requests").findOne({ _id: new ObjectId(requestId) })).status, "approved");
    assert.equal(await db.collection("admin_audit").countDocuments({ accountId: id, action: "kyc_approved" }), 1);
    assert.equal(await db.collection("email_notifications").countDocuments({ accountId: id, "event.kind": "kyc_approved" }), 1);
    // Only this synthetic account's balance is seeded; no customer funds change.
    await db.collection("accounts").updateOne({ _id: id }, { $set: { balance: 100 } });
    const firstCredit = creditBody(5000);
    assert.equal((await request(production, creditPath, { method: "POST", body: firstCredit })).status, 401);
    assert.equal((await request(production, creditPath, { method: "POST", cookie, body: firstCredit })).status, 401);
    assert.equal((await request(production, creditPath, { method: "POST", cookie: adminSession, body: firstCredit, origin: "https://foreign.example" })).status, 403);
    for (const invalid of [0, -100, 0.5, "5000", null, Number.MAX_SAFE_INTEGER + 1]) assert.equal((await request(production, creditPath, { method: "POST", cookie: adminSession, body: { ...creditBody(1), amountMinor: invalid } })).status, 400);
    assert.equal((await request(production, creditPath, { method: "POST", cookie: adminSession, body: { ...firstCredit, confirmed: false } })).status, 400);
    assert.equal((await request(production, `/sberbank/admin/api/accounts/${created[1].id}/credits`, { method: "POST", cookie: adminSession, body: creditBody(5000) })).status, 409);
    const duplicateCredits = await Promise.all([0, 1].map(() => request(production, creditPath, { method: "POST", cookie: adminSession, body: firstCredit })));
    assert.deepEqual(duplicateCredits.map(response => response.status), [200, 200]);
    const receipts = await Promise.all(duplicateCredits.map(response => response.json()));
    assert.equal(receipts[0].transferId, receipts[1].transferId);
    assert.equal(receipts[0].balanceBeforeMinor, 10000);
    assert.equal(receipts[0].balanceAfterMinor, 15000);
    assert.equal((await request(production, creditPath, { method: "POST", cookie: adminSession, body: { ...firstCredit, amountMinor: 5100 } })).status, 409, "A retry key must not be reused for a different amount");
    assert.equal((await db.collection("accounts").findOne({ _id: id })).balance, 150);
    assert.equal((await request(production, creditPath, { method: "POST", cookie: adminSession, body: creditBody(2550) })).status, 200);
    const distinctCredits = await Promise.all([1, 2].map(amount => request(production, creditPath, { method: "POST", cookie: adminSession, body: creditBody(amount) })));
    assert.deepEqual(distinctCredits.map(response => response.status), [200, 200]);
    assert.equal((await db.collection("accounts").findOne({ _id: id })).balance, 175.53);
    assert.equal(await db.collection("incoming_transfers").countDocuments({ accountId: id, source: "admin_credit" }), 4);
    assert.equal(await db.collection("admin_audit").countDocuments({ accountId: id, action: "balance_credit" }), 4);
    assert.equal(await db.collection("email_notifications").countDocuments({ accountId: id, "event.kind": "incoming_transfer" }), 4);
    const updatedDetail = await request(production, `/sberbank/admin/api/accounts/${id}`, { cookie: adminSession }).then(response => response.json());
    assert.equal(updatedDetail.account.balance, 175.53);
    assert.equal(updatedDetail.credits.length, 4);
    const customerProfile = await request(local, "/api/account", { cookie }).then(response => response.json());
    assert.equal(customerProfile.profile.balance, 175.53);
    assert.equal((await request(local, "/api/account/operations")).status, 401);
    const historyResponse = await request(local, "/api/account/operations", { cookie });
    assert.match(historyResponse.headers.get("cache-control"), /private, no-store/);
    const history = await historyResponse.json();
    assert.equal(history.items.length, 4);
    assert.deepEqual(history.items.map(item => item.amountMinor).sort((a, b) => a - b), [1, 2, 2550, 5000]);
    assert.equal(new Set(history.items.map(item => item.id)).size, 4, "Retried credits must appear once in customer history");
    assert.deepEqual(Object.keys(history.items[0]).sort(), ["amountMinor", "confirmedAt", "currency", "id"]);
    assert.equal(history.nextCursor, null);
    assert.equal((await request(local, `/api/account/operations?accountId=${id}`, { cookie: created[1].cookie }).then(r => r.json())).items.length, 0, "A customer cannot select another account's history");
    for (const cursor of ["", "bad!", "x".repeat(201), Buffer.from(JSON.stringify({ id: "invalid", date: "invalid" })).toString("base64url")]) assert.equal((await request(local, `/api/account/operations?cursor=${encodeURIComponent(cursor)}`, { cookie })).status, 400);
    const operationsHtml = await request(local, "/dashboard?section=transactions", { cookie }).then(r => r.text());
    assert.ok(operationsHtml.includes("Зачисление на счёт"));
    assert.ok(!operationsHtml.includes("Операций пока нет."));
    assert.ok(!operationsHtml.includes("ADM-"), "Internal transfer references must not be exposed in the dashboard");
    console.log("PASS: administrator credits visible once in customer operations, empty second account, private responses and no internal metadata exposed.");
    if (process.env.ADMIN_BROWSER_TEST === "1") {
      const { checkAdminBrowser } = await import("./admin-browser.mjs");
      await checkAdminBrowser(emails[0], { credit: true });
      assert.equal((await db.collection("accounts").findOne({ _id: id })).balance, 187.87);
      assert.equal(await db.collection("incoming_transfers").countDocuments({ accountId: id, source: "admin_credit" }), 5);
      assert.equal(await db.collection("email_notifications").countDocuments({ accountId: id, "event.kind": "incoming_transfer" }), 5);
    }
    assert.equal((await db.collection("accounts").findOne({ _id: created[1].id })).balance, 0);
    console.log("PASS: approved KYC required, existing balance preserved, concurrent credits exact, retries deduplicated, transfer/audit/email atomic and customer balance reread.");
    const dashboard = await request(local, "/dashboard", { cookie }).then(response => response.text());
    assert.ok(dashboard.includes("Личность подтверждена"));
    assert.ok(!dashboard.includes('aria-label="Карты: доступ ограничен"'));
    assert.ok(!dashboard.includes(">Пройти проверку KYC</button>"));
    assert.equal((await request(local, "/api/account/kyc", { method: "POST", cookie, body: { documentKind: "passport", gender: "male" } })).status, 409, "Approved documents must not be replaced");
    assert.equal((await request(local, "/api/account/kyc/submit", { method: "POST", cookie, body: { requestId } })).status, 409, "A stale customer request must not reset approval");
    const refused = created[1];
    const refusal = `/sberbank/admin/api/kyc/${refused.requestId}/reject`;
    const reason = "Фотографии нечёткие. Загрузите документ повторно";
    assert.equal((await request(production, refusal, { method: "POST", body: { reviewed: true, reason } })).status, 401);
    assert.equal((await request(production, refusal, { method: "POST", cookie: refused.cookie, body: { reviewed: true, reason } })).status, 401);
    assert.equal((await request(production, refusal, { method: "POST", cookie: adminSession, origin: "https://foreign.example", body: { reviewed: true, reason } })).status, 403);
    for (const invalid of [undefined, "", "ab", "x".repeat(501), 42]) assert.equal((await request(production, refusal, { method: "POST", cookie: adminSession, body: { reviewed: true, reason: invalid } })).status, 400);
    assert.equal((await request(production, refusal, { method: "POST", cookie: adminSession, body: { reviewed: false, reason } })).status, 400);
    const refusals = await Promise.all([0, 1].map(() => request(production, refusal, { method: "POST", cookie: adminSession, body: { reviewed: true, reason } })));
    assert.deepEqual(refusals.map(response => response.status), [200, 200]);
    assert.equal((await db.collection("accounts").findOne({ _id: refused.id })).kycStatus, "rejected");
    assert.equal((await db.collection("kyc_requests").findOne({ _id: new ObjectId(refused.requestId) })).rejectionReason, reason);
    assert.equal(await db.collection("admin_audit").countDocuments({ accountId: refused.id, action: "kyc_rejected" }), 1);
    assert.equal(await db.collection("email_notifications").countDocuments({ accountId: refused.id, "event.kind": "kyc_rejected" }), 1);
    assert.equal((await request(production, `/sberbank/admin/api/kyc/${refused.requestId}/approve`, { method: "POST", cookie: adminSession, body: { reviewed: true } })).status, 409);
    const rejectedDashboard = await request(local, "/dashboard", { cookie: refused.cookie }).then(response => response.text());
    assert.ok(rejectedDashboard.includes("Заявка KYC не одобрена"));
    assert.ok(rejectedDashboard.includes(reason));
    const resubmit = await request(local, "/api/account/kyc", { method: "POST", cookie: refused.cookie, body: { documentKind: "passport", gender: "male" } });
    assert.equal(resubmit.status, 200);
    const newRequest = await resubmit.json();
    assert.notEqual(newRequest.requestId, refused.requestId);
    assert.equal((await db.collection("accounts").findOne({ _id: refused.id })).kycStatus, "not_started");
    assert.equal((await db.collection("email_notifications").findOne({ accountId: refused.id, "event.kind": "kyc_rejected" })).event.reason, reason);
    console.log("PASS: rejection authorization, required reason, atomic state/audit/email, concurrent retries, dashboard reason and fresh submission after rejection.");
    const timestamp = new Date(Date.now() + 1000);
    const paginationFixtures = Array.from({ length: 23 }, (_, index) => ({ _id: new ObjectId(), accountId: id, source: "history_integration", status: "confirmed", amountMinor: index + 100, currency: "RUB", confirmedAt: timestamp }));
    await db.collection("incoming_transfers").insertMany([...paginationFixtures,
      { _id: new ObjectId(), accountId: id, source: "history_integration", status: "pending", amountMinor: 999, currency: "RUB", confirmedAt: timestamp },
      { _id: new ObjectId(), accountId: id, source: "history_integration", status: "confirmed", amountMinor: 999, currency: "USD", confirmedAt: timestamp },
      { _id: new ObjectId(), accountId: id, source: "history_integration", status: "confirmed", amountMinor: 0.5, currency: "RUB", confirmedAt: timestamp },
    ]);
    const pages = [];
    let cursor;
    do {
      const page = await request(local, `/api/account/operations${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`, { cookie }).then(r => r.json());
      assert.ok(page.items.length <= 20);
      pages.push(...page.items);
      cursor = page.nextCursor;
      assert.ok(pages.length <= 28, "Pagination must terminate without duplicate rows");
    } while (cursor);
    const expectedCount = 23 + (process.env.ADMIN_BROWSER_TEST === "1" ? 5 : 4);
    assert.equal(pages.length, expectedCount);
    assert.equal(new Set(pages.map(item => item.id)).size, expectedCount);
    assert.deepEqual(pages.slice(0, 23).map(item => item.id), paginationFixtures.map(item => item._id.toHexString()).reverse(), "Equal timestamps must use a stable ID order across page boundaries");
    console.log("PASS: complete paginated customer history, stable ordering for equal dates, and pending/foreign-currency/fractional records excluded.");
    assert.equal((await request(production, "/sberbank/admin/api/auth", { method: "DELETE", cookie: adminSession })).headers.get("set-cookie").includes("Max-Age=0"), true);
    console.log("PASS: private photo download, complete-dossier checks, atomic approval/audit/email, concurrent retry and approved customer dashboard.");
  } finally {
    try {
      if (connected) {
        const accounts = await db.collection("accounts").find({ email: { $in: emails } }, { projection: { _id: 1 } }).toArray();
        const ids = accounts.map(account => account._id);
        for (const name of ["incoming_transfers", "email_notifications", "admin_audit", "kyc_files", "kyc_requests", "sessions"]) await db.collection(name).deleteMany({ accountId: { $in: ids } });
        await db.collection("accounts").deleteMany({ email: { $in: emails } });
        console.log("Synthetic admin-test dossiers removed; existing customer dossiers untouched. No real email sent.");
      }
    } finally { await client.close(); server?.kill(); }
  }
}

main().catch(error => {
  console.error(error?.name === "AssertionError" ? error.message : `Admin test failed (${error?.name || "Error"}). Connection details hidden.`);
  if (error?.name === "AssertionError") console.error(error.stack?.split("\n").find(line => line.includes("atlas-admin.mjs:"))?.trim() || "Assertion location unavailable");
  process.exitCode = 1;
});

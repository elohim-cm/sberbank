// Offline tests: every provider request and database operation is intercepted.
// No email is sent and no real account or environment file is accessed.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { ObjectId } from "mongodb";

const nativeRequire = createRequire(import.meta.url);
const collections = new Map();
const equals = (a, b) => a instanceof ObjectId ? a.equals(b) : a instanceof Date ? +a === +b : a === b;
const matches = (row, query) => Object.entries(query).every(([key, value]) => {
  const actual = row[key];
  if (value && typeof value === "object" && !(value instanceof Date) && !(value instanceof ObjectId)) {
    if ("$in" in value) return value.$in.some(item => equals(actual, item));
    if ("$lte" in value) return actual <= value.$lte;
    if ("$ne" in value) return !equals(actual, value.$ne);
  }
  return equals(actual, value);
});
const change = (row, update, inserting = false) => {
  if (inserting) Object.assign(row, update.$setOnInsert);
  Object.assign(row, update.$set);
  for (const key of Object.keys(update.$unset || {})) delete row[key];
  for (const [key, value] of Object.entries(update.$inc || {})) row[key] = (row[key] || 0) + value;
};
function collection(name) {
  if (collections.has(name)) return collections.get(name);
  const rows = [];
  const api = {
    rows, async createIndex() {},
    async findOne(query) { return rows.find(row => matches(row, query)) || null; },
    async updateOne(query, update, options = {}) {
      let row = rows.find(row => matches(row, query));
      if (!row && options.upsert) { row = { ...query }; rows.push(row); change(row, update, true); }
      else if (row) change(row, update);
    },
    async findOneAndUpdate(query, update) {
      const row = rows.find(row => matches(row, query));
      if (!row) return null;
      change(row, update);
      return { ...row };
    },
    find(query) {
      let selected = rows.filter(row => matches(row, query));
      return { sort() { return this; }, limit(n) { selected = selected.slice(0, n); return this; }, async toArray() { return selected; } };
    },
  };
  collections.set(name, api);
  return api;
}
const db = { collection };
const session = {};
const client = { async withSession(fn) { return fn({ async withTransaction(callback) { return callback(session); } }); } };
const env = { BREVO_SMTP_LOGIN: "synthetic@smtp-brevo.com", BREVO_SMTP_KEY: "fake-smtp-key", BREVO_SENDER_EMAIL: "notice@example.com", BREVO_SENDER_NAME: "Банк", APP_URL: "https://example.com", CRON_SECRET: "a".repeat(40) };
const accepted = mail => ({ messageId: mail.messageId, accepted: [mail.to[0].address], rejected: [] });
let providerResponse = accepted;
const requests = [];
const transports = [];
const mockNodemailer = { createTransport(options) { transports.push(options); return { async sendMail(mail) { requests.push(mail); return providerResponse(mail); } }; } };
async function mockFetch() { throw new Error("SMTP delivery must never use the HTTP API"); }
const loaded = new Map();
const afterTasks = [];
function load(file) {
  file = path.resolve(file);
  if (loaded.has(file)) return loaded.get(file).exports;
  const loadedModule = { exports: {} };
  loaded.set(file, loadedModule);
  const code = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  function requireModule(id) {
    if (file.endsWith(path.normalize("approve/route.ts"))) {
      if (id === "next/server") return { after: callback => afterTasks.push(callback) };
      if (id === "@/lib/server/admin") return { approveAdminKyc: async () => accountId };
      if (id === "@/lib/server/admin-access") return { requireAdminOrigin() {}, requireAdmin: async () => "local", adminErrorResponse(error) { throw error; } };
    }
    if (id === "server-only") return {};
    if (id === "nodemailer") return mockNodemailer;
    if (id === "./mongodb") return { getDatabase: async () => db, getMongoClient: async () => client };
    if (id.startsWith("@/")) return load(path.join("src", `${id.slice(2)}.ts`));
    if (id.startsWith(".")) return load(path.resolve(path.dirname(file), `${id}.ts`));
    return nativeRequire(id);
  }
  new Function("require", "module", "exports", "process", "fetch", code)(requireModule, loadedModule, loadedModule.exports, { env }, mockFetch);
  return loadedModule.exports;
}
const brevo = load("src/lib/server/brevo.ts");
const notifications = load("src/lib/server/notifications.ts");
const events = load("src/lib/server/notification-events.ts");
const cron = load("src/app/api/cron/notifications/route.ts");
const accountId = new ObjectId();
collection("accounts").rows.push({ _id: accountId, firstName: "<script>alert(1)</script>", email: "synthetic@example.com", kycStatus: "pending" });
const queue = collection("email_notifications");

for (const event of [{ kind: "account_created" }, { kind: "kyc_received" }, { kind: "kyc_approved" }, { kind: "kyc_rejected", reason: "Нечёткое фото <script>alert(1)</script>" }, { kind: "incoming_transfer", amountMinor: 123456, currency: "RUB", reference: "REF<123>" }]) {
  const rendered = brevo.emailContent(collection("accounts").rows[0], event, "Банк", "https://example.com/dashboard");
  assert.match(rendered.htmlContent, /lang="ru"/);
  assert.ok(!rendered.htmlContent.includes("<script>"));
  assert.ok(rendered.textContent.includes("Личный кабинет"));
  assert.match(rendered.htmlContent, /name="viewport"/);
  assert.match(rendered.htmlContent, /font-family:Arial,Helvetica,sans-serif/);
  assert.ok(!/<script|<iframe|<form|<input|<img\s/i.test(rendered.htmlContent));
  if (process.env.EMAIL_PREVIEWS === "1") {
    const directory = path.resolve("verification/email-previews");
    mkdirSync(directory, { recursive: true });
    const preview = brevo.emailContent({ firstName: "Александра", email: "preview@example.invalid" }, event.kind === "kyc_rejected" ? { kind: "kyc_rejected", reason: "На фотографии не видны края документа. Пожалуйста, загрузите новое изображение целиком." } : event, "SBERBANK", "https://example.com/dashboard");
    writeFileSync(path.join(directory, `${event.kind}.html`), preview.htmlContent, "utf8");
  }
}
assert.throws(() => brevo.emailContent({ firstName: "Test" }, { kind: "incoming_transfer", amountMinor: -1, currency: "RUB", reference: "ref" }, "Банк", "https://example.com"));
for (const reason of [undefined, null, 123, "", "  ", "ab", "x".repeat(501)]) assert.throws(() => brevo.emailContent({ firstName: "Test" }, { kind: "kyc_rejected", reason }, "Банк", "https://example.com"));
const rejection = brevo.emailContent({ firstName: "Test" }, { kind: "kyc_rejected", reason: "  Загрузите чёткое селфи <test>  " }, "Банк", "https://example.com");
assert.match(rejection.subject, /не одобрена/);
assert.match(rejection.textContent, /Загрузите чёткое селфи <test>/);
assert.match(rejection.htmlContent, /&lt;test&gt;/);
assert.match(rejection.textContent, /повторно отправьте документы/);
const receipt = brevo.emailContent({ firstName: "Test" }, { kind: "kyc_received" }, "Банк", "https://example.com/dashboard");
assert.match(receipt.subject, /на рассмотрении/);
assert.match(receipt.textContent, /а не одобрение заявки/);
assert.throws(() => brevo.emailContent({ firstName: "Test" }, { kind: "unknown" }, "Банк", "https://example.com"), error => error.code === "invalid_event");
await notifications.queueEmail(accountId, "registration", { kind: "account_created" }, session);
await notifications.queueEmail(accountId, "registration", { kind: "account_created" }, session);
assert.equal(queue.rows.length, 1);
await Promise.all([notifications.deliverEmails(accountId), notifications.deliverEmails(accountId)]);
assert.equal(requests.length, 1, "Concurrent workers must claim a message only once");
assert.equal(queue.rows[0].status, "sent");
assert.equal(requests[0].to[0].address, "synthetic@example.com");
assert.equal(requests[0].attachments, undefined);
assert.match(requests[0].messageId, /^<notification\.[a-f0-9]{64}@example.com>$/);
assert.equal(transports[0].host, "smtp-relay.brevo.com");
assert.equal(transports[0].port, 587);
assert.equal(transports[0].secure, false);
assert.equal(transports[0].requireTLS, true);
assert.equal(transports[0].tls.rejectUnauthorized, true);
assert.equal(transports[0].tls.minVersion, "TLSv1.2");
assert.deepEqual(transports[0].auth, { user: env.BREVO_SMTP_LOGIN, pass: env.BREVO_SMTP_KEY });
assert.equal(transports[0].logger, false);
assert.equal(transports[0].debug, false);
assert.equal(transports[0].disableFileAccess, true);
assert.equal(transports[0].disableUrlAccess, true);
console.log("PASS: five Russian templates, rejection reason validation/escaping, correct recipient, atomic claims and deduplication.");
const mimeTransport = nativeRequire("nodemailer").createTransport({ streamTransport: true, buffer: true, newline: "windows" });
const mime = await mimeTransport.sendMail(requests[0]);
const serialized = mime.message.toString("utf8");
assert.match(serialized, /Content-Type: multipart\/alternative/);
assert.match(serialized, /To:.*synthetic@example\.com/);
assert.equal(mime.messageId, requests[0].messageId);
assert.match(serialized, /^Message-ID:/mi);
assert.ok(serialized.includes("Content-Type: text/plain"));
assert.ok(serialized.includes("Content-Type: text/html"));
console.log("PASS: actual Nodemailer generates a valid MIME message with text/HTML alternatives and the stable Message-ID, without sending.");

await notifications.queueEmail(accountId, "kyc", { kind: "kyc_received" }, session);
providerResponse = () => { throw Object.assign(new Error("SMTP unavailable"), { code: "EMESSAGE", responseCode: 451 }); };
await notifications.deliverEmails(accountId);
const pending = queue.rows.find(row => row._id === "kyc");
assert.equal(pending.status, "queued");
assert.equal(pending.errorCode, "smtp_451");
const retryKey = requests.at(-1).messageId;
pending.nextAttemptAt = new Date(0);
providerResponse = accepted;
await notifications.deliverEmails(accountId);
assert.equal(pending.status, "sent");
assert.equal(requests.at(-1).messageId, retryKey);
await notifications.queueEmail(accountId, "no-config", { kind: "account_created" }, session);
delete env.BREVO_SMTP_KEY;
env.BREVO_API_KEY = "an-api-key-must-not-enable-smtp";
assert.equal((await notifications.deliverEmails(accountId)).configured, false);
assert.equal(queue.rows.find(row => row._id === "no-config").attempts, 0);
env.BREVO_SMTP_KEY = "fake-smtp-key";
providerResponse = () => { throw new Error("network"); };
await notifications.deliverEmails(accountId);
assert.equal(queue.rows.find(row => row._id === "no-config").errorCode, "smtp_connection_failed");
await assert.rejects(() => brevo.sendBrevoEmail({ email: "test@example.invalid", firstName: "Test" }, { kind: "account_created" }, "key"), /reserved_recipient/);
console.log("PASS: SMTP temporary failures retry with stable Message-ID, API key alone cannot enable SMTP, synthetic recipient protection.");

for (const port of [465, 2525]) {
  env.BREVO_SMTP_PORT = String(port);
  providerResponse = accepted;
  await brevo.sendBrevoEmail({ email: "synthetic@example.com", firstName: "Test" }, { kind: "account_created" }, "stable-key");
  assert.equal(transports.at(-1).secure, port === 465);
  assert.equal(transports.at(-1).requireTLS, port !== 465);
}
env.BREVO_SMTP_PORT = "25";
assert.equal(brevo.brevoConfiguration(), null);
env.BREVO_SMTP_PORT = "587";
env.BREVO_SMTP_HOST = "untrusted.example.com";
assert.equal(brevo.brevoConfiguration(), null);
delete env.BREVO_SMTP_HOST;
providerResponse = () => { throw Object.assign(new Error("private server response must not escape"), { code: "EAUTH", responseCode: 535 }); };
await assert.rejects(() => brevo.sendBrevoEmail({ email: "synthetic@example.com", firstName: "Test" }, { kind: "account_created" }, "key"), error => error.code === "smtp_authentication_failed" && error.retryable && !error.message.includes("private"));
providerResponse = () => { throw Object.assign(new Error("Recipient rejected"), { responseCode: 550 }); };
await assert.rejects(() => brevo.sendBrevoEmail({ email: "synthetic@example.com", firstName: "Test" }, { kind: "account_created" }, "key"), error => error.code === "smtp_550" && !error.retryable);
providerResponse = mail => ({ messageId: mail.messageId, accepted: [], rejected: [mail.to[0].address] });
await assert.rejects(() => brevo.sendBrevoEmail({ email: "synthetic@example.com", firstName: "Test" }, { kind: "account_created" }, "key"), error => error.code === "smtp_recipient_rejected" && !error.retryable);
console.log("PASS: STARTTLS on 587/2525, direct TLS on 465, safe error codes, authentication failures and permanent recipient rejection.");
providerResponse = accepted;
await notifications.queueEmail(accountId, "older-message", { kind: "account_created" }, session);
await notifications.queueEmail(accountId, "focused-message", { kind: "kyc_received" }, session);
await notifications.deliverEmails(accountId, 1, "focused-message");
assert.equal(queue.rows.find(row => row._id === "focused-message").status, "sent");
assert.equal(queue.rows.find(row => row._id === "older-message").status, "queued");
console.log("PASS: targeted delivery sends the requested notification immediately without draining older queued messages first.");

const kycId = new ObjectId();
collection("kyc_requests").rows.push({ _id: kycId, accountId, status: "pending" });
await assert.rejects(() => events.queueKycApprovedEmail(kycId, session));
Object.assign(collection("kyc_requests").rows[0], { status: "approved", approvedAt: new Date() });
await assert.rejects(() => events.queueKycApprovedEmail(kycId, session));
collection("accounts").rows[0].kycStatus = "approved";
await events.queueKycApprovedEmail(kycId, session);
await events.queueKycApprovedEmail(kycId, session);
assert.equal(queue.rows.filter(row => row.event.kind === "kyc_approved").length, 1);
await notifications.queueEmail(accountId, `account_created:${accountId}`, { kind: "account_created" }, session);
const approvalRoute = load("src/app/sberbank/admin/api/kyc/[id]/approve/route.ts");
const beforeApproval = requests.length;
const approvalResponse = await approvalRoute.POST(new Request("http://localhost/sberbank/admin/api/kyc/approve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewed: true }) }), { params: Promise.resolve({ id: kycId.toHexString().toUpperCase() }) });
assert.equal(approvalResponse.status, 200);
assert.equal(afterTasks.length, 1);
await afterTasks.shift()();
assert.equal(requests.length, beforeApproval + 1);
assert.match(requests.at(-1).subject, /KYC одобрена/);
assert.match(requests.at(-1).text, /заявка на проверку личности одобрена/);
assert.ok(!requests.at(-1).text.includes("Регистрация завершена"));
assert.equal(queue.rows.find(row => row._id === `account_created:${accountId}`).status, "queued", "Approving KYC must never resend an older account-creation message");
await assert.rejects(() => notifications.queueEmail(accountId, `kyc_approved:${new ObjectId()}`, { kind: "account_created" }, session), error => error.code === "notification_event_mismatch");
const corruptKey = `kyc_approved:${new ObjectId()}`;
await notifications.queueEmail(accountId, corruptKey, { kind: "kyc_approved" }, session);
queue.rows.find(row => row._id === corruptKey).event = { kind: "account_created" };
const beforeCorrupt = requests.length;
await notifications.deliverEmails(accountId, 1, corruptKey);
assert.equal(requests.length, beforeCorrupt, "A corrupted legacy event must not reach SMTP with the wrong content");
assert.equal(queue.rows.find(row => row._id === corruptKey).errorCode, "notification_event_mismatch");
assert.equal(queue.rows.find(row => row._id === corruptKey).status, "failed");
console.log("PASS: approval HTTP route sends the approval email, not queued registration; uppercase IDs normalized; event-kind mismatch rejected.");
const refusedId = new ObjectId();
const refused = { _id: refusedId, accountId, status: "pending", rejectionReason: "Загрузите чёткое селфи" };
collection("kyc_requests").rows.push(refused);
await assert.rejects(() => events.queueKycRejectedEmail(refusedId, session));
refused.status = "rejected";
await assert.rejects(() => events.queueKycRejectedEmail(refusedId, session));
refused.rejectedAt = new Date();
await assert.rejects(() => events.queueKycRejectedEmail(refusedId, session));
collection("accounts").rows[0].kycStatus = "rejected";
await events.queueKycRejectedEmail(refusedId, session);
await events.queueKycRejectedEmail(refusedId, session);
assert.equal(queue.rows.filter(row => row.event.kind === "kyc_rejected").length, 1);
assert.equal(queue.rows.find(row => row.event.kind === "kyc_rejected").event.reason, refused.rejectionReason);
refused.rejectionReason = "Изменённый текст";
await events.queueConfirmedEventNotifications();
assert.equal(queue.rows.find(row => row.event.kind === "kyc_rejected").event.reason, "Загрузите чёткое селфи", "Queued decision reason must remain a snapshot");
providerResponse = accepted;
await notifications.deliverEmails(accountId, 1, `kyc_rejected:${refusedId}`);
assert.equal(queue.rows.find(row => row._id === `kyc_rejected:${refusedId}`).status, "sent");
assert.match(requests.at(-1).text, /Загрузите чёткое селфи/);
console.log("PASS: rejection requires a confirmed decision/date/account; reason snapshot, deduplication and SMTP delivery verified.");
const transferId = new ObjectId();
const transfer = { _id: transferId, accountId, status: "pending", amountMinor: 420050, currency: "RUB", reference: "PROVIDER-REF-1", confirmedAt: new Date() };
collection("incoming_transfers").rows.push(transfer);
await assert.rejects(() => events.queueIncomingTransferEmail(transferId, session));
transfer.status = "confirmed";
await events.queueConfirmedEventNotifications();
await events.queueConfirmedEventNotifications();
assert.equal(queue.rows.filter(row => row.event.kind === "incoming_transfer").length, 1);
collection("accounts").rows[0].balance = 999999;
await events.queueConfirmedEventNotifications();
assert.equal(queue.rows.filter(row => row.event.kind === "incoming_transfer").length, 1, "A balance edit must not fabricate a transfer");
console.log("PASS: approval requires confirmed account and dossier; only confirmed transfers trigger email; reconciliation is idempotent.");

for (const header of [undefined, "Bearer wrong", `Bearer ${"é".repeat(40)}`]) {
  assert.equal((await cron.GET(new Request("http://localhost/api/cron/notifications", { headers: header ? { authorization: header } : {} }))).status, 401);
}
providerResponse = accepted;
assert.equal((await cron.GET(new Request("http://localhost/api/cron/notifications", { headers: { authorization: `Bearer ${env.CRON_SECRET}` } }))).status, 200);
console.log("PASS: protected worker rejects unauthenticated and malformed credentials. No real email sent.");

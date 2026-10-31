// Pure authentication tests: no environment files, database or network access.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const nativeRequire = createRequire(import.meta.url);
const env = { NODE_ENV: "development", ADMIN_ACCESS_CODE: "synthetic-code-for-tests-only-123456" };
let requestHeaders = new Headers({ host: "localhost:3000" });
let cookieValue;
const loadedModule = { exports: {} };
const code = ts.transpileModule(readFileSync("src/lib/server/admin-access.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
new Function("require", "module", "exports", "process", code)(id => {
  if (id === "server-only") return {};
  if (id === "next/headers") return { headers: async () => requestHeaders, cookies: async () => ({ get: () => cookieValue ? { value: cookieValue } : undefined }) };
  return nativeRequire(id);
}, loadedModule, loadedModule.exports, { env });
const access = loadedModule.exports;
assert.equal(await access.currentAdmin(), "local");
requestHeaders = new Headers({ host: "192.168.1.20:3000" });
assert.equal(await access.currentAdmin(), null);
requestHeaders = new Headers({ host: "localhost:3000", "x-forwarded-host": "public.example.com" });
assert.equal(await access.currentAdmin(), null);
requestHeaders = new Headers({ host: "localhost:3000" });
env.VERCEL = "1";
assert.equal(await access.currentAdmin(), null);
delete env.VERCEL;
env.NODE_ENV = "production";
assert.equal(await access.currentAdmin(), null, "Production never inherits the localhost bypass");
assert.equal(access.matchesAdminCode("wrong"), false);
assert.equal(access.matchesAdminCode(env.ADMIN_ACCESS_CODE), true);
cookieValue = access.createAdminToken();
assert.equal(await access.currentAdmin(), "code");
assert.equal(access.validAdminToken(`${cookieValue.slice(0, -1)}${cookieValue.endsWith("0") ? "1" : "0"}`), false);
const original = env.ADMIN_ACCESS_CODE;
env.ADMIN_ACCESS_CODE = "another-code-for-tests-only-123456";
assert.equal(access.validAdminToken(cookieValue), false, "Code rotation revokes existing sessions");
env.ADMIN_ACCESS_CODE = original;
const realDateNow = Date.now;
try { Date.now = () => realDateNow() + (8 * 60 * 60 + 10) * 1000; assert.equal(access.validAdminToken(cookieValue), false); }
finally { Date.now = realDateNow; }
env.ADMIN_ACCESS_CODE = "";
assert.equal(await access.currentAdmin(), null);
assert.throws(() => access.createAdminToken());
assert.throws(() => access.requireAdminOrigin(new Request("https://example.com/sberbank/admin/api/action", { method: "POST", headers: { origin: "https://evil.example" } })));
assert.throws(() => access.requireAdminOrigin(new Request("https://example.com/sberbank/admin/api/action", { method: "POST" })));
assert.doesNotThrow(() => access.requireAdminOrigin(new Request("https://example.com/sberbank/admin/api/action", { method: "POST", headers: { origin: "https://example.com" } })));
assert.doesNotThrow(() => access.requireAdminOrigin(new Request("http://localhost:3002/sberbank/admin/api/action", { method: "POST", headers: { host: "127.0.0.1:3002", origin: "http://127.0.0.1:3002" } })));
env.VERCEL = "1";
assert.doesNotThrow(() => access.requireAdminOrigin(new Request("http://internal/sberbank/admin/api/action", { method: "POST", headers: { host: "bank.example.com", origin: "https://bank.example.com", "x-forwarded-proto": "https" } })));
assert.throws(() => access.requireAdminOrigin(new Request("http://internal/sberbank/admin/api/action", { method: "POST", headers: { host: "bank.example.com", origin: "https://foreign.example", "x-forwarded-proto": "https" } })));
console.log("PASS: localhost-only dev access, Vercel/production protection, signed sessions, expiry, code rotation and cross-origin protection.");

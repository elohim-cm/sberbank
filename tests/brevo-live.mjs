// Manual, opt-in verification against Brevo. Defaults to authentication only.
// --send --to ADDRESS sends exactly five clearly labelled test notifications.
// Uses the application's actual templates, transport settings and error mapping.
// Never reads or writes account, KYC, transfer or notification collections.
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import path from "node:path";
import nextEnv from "@next/env";
import nodemailer from "nodemailer";
import ts from "typescript";

nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} });
const args = process.argv.slice(2);
const send = args.includes("--send");
const toIndex = args.indexOf("--to");
const recipientEmail = toIndex < 0 ? undefined : args[toIndex + 1];
if (send && (!recipientEmail || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(recipientEmail))) {
  console.error("An explicit test recipient is required: --send --to ADDRESS");
  process.exitCode = 1;
} else {
  await main();
}

async function main() {
  const report = { run: randomUUID(), createdAt: new Date().toISOString(), authenticated: false, results: [] };
  const nativeRequire = createRequire(import.meta.url);
  const loadedModule = { exports: {} };
  const notice = "Тестовое уведомление. Реальный счёт не создан, статус KYC не изменён, деньги не переводились.";
  const testMailer = {
    createTransport(options) {
      const transport = nodemailer.createTransport(options);
      return {
        verify: () => transport.verify(),
        close: () => transport.close(),
        sendMail: mail => transport.sendMail({
          ...mail, subject: `[ТЕСТ] ${mail.subject}`, text: `${notice}\n\n${mail.text}`,
          html: mail.html.replace(/(<body[^>]*>)/, `$1<div style="padding:18px;background:#fff2d6;color:#734b13;font-family:Arial,sans-serif">${notice}</div>`),
        }),
      };
    },
  };
  const compiled = ts.transpileModule(readFileSync("src/lib/server/brevo.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "module", "exports", "process", compiled)(id => {
    if (id === "server-only") return {};
    if (id === "nodemailer") return testMailer;
    if (id === "../kyc") {
      const shared = { exports: {} };
      const code = ts.transpileModule(readFileSync("src/lib/kyc.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
      new Function("module", "exports", code)(shared, shared.exports);
      return shared.exports;
    }
    return nativeRequire(id);
  }, loadedModule, loadedModule.exports, process);
  const brevo = loadedModule.exports;
  const config = brevo.brevoConfiguration();
  if (!config) {
    console.error("SMTP configuration invalid or incomplete. Check BREVO_SMTP_LOGIN, BREVO_SMTP_KEY, BREVO_SENDER_EMAIL, BREVO_SENDER_NAME, APP_URL and the Brevo host/port. Values hidden.");
    process.exitCode = 1;
    return;
  }
  let currentStage = "SMTP authentication";
  try {
    const transport = brevo.createBrevoTransport(config);
    try { await transport.verify(); } finally { transport.close(); }
    report.authenticated = true;
    console.log("PASS: real Brevo SMTP connection, required TLS and authentication. No email sent by verify().");
    if (send) {
      const events = [
        { kind: "account_created" }, { kind: "kyc_received" }, { kind: "kyc_approved" },
        { kind: "kyc_rejected", reason: "Тест: загрузите более чёткую фотографию документа" },
        { kind: "incoming_transfer", amountMinor: 10000, currency: "RUB", reference: `TEST-${report.run}` },
      ];
      for (const event of events) {
        currentStage = event.kind;
        const result = await brevo.sendBrevoEmail({ email: recipientEmail, firstName: "Тестовый пользователь" }, event, `live-test:${report.run}:${event.kind}`);
        report.results.push({ kind: event.kind, status: "smtp_accepted", messageId: result.messageId });
        console.log(`PASS: ${event.kind} accepted by Brevo SMTP.`);
      }
      console.log("All five test messages accepted. Inbox delivery must be checked by the recipient or in Brevo transactional logs.");
    }
  } catch (error) {
    // Provider responses can contain credentials or personal data: never print
    // their message, stack, response, envelope or complete configuration.
    const code = error instanceof brevo.EmailDeliveryError ? error.code : typeof error?.code === "string" && /^[A-Z_\d]{1,35}$/.test(error.code) ? error.code : "SMTP_ERROR";
    const responseCode = typeof error?.responseCode === "number" ? error.responseCode : undefined;
    report.results.push({ stage: currentStage, status: "failed", code, ...(responseCode ? { responseCode } : {}) });
    console.error(`FAIL: ${currentStage} (${code}${responseCode ? `, SMTP ${responseCode}` : ""}). Sensitive details hidden. Remaining messages were not sent; no automatic retry.`);
    process.exitCode = 1;
  } finally {
    const directory = path.resolve("verification");
    mkdirSync(directory, { recursive: true });
    const file = path.join(directory, `brevo-live-${report.run}.json`);
    writeFileSync(file, JSON.stringify(report, null, 2), "utf8");
    console.log(`Local test report: ${path.relative(process.cwd(), file)}`);
  }
}

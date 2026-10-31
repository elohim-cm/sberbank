import "server-only";
import { createHash } from "node:crypto";
import nodemailer from "nodemailer";
import { validKycRejectionReason } from "../kyc";

export type EmailEvent =
  | { kind: "account_created" }
  | { kind: "kyc_received" }
  | { kind: "kyc_approved" }
  | { kind: "kyc_rejected"; reason: string }
  | { kind: "incoming_transfer"; amountMinor: number; currency: "RUB"; reference: string };

export type EmailRecipient = { email: string; firstName: string };

export class EmailDeliveryError extends Error {
  constructor(public code: string, public retryable: boolean) { super(code); }
}

export function brevoConfiguration() {
  const host = process.env.BREVO_SMTP_HOST?.trim() || "smtp-relay.brevo.com";
  const port = Number(process.env.BREVO_SMTP_PORT?.trim() || "587");
  const login = process.env.BREVO_SMTP_LOGIN?.trim();
  const smtpKey = process.env.BREVO_SMTP_KEY?.trim();
  const senderEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const senderName = process.env.BREVO_SENDER_NAME?.trim();
  const rawUrl = process.env.APP_URL?.trim();
  if (!login || !smtpKey || !senderEmail || !senderName || !rawUrl) return null;
  if (host !== "smtp-relay.brevo.com" || ![587, 465, 2525].includes(port) || /[\r\n]/.test(senderName)) return null;
  try {
    const url = new URL(rawUrl);
    if (url.username || url.password || !["https:", "http:"].includes(url.protocol)) return null;
    if (url.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(url.hostname)) return null;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) return null;
    return { host, port, login, smtpKey, senderEmail, senderName, dashboardUrl: new URL("/dashboard", url).href };
  } catch { return null; }
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export function createBrevoTransport(config: NonNullable<ReturnType<typeof brevoConfiguration>>) {
  return nodemailer.createTransport({
    host: config.host, port: config.port, secure: config.port === 465,
    requireTLS: config.port !== 465,
    auth: { user: config.login, pass: config.smtpKey },
    tls: { minVersion: "TLSv1.2", rejectUnauthorized: true },
    connectionTimeout: 8_000, greetingTimeout: 8_000, socketTimeout: 12_000,
    pool: false, logger: false, debug: false,
    disableFileAccess: true, disableUrlAccess: true,
  });
}

export function emailContent(recipient: EmailRecipient, event: EmailEvent, senderName: string, dashboardUrl: string) {
  let subject: string;
  let title: string;
  let category: string;
  let status: string;
  let message: string;
  let nextStep: string;
  let action: string;
  let detail: [string, string] | undefined;
  let accent = "#007b48";
  let tint = "#edf6f0";
  switch (event.kind) {
    case "account_created":
      subject = "Регистрация в личном кабинете завершена";
      title = "Добро пожаловать<br>в личный кабинет";
      category = "Регистрация";
      status = "Регистрация завершена";
      message = "Подтверждаем успешное создание вашего личного кабинета. Указанные при регистрации сведения сохранены в вашем профиле.";
      nextStep = "Для доступа к счетам, картам и информации о балансе необходимо пройти проверку личности. Подготовьте документ, удостоверяющий личность, и следуйте инструкциям в личном кабинете.";
      action = "Перейти в личный кабинет";
      break;
    case "kyc_received":
      subject = "Документы получены — заявка KYC на рассмотрении";
      title = "Документы приняты<br>на рассмотрение";
      category = "Проверка личности";
      status = "На рассмотрении";
      message = "Подтверждаем получение фотографий вашего документа и селфи. Заявка на проверку личности передана на рассмотрение.";
      nextStep = "На этом этапе дополнительные действия не требуются. Это письмо подтверждает получение документов, а не одобрение заявки. После принятия решения мы направим отдельное уведомление на вашу электронную почту.";
      action = "Посмотреть статус заявки";
      accent = "#89601d"; tint = "#fbf5e8";
      break;
    case "kyc_approved":
      subject = "Проверка личности KYC одобрена";
      title = "Ваша личность<br>подтверждена";
      category = "Решение по заявке KYC";
      status = "Проверка одобрена";
      message = "Сообщаем, что рассмотрение ваших документов завершено. Ваша заявка на проверку личности одобрена.";
      nextStep = "В личном кабинете доступен просмотр информации о ваших счетах, картах и балансе. Актуальный статус проверки отражён в вашем профиле.";
      action = "Открыть личный кабинет";
      break;
    case "kyc_rejected":
      if (!validKycRejectionReason(event.reason)) throw new EmailDeliveryError("invalid_rejection_reason", false);
      subject = "Заявка на проверку личности KYC не одобрена";
      title = "Необходимо уточнить<br>данные для проверки";
      category = "Решение по заявке KYC";
      status = "Заявка не одобрена";
      message = "Рассмотрение вашей заявки на проверку личности завершено. На основании предоставленных материалов заявка не одобрена.";
      detail = ["Причина решения", event.reason.trim()];
      nextStep = "Пожалуйста, учтите указанные замечания и повторно отправьте документы через личный кабинет. До одобрения новой заявки доступ к разделам, требующим подтверждения личности, остаётся ограниченным.";
      action = "Перейти к повторной проверке";
      accent = "#954b32"; tint = "#faf0eb";
      break;
    case "incoming_transfer": {
      if (!Number.isSafeInteger(event.amountMinor) || event.amountMinor <= 0 || event.currency !== "RUB" || !event.reference.trim() || event.reference.length > 150) throw new EmailDeliveryError("invalid_transfer", false);
      const amount = new Intl.NumberFormat("ru-RU", { style: "currency", currency: event.currency }).format(event.amountMinor / 100);
      subject = "На ваш счёт поступил перевод";
      title = "Средства зачислены<br>на ваш счёт";
      category = "Уведомление о зачислении";
      status = "Зачисление выполнено";
      message = "Подтверждаем зачисление средств на ваш счёт. Сумма операции учтена в текущем балансе и доступна для просмотра в личном кабинете.";
      detail = ["Сумма зачисления", amount];
      nextStep = "Сведения о зачислении и актуальный баланс доступны в личном кабинете.";
      action = "Посмотреть баланс";
      break;
    }
    default: throw new EmailDeliveryError("invalid_event", false);
  }
  const greeting = `Здравствуйте, ${recipient.firstName}!`;
  const security = "В целях безопасности никому не сообщайте реквизиты вашей карты.";
  const noReply = "Пожалуйста, не отвечайте на это письмо.";
  const reference = event.kind === "incoming_transfer" ? event.reference : undefined;
  const textContent = `${senderName}\n${category}\n\n${subject}\nСтатус: ${status}\n\n${greeting}\n\n${message}${detail ? `\n\n${detail[0]}: ${detail[1]}` : ""}${reference ? `\nНомер операции: ${reference}` : ""}\n\n${nextStep}\n\nЛичный кабинет: ${dashboardUrl}\n\nС уважением,\nКоманда ${senderName}\n\nБезопасность ваших данных\n${security}\n${noReply}\n\n${senderName}`;
  const font = "font-family:Arial,Helvetica,sans-serif;";
  const htmlContent = `<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(subject)}</title>
<style>body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}table{border-collapse:collapse}a:focus-visible{outline:3px solid #62ba91;outline-offset:4px}@media only screen and (max-width:480px){.outer{padding:12px 8px!important}.content{padding-left:24px!important;padding-right:24px!important}.email-title{font-size:28px!important;line-height:34px!important}.brand{font-size:21px!important}.button{display:block!important;text-align:center!important}.footer{padding:22px 24px!important}}</style></head>
<body style="margin:0;padding:0;background:#eef2f0;color:#203c34;${font}">
<div aria-hidden="true" style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${escapeHtml(subject)}. ${escapeHtml(status)}.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f0;${font}"><tr><td class="outer" align="center" style="padding:36px 16px">
<!--[if mso]><table role="presentation" width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dee7e1;${font}">
<tr><td class="content" bgcolor="#064d3e" style="padding:29px 40px 27px;background:#064d3e;border-top:4px solid #15b765;${font}"><p class="brand" style="margin:0;color:#ffffff;font-size:24px;line-height:30px;font-weight:700;letter-spacing:.4px;${font}">${escapeHtml(senderName)}</p><p style="margin:7px 0 0;color:#c3d9cf;font-size:11px;line-height:17px;letter-spacing:1.4px;${font}">ЛИЧНЫЙ КАБИНЕТ</p></td></tr>
<tr><td class="content" style="padding:36px 40px 0;${font}"><p style="margin:0 0 14px;color:#6b7e75;font-size:11px;line-height:17px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;${font}">${escapeHtml(category)}</p><h1 class="email-title" style="margin:0;color:#153b2f;font-size:32px;line-height:38px;font-weight:700;letter-spacing:-.8px;${font}">${title}</h1></td></tr>
<tr><td class="content" style="padding:22px 40px 0;${font}"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td bgcolor="${tint}" style="padding:9px 14px;background:${tint};border-left:3px solid ${accent};color:${accent};font-size:12px;line-height:18px;font-weight:700;${font}">${escapeHtml(status)}</td></tr></table></td></tr>
<tr><td class="content" style="padding:28px 40px 0;${font}"><p style="margin:0 0 16px;color:#203c34;font-size:15px;line-height:25px;${font}">${escapeHtml(greeting)}</p><p style="margin:0;color:#485e53;font-size:15px;line-height:25px;${font}">${escapeHtml(message)}</p></td></tr>
${detail ? `<tr><td class="content" style="padding:24px 40px 0;${font}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:20px 22px;background:${tint};border:1px solid #e2e9e4;${font}"><p style="margin:0 0 8px;color:#6b7e75;font-size:11px;line-height:17px;text-transform:uppercase;letter-spacing:.8px;${font}">${escapeHtml(detail[0])}</p><p style="margin:0;color:#153b2f;font-size:${event.kind === "incoming_transfer" ? "30" : "15"}px;line-height:${event.kind === "incoming_transfer" ? "38" : "25"}px;font-weight:700;overflow-wrap:anywhere;word-break:break-word;${font}">${escapeHtml(detail[1])}</p>${reference ? `<p style="margin:12px 0 0;color:#5f7469;font-size:12px;line-height:19px;overflow-wrap:anywhere;word-break:break-word;${font}">Номер операции: ${escapeHtml(reference)}</p>` : ""}</td></tr></table></td></tr>` : ""}
<tr><td class="content" style="padding:22px 40px 0;${font}"><p style="margin:0;color:#485e53;font-size:14px;line-height:24px;${font}">${escapeHtml(nextStep)}</p></td></tr>
<tr><td class="content" style="padding:28px 40px 30px;${font}"><table role="presentation" cellpadding="0" cellspacing="0" style="width:100%"><tr><td align="left" style="${font}"><a class="button" href="${escapeHtml(dashboardUrl)}" style="display:inline-block;padding:16px 24px;background:#008d48;border:1px solid #008d48;border-radius:6px;color:#ffffff;font-size:14px;line-height:20px;font-weight:700;text-decoration:none;mso-padding-alt:0;${font}"><!--[if mso]><i style="mso-font-width:150%;mso-text-raise:24pt" hidden>&emsp;</i><span style="mso-text-raise:12pt"><![endif]-->${escapeHtml(action)}<!--[if mso]></span><i style="mso-font-width:150%" hidden>&emsp;&#8203;</i><![endif]--></a></td></tr></table></td></tr>
<tr><td class="content" style="padding:0 40px 32px;${font}"><p style="margin:0;color:#203c34;font-size:13px;line-height:21px;${font}">С уважением,<br><strong>Команда ${escapeHtml(senderName)}</strong></p></td></tr>
<tr><td class="footer" style="padding:24px 40px;background:#f7f9f7;border-top:1px solid #e3eae5;${font}"><p style="margin:0 0 10px;color:#435d4f;font-size:11px;line-height:18px;font-weight:700;${font}">Безопасность ваших данных</p><p style="margin:0;color:#6c7f73;font-size:11px;line-height:18px;${font}">${escapeHtml(security)}</p><p style="margin:8px 0 0;color:#6c7f73;font-size:11px;line-height:18px;${font}">${escapeHtml(noReply)}</p></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
<p style="margin:18px 0 0;color:#7b8c81;font-size:10px;line-height:17px;${font}"><strong>${escapeHtml(senderName)}</strong></p>
</td></tr></table></body></html>`;
  return { subject, textContent, htmlContent };
}

export async function sendBrevoEmail(recipient: EmailRecipient, event: EmailEvent, idempotencyKey: string) {
  const config = brevoConfiguration();
  if (!config) throw new EmailDeliveryError("configuration_missing", true);
  // Synthetic integration-test recipients must never be sent to a provider.
  if (/\.invalid$/i.test(recipient.email)) throw new EmailDeliveryError("reserved_recipient", false);
  const content = emailContent(recipient, event, config.senderName, config.dashboardUrl);
  // Keep the same Message-ID on retries for traceability. SMTP does not offer
  // the HTTP API's idempotency guarantee: an ambiguous disconnect can duplicate.
  const messageId = `<notification.${createHash("sha256").update(idempotencyKey).digest("hex")}@${config.senderEmail.split("@")[1]}>`;
  const transport = createBrevoTransport(config);
  try {
    const result = await transport.sendMail({
      from: { address: config.senderEmail, name: config.senderName },
      to: [{ address: recipient.email, name: recipient.firstName }],
      subject: content.subject, html: content.htmlContent, text: content.textContent,
      messageId,
    });
    if (result.accepted.length !== 1 || result.rejected.length) throw new EmailDeliveryError("smtp_recipient_rejected", false);
    return { messageId: result.messageId };
  } catch (error) {
    if (error instanceof EmailDeliveryError) throw error;
    const failure = error as { code?: string; responseCode?: number } | null;
    if (failure?.code === "EAUTH") throw new EmailDeliveryError("smtp_authentication_failed", true);
    const status = failure?.responseCode;
    if (typeof status === "number" && status >= 400 && status <= 599) throw new EmailDeliveryError(`smtp_${status}`, status < 500 || status === 503);
    if (failure?.code === "EENVELOPE" || failure?.code === "EMESSAGE") throw new EmailDeliveryError("smtp_message_invalid", false);
    throw new EmailDeliveryError("smtp_connection_failed", true);
  }
}

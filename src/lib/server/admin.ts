import "server-only";
import { ObjectId, type Filter } from "mongodb";
import type { AdminAccount, AdminAccountDetail, AdminOverview } from "../admin-types";
import { requiredKycSlots, validKycRejectionReason } from "../kyc";
import { registrationSummary } from "@/app/inscription/registration-data";
import { accountCollections, type AccountDocument } from "./accounts";
import { kycCollections, type KycRequestDocument } from "./kyc";
import { getDatabase, getMongoClient } from "./mongodb";
import { AdminError, type AdminAccess } from "./admin-access";
import { notificationCollection } from "./notifications";
import { queueKycApprovedEmail, queueKycRejectedEmail } from "./notification-events";
import type { AdminCreditDocument } from "./admin-credit";

const date = (value?: Date) => value instanceof Date && Number.isFinite(+value) ? value.toISOString() : null;
const balance = (value?: number) => typeof value === "number" && Number.isFinite(value) ? value : 0;
const accountRow = (account: AccountDocument, request?: KycRequestDocument | null): AdminAccount => ({
  id: account._id.toHexString(), name: `${account.lastName} ${account.firstName}`, email: account.email,
  createdAt: account.createdAt.toISOString(), product: account.product, balance: balance(account.balance),
  kycStatus: account.kycStatus || "not_started", requestId: request?._id.toHexString() || null,
  submittedAt: date(request?.submittedAt), documentKind: request?.documentKind || null,
});

export async function adminOverview(params: URLSearchParams): Promise<AdminOverview> {
  const { accounts } = await accountCollections();
  const { requests } = await kycCollections();
  const notifications = await notificationCollection();
  const page = Math.max(1, Math.min(10000, Number.parseInt(params.get("page") || "1", 10) || 1));
  const pageSize = 20;
  const status = params.get("status");
  const query = (params.get("q") || "").trim().slice(0, 100);
  const filter: Filter<AccountDocument> = {};
  if (status && ["pending", "approved", "not_started", "rejected"].includes(status)) filter.kycStatus = status as AccountDocument["kycStatus"];
  if (query) {
    const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
  }
  const [rows, total, count, pending, approved, emailsQueued] = await Promise.all([
    accounts.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
    accounts.countDocuments(filter), accounts.countDocuments(), requests.countDocuments({ status: "pending" }),
    requests.countDocuments({ status: "approved" }), notifications.countDocuments({ status: { $in: ["queued", "sending"] } }),
  ]);
  const dossiers = await requests.find({ accountId: { $in: rows.map(row => row._id) } }).toArray();
  const byAccount = new Map(dossiers.map(request => [request.accountId.toHexString(), request]));
  return { accounts: rows.map(row => accountRow(row, byAccount.get(row._id.toHexString()))), total, page, pageSize, stats: { accounts: count, pending, approved, emailsQueued } };
}

export async function adminAccountDetail(id: string): Promise<AdminAccountDetail> {
  if (!ObjectId.isValid(id)) throw new AdminError(404, "Клиент не найден.");
  const { accounts } = await accountCollections();
  const { requests, files } = await kycCollections();
  const account = await accounts.findOne({ _id: new ObjectId(id) });
  if (!account) throw new AdminError(404, "Клиент не найден.");
  const request = await requests.findOne({ accountId: account._id });
  const photos = request ? await files.find({ accountId: account._id, requestId: request._id, _id: { $in: Object.values(request.files) } }, { projection: { bytes: 0 } }).toArray() : [];
  const notifications = await (await notificationCollection()).find({ accountId: account._id }).sort({ createdAt: -1 }).limit(20).toArray();
  const credits = await (await getDatabase()).collection<AdminCreditDocument>("incoming_transfers").find({ accountId: account._id, source: "admin_credit" }).sort({ confirmedAt: -1, _id: -1 }).limit(10).toArray();
  return {
    account: accountRow(account, request), fields: registrationSummary(account),
    request: request ? { id: request._id.toHexString(), status: request.status, gender: request.gender, documentKind: request.documentKind, submittedAt: date(request.submittedAt), approvedAt: date(request.approvedAt), rejectedAt: date(request.rejectedAt), rejectionReason: request.rejectionReason || null, complete: requiredKycSlots(request.documentKind).every(slot => photos.some(photo => photo.slot === slot && photo._id.equals(request.files[slot]!))) } : null,
    files: photos.map(photo => ({ id: photo._id.toHexString(), slot: photo.slot, size: photo.size, width: photo.width, height: photo.height })),
    notifications: notifications.map(item => ({ id: item._id, kind: item.event.kind, status: item.status, createdAt: item.createdAt.toISOString(), sentAt: date(item.sentAt), attempts: item.attempts })),
    credits: credits.map(item => ({ transferId: item._id.toHexString(), amountMinor: item.amountMinor, balanceBeforeMinor: item.balanceBeforeMinor, balanceAfterMinor: item.balanceAfterMinor, reference: item.reference, confirmedAt: item.confirmedAt.toISOString() })),
  };
}

export async function approveAdminKyc(id: string, access: AdminAccess) {
  if (!ObjectId.isValid(id)) throw new AdminError(404, "Заявка не найдена.");
  const { accounts } = await accountCollections();
  const { requests, files } = await kycCollections();
  await notificationCollection();
  const db = await getDatabase();
  const audit = db.collection<{ _id: string; accountId: ObjectId; requestId: ObjectId; action: string; access: AdminAccess; createdAt: Date }>("admin_audit");
  // Create the audit collection before opening a multi-collection transaction.
  await audit.createIndex({ createdAt: -1 }, { name: "admin_audit_date" });
  const client = await getMongoClient();
  return client.withSession(session => session.withTransaction(async () => {
    const request = await requests.findOne({ _id: new ObjectId(id) }, { session });
    if (!request) throw new AdminError(404, "Заявка не найдена.");
    const account = await accounts.findOne({ _id: request.accountId }, { session });
    if (!account) throw new AdminError(404, "Клиент не найден.");
    if (request.status === "approved" && account.kycStatus === "approved") return account._id;
    if (request.status !== "pending" || account.kycStatus !== "pending") throw new AdminError(409, "Одобрить можно только отправленную заявку на рассмотрении.");
    for (const slot of requiredKycSlots(request.documentKind)) {
      const fileId = request.files[slot];
      const photo = fileId && await files.findOne({ _id: fileId, accountId: account._id, requestId: request._id, slot, size: { $gt: 0 } }, { session, projection: { _id: 1 } });
      if (!photo) throw new AdminError(409, "В заявке отсутствуют обязательные фотографии. Одобрение недоступно.");
    }
    const now = new Date();
    await requests.updateOne({ _id: request._id, status: "pending" }, { $set: { status: "approved", approvedAt: now, updatedAt: now } }, { session });
    await accounts.updateOne({ _id: account._id, kycStatus: "pending" }, { $set: { kycStatus: "approved", kycApprovedAt: now } }, { session });
    await audit.insertOne({ _id: `kyc_approved:${request._id}`, accountId: account._id, requestId: request._id, action: "kyc_approved", access, createdAt: now }, { session });
    await queueKycApprovedEmail(request._id, session);
    return account._id;
  }));
}

export async function rejectAdminKyc(id: string, reason: unknown, access: AdminAccess) {
  if (!ObjectId.isValid(id)) throw new AdminError(404, "Заявка не найдена.");
  if (!validKycRejectionReason(reason)) throw new AdminError(400, "Укажите причину отказа: от 3 до 500 символов.");
  const rejectionReason = reason.trim();
  const { accounts } = await accountCollections();
  const { requests } = await kycCollections();
  await notificationCollection();
  const audit = (await getDatabase()).collection<{ _id: string; accountId: ObjectId; requestId: ObjectId; action: string; reason: string; access: AdminAccess; createdAt: Date }>("admin_audit");
  await audit.createIndex({ createdAt: -1 }, { name: "admin_audit_date" });
  const client = await getMongoClient();
  return client.withSession(session => session.withTransaction(async () => {
    const request = await requests.findOne({ _id: new ObjectId(id) }, { session });
    if (!request) throw new AdminError(404, "Заявка не найдена.");
    const account = await accounts.findOne({ _id: request.accountId }, { session });
    if (!account) throw new AdminError(404, "Клиент не найден.");
    if (request.status === "rejected" && account.kycStatus === "rejected" && request.rejectionReason === rejectionReason) return account._id;
    if (request.status !== "pending" || account.kycStatus !== "pending") throw new AdminError(409, "Отклонить можно только заявку на рассмотрении.");
    const now = new Date();
    await requests.updateOne({ _id: request._id, status: "pending" }, { $set: { status: "rejected", rejectedAt: now, rejectionReason, updatedAt: now } }, { session });
    await accounts.updateOne({ _id: account._id, kycStatus: "pending" }, { $set: { kycStatus: "rejected", kycRejectionReason: rejectionReason } }, { session });
    await audit.insertOne({ _id: `kyc_rejected:${request._id}`, accountId: account._id, requestId: request._id, action: "kyc_rejected", reason: rejectionReason, access, createdAt: now }, { session });
    await queueKycRejectedEmail(request._id, session);
    return account._id;
  }));
}

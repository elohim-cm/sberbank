import "server-only";
import { Binary, ObjectId } from "mongodb";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { accountCollections, currentAccount, type AccountDocument } from "./accounts";
import { getDatabase, getMongoClient } from "./mongodb";
import { notificationCollection, queueEmail } from "./notifications";
import { kycImageTypes, maxKycImageBytes, requiredKycSlots, type KycDocumentKind, type KycGender, type KycSlot } from "../kyc";

export class KycError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function kycErrorResponse(error: unknown) {
  return NextResponse.json({ message: error instanceof KycError ? error.message : "Не удалось сохранить документы. Попробуйте ещё раз." }, {
    status: error instanceof KycError ? error.status : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function requireKycAccount() {
  const account = await currentAccount();
  if (!account) throw new KycError(401, "Сеанс завершён. Войдите в личный кабинет.");
  return account;
}

export type KycRequestDocument = {
  _id: ObjectId; accountId: ObjectId; documentKind: KycDocumentKind; gender: KycGender;
  status: "draft" | "pending" | "approved" | "rejected"; files: Partial<Record<KycSlot, ObjectId>>;
  rejectedAt?: Date; rejectionReason?: string;
  createdAt: Date; updatedAt: Date; submittedAt?: Date; approvedAt?: Date;
};

export type KycFileDocument = {
  _id: ObjectId; accountId: ObjectId; requestId: ObjectId; slot: KycSlot;
  contentType: string; bytes: Binary; size: number; width: number; height: number; updatedAt: Date;
};

let indexes: Promise<unknown> | undefined;
export async function kycCollections() {
  const db = await getDatabase();
  const requests = db.collection<KycRequestDocument>("kyc_requests");
  const files = db.collection<KycFileDocument>("kyc_files");
  if (!indexes) indexes = Promise.all([
    requests.createIndex({ accountId: 1 }, { unique: true, name: "kyc_account_unique" }),
    files.createIndex({ requestId: 1, slot: 1 }, { unique: true, name: "kyc_request_slot_unique" }),
  ]).catch(error => { indexes = undefined; throw error; });
  await indexes;
  return { requests, files };
}

export async function startKycDraft(account: AccountDocument, documentKind: KycDocumentKind, gender: KycGender) {
  const { requests, files } = await kycCollections();
  const client = await getMongoClient();
  const { accounts } = await accountCollections();
  return client.withSession(session => session.withTransaction(async () => {
    const current = await accounts.findOne({ _id: account._id }, { session });
    if (!current || !["not_started", "rejected"].includes(current.kycStatus)) throw new KycError(409, "Документы уже переданы на проверку.");
    const existing = await requests.findOne({ accountId: account._id }, { session });
    if (existing && existing.status !== "draft" && !(existing.status === "rejected" && current.kycStatus === "rejected")) throw new KycError(409, "Документы уже переданы на проверку.");
    if (existing?.status === "draft" && existing.documentKind === documentKind && existing.gender === gender) return existing;
    const now = new Date();
    const draft: KycRequestDocument = { _id: new ObjectId(), accountId: account._id, documentKind, gender, status: "draft", files: {}, createdAt: now, updatedAt: now };
    // Changing the document type clears only this account's unfinished uploads.
    if (existing) {
      await files.deleteMany({ accountId: account._id, requestId: existing._id }, { session });
      await requests.deleteOne({ _id: existing._id, accountId: account._id }, { session });
    }
    await requests.insertOne(draft, { session });
    if (current.kycStatus === "rejected") await accounts.updateOne({ _id: account._id }, { $set: { kycStatus: "not_started" }, $unset: { kycRejectionReason: "" } }, { session });
    return draft;
  }));
}

export async function storeKycImage(account: AccountDocument, requestId: string, slot: KycSlot, file: File) {
  if (!ObjectId.isValid(requestId)) throw new KycError(404, "Заявка не найдена.");
  if (!kycImageTypes.includes(file.type) || file.size === 0) throw new KycError(400, "Выберите фотографию JPG, PNG или WebP.");
  if (file.size > maxKycImageBytes) throw new KycError(413, "Размер фотографии после подготовки не должен превышать 3 МБ.");
  let image;
  try {
    const input = Buffer.from(await file.arrayBuffer());
    const jpeg = input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff;
    const png = input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const webp = input.toString("ascii", 0, 4) === "RIFF" && input.toString("ascii", 8, 12) === "WEBP";
    if (!jpeg && !png && !webp) throw new Error("signature");
    const metadata = await sharp(input, { limitInputPixels: 25_000_000, failOn: "error", animated: false }).metadata();
    if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format) || (metadata.pages ?? 1) !== 1) throw new Error("format");
    // Fully decode, orient and re-encode. This rejects corrupt images and drops
    // EXIF/GPS metadata instead of trusting the browser's filename or MIME type.
    image = await sharp(input, { limitInputPixels: 25_000_000, failOn: "error" }).rotate().flatten({ background: "#fff" }).jpeg({ quality: 94 }).toBuffer({ resolveWithObject: true });
    if (image.info.width < 100 || image.info.height < 100) throw new Error("dimensions");
  } catch { throw new KycError(400, "Не удалось прочитать фотографию. Выберите чёткое изображение размером не менее 100 × 100 пикселей."); }
  if (image.data.length > 4 * 1024 * 1024) throw new KycError(413, "Фотография слишком большая. Выберите изображение меньшего размера.");
  const { requests, files } = await kycCollections();
  const { accounts } = await accountCollections();
  const client = await getMongoClient();
  return client.withSession(session => session.withTransaction(async () => {
    const draft = await requests.findOne({ _id: new ObjectId(requestId), accountId: account._id }, { session });
    const current = await accounts.findOne({ _id: account._id }, { session });
    if (!draft) throw new KycError(404, "Заявка не найдена.");
    if (draft.status !== "draft" || !current || current.kycStatus !== "not_started") throw new KycError(409, "Документы уже переданы на проверку.");
    if (draft.documentKind === "passport" && slot === "back") throw new KycError(400, "Для паспорта нужна только страница с личными данными.");
    if (slot === "selfie" && (!draft.files.front || (draft.documentKind !== "passport" && !draft.files.back))) throw new KycError(409, "Сначала загрузите все необходимые стороны документа.");
    const now = new Date();
    const fileId = draft.files[slot] ?? new ObjectId();
    const stored: KycFileDocument = { _id: fileId, accountId: account._id, requestId: draft._id, slot, contentType: "image/jpeg", bytes: new Binary(image.data), size: image.data.length, width: image.info.width, height: image.info.height, updatedAt: now };
    await files.replaceOne({ _id: fileId }, stored, { upsert: true, session });
    await requests.updateOne({ _id: draft._id, status: "draft" }, { $set: { [`files.${slot}`]: fileId, updatedAt: now } }, { session });
    return fileId.toHexString();
  }));
}

export async function submitKyc(account: AccountDocument, requestId: string) {
  if (!ObjectId.isValid(requestId)) throw new KycError(404, "Заявка не найдена.");
  const { requests, files } = await kycCollections();
  const { accounts } = await accountCollections();
  const client = await getMongoClient();
  await notificationCollection();
  await client.withSession(session => session.withTransaction(async () => {
    const draft = await requests.findOne({ _id: new ObjectId(requestId), accountId: account._id }, { session });
    if (!draft) throw new KycError(404, "Заявка не найдена.");
    if (draft.status === "pending") return; // Safe retry if the final response was lost.
    if (draft.status !== "draft") throw new KycError(409, "Решение по заявке уже принято.");
    const current = await accounts.findOne({ _id: account._id }, { session });
    if (!current || current.kycStatus !== "not_started") throw new KycError(409, "Документы уже переданы на проверку.");
    for (const slot of requiredKycSlots(draft.documentKind)) {
      const fileId = draft.files[slot];
      if (!fileId || !await files.findOne({ _id: fileId, accountId: account._id, requestId: draft._id, slot }, { session, projection: { _id: 1 } })) throw new KycError(409, "Загрузите фотографии документа и селфи перед отправкой.");
    }
    const now = new Date();
    await requests.updateOne({ _id: draft._id, status: "draft" }, { $set: { status: "pending", updatedAt: now, submittedAt: now } }, { session });
    await accounts.updateOne({ _id: account._id }, { $set: { kycStatus: "pending" } }, { session });
    await queueEmail(account._id, `kyc_received:${draft._id}`, { kind: "kyc_received" }, session);
  }));
}

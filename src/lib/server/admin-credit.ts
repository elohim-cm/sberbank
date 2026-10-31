import "server-only";
import { ObjectId } from "mongodb";
import { accountCollections } from "./accounts";
import { kycCollections } from "./kyc";
import { getDatabase, getMongoClient } from "./mongodb";
import { AdminError, type AdminAccess } from "./admin-access";
import { balanceToMinor } from "../money";
import { notificationCollection } from "./notifications";
import { queueIncomingTransferEmail } from "./notification-events";
import type { AdminCreditReceipt } from "../admin-types";

export type AdminCreditDocument = {
  _id: ObjectId; accountId: ObjectId; source: "admin_credit"; operationKey: string;
  status: "confirmed"; amountMinor: number; currency: "RUB"; reference: string;
  balanceBeforeMinor: number; balanceAfterMinor: number; access: AdminAccess;
  confirmedAt: Date; createdAt: Date; emailNotificationQueued?: boolean;
};

const receipt = (transfer: AdminCreditDocument): AdminCreditReceipt => ({
  transferId: transfer._id.toHexString(), amountMinor: transfer.amountMinor,
  balanceBeforeMinor: transfer.balanceBeforeMinor, balanceAfterMinor: transfer.balanceAfterMinor,
  reference: transfer.reference, confirmedAt: transfer.confirmedAt.toISOString(),
});

let indexes: Promise<unknown> | undefined;
export async function adminCreditCollection() {
  const transfers = (await getDatabase()).collection<AdminCreditDocument>("incoming_transfers");
  if (!indexes) indexes = Promise.all([
    transfers.createIndex({ accountId: 1, operationKey: 1 }, { unique: true, name: "admin_credit_operation_unique", partialFilterExpression: { source: "admin_credit" } }),
    transfers.createIndex({ accountId: 1, confirmedAt: -1 }, { name: "incoming_transfer_history" }),
  ]).catch(error => { indexes = undefined; throw error; });
  await indexes;
  return transfers;
}

export async function creditAdminAccount(id: string, amountMinor: number, operationKey: string, access: AdminAccess) {
  if (!ObjectId.isValid(id)) throw new AdminError(404, "Клиент не найден.");
  if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new AdminError(400, "Введите положительную сумму с точностью до копеек.");
  if (!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(operationKey)) throw new AdminError(400, "Некорректный идентификатор операции.");
  const accountId = new ObjectId(id);
  const { accounts } = await accountCollections();
  const { requests } = await kycCollections();
  const transfers = await adminCreditCollection();
  await notificationCollection();
  const audit = (await getDatabase()).collection<{ _id: string; accountId: ObjectId; transferId: ObjectId; action: string; amountMinor: number; balanceBeforeMinor: number; balanceAfterMinor: number; access: AdminAccess; createdAt: Date }>("admin_audit");
  await audit.createIndex({ createdAt: -1 }, { name: "admin_audit_date" });
  const client = await getMongoClient();
  const transferId = new ObjectId();
  const sameOperation = (existing: AdminCreditDocument) => {
    if (existing.amountMinor !== amountMinor) throw new AdminError(409, "Эта операция уже использована для другой суммы. Обновите данные клиента.");
    return receipt(existing);
  };
  try {
    return await client.withSession(session => session.withTransaction(async () => {
      const account = await accounts.findOne({ _id: accountId }, { session });
      if (!account) throw new AdminError(404, "Клиент не найден.");
      const existing = await transfers.findOne({ accountId, source: "admin_credit", operationKey }, { session });
      if (existing) return sameOperation(existing);
      if (account.kycStatus !== "approved" || !await requests.findOne({ accountId, status: "approved" }, { session, projection: { _id: 1 } })) throw new AdminError(409, "Зачисление доступно только после одобрения KYC.");
      const beforeMinor = balanceToMinor(account.balance ?? 0);
      if (beforeMinor === null) throw new AdminError(409, "Текущий баланс имеет некорректный формат. Проверьте данные счёта.");
      const afterMinor = beforeMinor + amountMinor;
      if (!Number.isSafeInteger(afterMinor) || balanceToMinor(afterMinor / 100) !== afterMinor) throw new AdminError(400, "Сумма превышает допустимую точность баланса.");
      const now = new Date();
      const transfer: AdminCreditDocument = {
        _id: transferId, accountId, source: "admin_credit", operationKey, status: "confirmed",
        amountMinor, currency: "RUB", reference: `ADM-${transferId.toHexString().toUpperCase()}`,
        balanceBeforeMinor: beforeMinor, balanceAfterMinor: afterMinor, access, confirmedAt: now, createdAt: now,
      };
      // Updating the same account document serializes concurrent credits through
      // transaction conflict retries, preventing lost additions.
      await accounts.updateOne({ _id: accountId, kycStatus: "approved" }, { $set: { balance: afterMinor / 100 } }, { session });
      await transfers.insertOne(transfer, { session });
      await audit.insertOne({ _id: `balance_credit:${transferId}`, accountId, transferId, action: "balance_credit", amountMinor, balanceBeforeMinor: beforeMinor, balanceAfterMinor: afterMinor, access, createdAt: now }, { session });
      await queueIncomingTransferEmail(transferId, session);
      return receipt(transfer);
    }));
  } catch (error) {
    // A duplicate-key race must return the first committed receipt, never add
    // the amount again. Amount mismatches remain conflicts.
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const existing = await transfers.findOne({ accountId, source: "admin_credit", operationKey });
      if (existing) return sameOperation(existing);
    }
    throw error;
  }
}

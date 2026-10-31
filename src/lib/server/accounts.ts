import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { ObjectId } from "mongodb";
import { registrationSummary, type DashboardProfile, type RegistrationData } from "@/app/inscription/registration-data";
import type { ProductKind } from "@/app/test-profiles";
import { getDatabase, getMongoClient } from "./mongodb";
import { notificationCollection, queueEmail } from "./notifications";

export const sessionCookie = "bank_session";
export const sessionDuration = 7 * 24 * 60 * 60;

export type AccountDocument = RegistrationData & {
  _id: ObjectId;
  product: ProductKind;
  createdAt: Date;
  kycStatus: "not_started" | "pending" | "approved" | "rejected";
  kycRejectionReason?: string;
  kycApprovedAt?: Date;
  balance?: number; // RUB; optional only for accounts created before this field.
};

type SessionDocument = { _id: string; accountId: ObjectId; createdAt: Date; expiresAt: Date };
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

let indexes: Promise<unknown> | undefined;
export async function accountCollections() {
  const db = await getDatabase();
  const accounts = db.collection<AccountDocument>("accounts");
  const sessions = db.collection<SessionDocument>("sessions");
  if (!indexes) indexes = Promise.all([
    accounts.createIndex({ email: 1 }, { unique: true, name: "accounts_email_unique" }),
    sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "sessions_expiry" }),
  ]).catch(error => { indexes = undefined; throw error; });
  await indexes;
  return { accounts, sessions };
}

export async function createAccount(data: RegistrationData, product: ProductKind) {
  const { accounts, sessions } = await accountCollections();
  await notificationCollection();
  const client = await getMongoClient();
  const token = randomBytes(32).toString("hex");
  const now = new Date();
  const account: AccountDocument = {
    ...data, email: data.email.toLowerCase(), product,
    _id: new ObjectId(), createdAt: now, kycStatus: "not_started", balance: 0,
  };
  // Keep account creation and session creation together: neither is acknowledged
  // until both writes are committed by Atlas.
  await client.withSession(async session => {
    await session.withTransaction(async () => {
      await accounts.insertOne(account, { session });
      await sessions.insertOne({
        _id: tokenHash(token), accountId: account._id, createdAt: now,
        expiresAt: new Date(now.getTime() + sessionDuration * 1000),
      }, { session });
      await queueEmail(account._id, `account_created:${account._id}`, { kind: "account_created" }, session);
    });
  });
  return { account, token };
}

export async function currentAccount(): Promise<AccountDocument | null> {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const { accounts, sessions } = await accountCollections();
  const session = await sessions.findOne({ _id: tokenHash(token), expiresAt: { $gt: new Date() } });
  if (!session) return null;
  return accounts.findOne({ _id: session.accountId });
}

export async function endSession() {
  const token = (await cookies()).get(sessionCookie)?.value;
  if (token && /^[a-f0-9]{64}$/.test(token)) {
    const { sessions } = await accountCollections();
    await sessions.deleteOne({ _id: tokenHash(token) });
  }
}

export function dashboardProfile(account: AccountDocument): DashboardProfile {
  return {
    id: account._id.toHexString(), name: `${account.lastName} ${account.firstName}`,
    firstName: account.firstName, lastName: account.lastName,
    birth: registrationSummary(account)[2][1], city: account.city, address: account.address,
    email: account.email, phone: account.phone, citizenship: account.citizenship,
    residence: account.residence, occupation: account.occupation, income: account.income,
    kycStatus: account.kycStatus,
    kycRejectionReason: account.kycRejectionReason,
    product: account.product, balance: typeof account.balance === "number" && Number.isFinite(account.balance) ? account.balance : 0,
    limit: 0, used: 0, payment: 0, lastDigits: "••••",
  };
}

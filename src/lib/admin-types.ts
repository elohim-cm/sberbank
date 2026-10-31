import type { KycDocumentKind, KycSlot } from "./kyc";

export type AdminAccount = {
  id: string; name: string; email: string; createdAt: string;
  product: "virtual" | "credit"; balance: number;
  kycStatus: "not_started" | "pending" | "approved" | "rejected";
  requestId: string | null; submittedAt: string | null; documentKind: KycDocumentKind | null;
};
export type AdminOverview = {
  accounts: AdminAccount[]; total: number; page: number; pageSize: number;
  stats: { accounts: number; pending: number; approved: number; emailsQueued: number };
};
export type AdminAccountDetail = {
  account: AdminAccount;
  fields: [string, string][];
  request: { id: string; status: "draft" | "pending" | "approved" | "rejected"; gender: "male" | "female"; documentKind: KycDocumentKind; submittedAt: string | null; approvedAt: string | null; rejectedAt: string | null; rejectionReason: string | null; complete: boolean } | null;
  files: { id: string; slot: KycSlot; size: number; width: number; height: number }[];
  notifications: { id: string; kind: string; status: string; createdAt: string; sentAt: string | null; attempts: number }[];
  credits: AdminCreditReceipt[];
};

export type AdminCreditReceipt = {
  transferId: string; amountMinor: number; balanceBeforeMinor: number;
  balanceAfterMinor: number; reference: string; confirmedAt: string;
};

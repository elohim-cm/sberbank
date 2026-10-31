export type KycDocumentKind = "passport" | "identity" | "licence";
export type KycSlot = "front" | "back" | "selfie";
export type KycGender = "male" | "female";
export function validKycRejectionReason(value: unknown): value is string {
  return typeof value === "string" && value.trim().length >= 3 && value.trim().length <= 500;
}
export const maxKycImageBytes = 3 * 1024 * 1024;
export const maxKycInputBytes = 10 * 1024 * 1024;
export const kycImageTypes = ["image/jpeg", "image/png", "image/webp"];

export function requiredKycSlots(kind: KycDocumentKind): KycSlot[] {
  return kind === "passport" ? ["front", "selfie"] : ["front", "back", "selfie"];
}

export function isDocumentKind(value: unknown): value is KycDocumentKind {
  return value === "passport" || value === "identity" || value === "licence";
}

export function isKycSlot(value: unknown): value is KycSlot {
  return value === "front" || value === "back" || value === "selfie";
}

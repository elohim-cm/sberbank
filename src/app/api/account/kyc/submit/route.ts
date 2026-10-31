import { after, NextResponse } from "next/server";
import { readSmallJson, sameOrigin } from "@/lib/server/http";
import { KycError, kycErrorResponse, requireKycAccount, submitKyc } from "@/lib/server/kyc";
import { deliverEmailsSafely } from "@/lib/server/notifications";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new KycError(403, "Запрос отклонён.");
    const account = await requireKycAccount();
    let input;
    try { input = await readSmallJson(request); } catch { throw new KycError(400, "Проверьте данные заявки."); }
    if (!input || typeof input !== "object" || !("requestId" in input) || typeof input.requestId !== "string") throw new KycError(400, "Заявка не найдена.");
    const requestId = input.requestId;
    await submitKyc(account, requestId);
    after(() => deliverEmailsSafely(account._id, `kyc_received:${requestId.toLowerCase()}`).then(() => undefined));
    return NextResponse.json({ status: "pending" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return kycErrorResponse(error); }
}

import { NextResponse } from "next/server";
import { isDocumentKind } from "@/lib/kyc";
import { readSmallJson, sameOrigin } from "@/lib/server/http";
import { KycError, kycCollections, kycErrorResponse, requireKycAccount, startKycDraft } from "@/lib/server/kyc";

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new KycError(403, "Запрос отклонён.");
    const account = await requireKycAccount();
    let input;
    try { input = await readSmallJson(request); } catch { throw new KycError(400, "Проверьте данные заявки."); }
    if (!input || typeof input !== "object" || !("documentKind" in input) || !("gender" in input) || !isDocumentKind(input.documentKind) || (input.gender !== "male" && input.gender !== "female")) throw new KycError(400, "Выберите пол и тип документа.");
    const draft = await startKycDraft(account, input.documentKind, input.gender);
    return NextResponse.json({ requestId: draft._id.toHexString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return kycErrorResponse(error); }
}

export async function GET() {
  try {
    const account = await requireKycAccount();
    const { requests } = await kycCollections();
    const draft = await requests.findOne({ accountId: account._id });
    return NextResponse.json({ request: draft ? { id: draft._id.toHexString(), status: draft.status, documentKind: draft.documentKind, gender: draft.gender, files: Object.fromEntries(Object.entries(draft.files).map(([slot, id]) => [slot, id.toHexString()])) } : null }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return kycErrorResponse(error); }
}

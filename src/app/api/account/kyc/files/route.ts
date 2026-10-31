import { NextResponse } from "next/server";
import { isKycSlot, maxKycImageBytes } from "@/lib/kyc";
import { readLimitedBody, sameOrigin } from "@/lib/server/http";
import { KycError, kycErrorResponse, requireKycAccount, storeKycImage } from "@/lib/server/kyc";

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new KycError(403, "Запрос отклонён.");
    const account = await requireKycAccount();
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.startsWith("multipart/form-data;")) throw new KycError(400, "Выберите фотографию для отправки.");
    let form;
    try {
      const body = await readLimitedBody(request, maxKycImageBytes + 16_384);
      form = await new Response(new Uint8Array(body), { headers: { "Content-Type": contentType } }).formData();
    } catch { throw new KycError(413, "Не удалось прочитать файл. Максимальный размер фотографии — 3 МБ."); }
    const file = form.get("file");
    const slot = form.get("slot");
    const requestId = form.get("requestId");
    if (!(file instanceof File) || !isKycSlot(slot) || typeof requestId !== "string") throw new KycError(400, "Проверьте фотографию и сторону документа.");
    const fileId = await storeKycImage(account, requestId, slot, file);
    return NextResponse.json({ fileId, slot }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return kycErrorResponse(error); }
}

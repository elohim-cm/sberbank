import { ObjectId } from "mongodb";
import { KycError, kycCollections, kycErrorResponse, requireKycAccount } from "@/lib/server/kyc";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const account = await requireKycAccount();
    const { id } = await params;
    if (!ObjectId.isValid(id)) throw new KycError(404, "Фотография не найдена.");
    const { files } = await kycCollections();
    const file = await files.findOne({ _id: new ObjectId(id), accountId: account._id });
    if (!file) throw new KycError(404, "Фотография не найдена.");
    return new Response(new Uint8Array(file.bytes.buffer), { headers: {
      "Content-Type": file.contentType, "Content-Length": String(file.size),
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${file.slot}.jpg"`,
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    } });
  } catch (error) { return kycErrorResponse(error); }
}

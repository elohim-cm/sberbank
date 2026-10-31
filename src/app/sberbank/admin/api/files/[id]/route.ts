import { ObjectId } from "mongodb";
import { AdminError, adminErrorResponse, requireAdmin } from "@/lib/server/admin-access";
import { kycCollections } from "@/lib/server/kyc";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    if (!ObjectId.isValid(id)) throw new AdminError(404, "Фотография не найдена.");
    const file = await (await kycCollections()).files.findOne({ _id: new ObjectId(id) });
    if (!file) throw new AdminError(404, "Фотография не найдена.");
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(file.bytes.buffer), { headers: {
      "Content-Type": "image/jpeg", "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="kyc-${file.slot}-${file._id}.jpg"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    } });
  } catch (error) { return adminErrorResponse(error); }
}

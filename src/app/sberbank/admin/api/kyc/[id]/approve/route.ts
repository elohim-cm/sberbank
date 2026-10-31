import { after } from "next/server";
import { AdminError, adminErrorResponse, requireAdmin, requireAdminOrigin } from "@/lib/server/admin-access";
import { approveAdminKyc } from "@/lib/server/admin";
import { deliverEmailsSafely } from "@/lib/server/notifications";
import { readSmallJson } from "@/lib/server/http";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdminOrigin(request);
    const access = await requireAdmin();
    let body;
    try { body = await readSmallJson(request, 1024); } catch { throw new AdminError(400, "Подтвердите проверку фотографий."); }
    if (!body || typeof body !== "object" || !("reviewed" in body) || body.reviewed !== true) throw new AdminError(400, "Подтвердите проверку фотографий.");
    const { id } = await params;
    const accountId = await approveAdminKyc(id, access);
    after(() => deliverEmailsSafely(accountId, `kyc_approved:${id.toLowerCase()}`).then(() => undefined));
    return Response.json({ status: "approved" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}

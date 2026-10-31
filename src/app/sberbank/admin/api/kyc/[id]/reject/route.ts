import { after } from "next/server";
import { AdminError, adminErrorResponse, requireAdmin, requireAdminOrigin } from "@/lib/server/admin-access";
import { rejectAdminKyc } from "@/lib/server/admin";
import { deliverEmailsSafely } from "@/lib/server/notifications";
import { readSmallJson } from "@/lib/server/http";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdminOrigin(request);
    const access = await requireAdmin();
    let body;
    try { body = await readSmallJson(request, 8192); } catch { throw new AdminError(400, "Укажите причину отказа и подтвердите решение."); }
    if (!body || typeof body !== "object" || !("reviewed" in body) || body.reviewed !== true || !("reason" in body)) throw new AdminError(400, "Укажите причину отказа и подтвердите решение.");
    const { id } = await params;
    const accountId = await rejectAdminKyc(id, body.reason, access);
    after(() => deliverEmailsSafely(accountId, `kyc_rejected:${id.toLowerCase()}`).then(() => undefined));
    return Response.json({ status: "rejected" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}

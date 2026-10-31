import { ObjectId } from "mongodb";
import { after } from "next/server";
import { AdminError, adminErrorResponse, requireAdmin, requireAdminOrigin } from "@/lib/server/admin-access";
import { creditAdminAccount } from "@/lib/server/admin-credit";
import { readSmallJson } from "@/lib/server/http";
import { deliverEmailsSafely } from "@/lib/server/notifications";

export const maxDuration = 60;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdminOrigin(request);
    const access = await requireAdmin();
    let input;
    try { input = await readSmallJson(request, 2048); } catch { throw new AdminError(400, "Проверьте данные зачисления."); }
    if (!input || typeof input !== "object" || !("amountMinor" in input) || typeof input.amountMinor !== "number" || !("operationKey" in input) || typeof input.operationKey !== "string" || !("confirmed" in input) || input.confirmed !== true) throw new AdminError(400, "Подтвердите сумму и получателя.");
    const { id } = await params;
    const result = await creditAdminAccount(id, input.amountMinor, input.operationKey, access);
    after(() => deliverEmailsSafely(new ObjectId(id), `incoming_transfer:${result.transferId}`).then(() => undefined));
    return Response.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return adminErrorResponse(error); }
}

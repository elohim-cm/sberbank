import { adminErrorResponse, requireAdmin } from "@/lib/server/admin-access";
import { adminAccountDetail } from "@/lib/server/admin";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;
    return Response.json(await adminAccountDetail(id), { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) { return adminErrorResponse(error); }
}

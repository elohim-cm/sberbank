import { adminErrorResponse, requireAdmin } from "@/lib/server/admin-access";
import { adminOverview } from "@/lib/server/admin";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    return Response.json(await adminOverview(new URL(request.url).searchParams), { headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
  } catch (error) { return adminErrorResponse(error); }
}

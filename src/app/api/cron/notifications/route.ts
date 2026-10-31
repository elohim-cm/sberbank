import { timingSafeEqual } from "node:crypto";
import { deliverEmails } from "@/lib/server/notifications";
import { queueConfirmedEventNotifications } from "@/lib/server/notification-events";

export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (!secret || secret.length < 32 || Buffer.byteLength(authorization) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(authorization), Buffer.from(expected))) {
    return Response.json({ message: "Unauthorized" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const events = await queueConfirmedEventNotifications();
    const delivery = await deliverEmails(undefined, 10);
    return Response.json({ ...events, ...delivery }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("Notification cron failed");
    return Response.json({ message: "Notification processing failed" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

import { NextResponse } from "next/server";
import { adminCodeConfigured, adminCookie, adminCookiePath, adminSessionSeconds, createAdminToken, matchesAdminCode, adminErrorResponse, AdminError, requireAdminOrigin } from "@/lib/server/admin-access";
import { readSmallJson } from "@/lib/server/http";
import { getDatabase } from "@/lib/server/mongodb";

export async function POST(request: Request) {
  try {
    requireAdminOrigin(request);
    if (!adminCodeConfigured()) throw new AdminError(503, "Доступ не настроен. Укажите ADMIN_ACCESS_CODE на сервере.");
    let input;
    try { input = await readSmallJson(request, 2048); } catch { throw new AdminError(400, "Введите код доступа."); }
    if (!input || typeof input !== "object" || !("code" in input) || typeof input.code !== "string" || input.code.length > 512) throw new AdminError(400, "Введите код доступа.");
    // A persisted global budget covers all serverless instances without storing codes or IPs.
    const windowMs = 15 * 60_000;
    const bucket = Math.floor(Date.now() / windowMs);
    const limits = (await getDatabase()).collection<{ _id: string; attempts: number; expiresAt: Date }>("admin_login_limits");
    await limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "admin_login_expiry" });
    const counter = await limits.findOneAndUpdate({ _id: `admin:${bucket}` }, { $inc: { attempts: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) } }, { upsert: true, returnDocument: "after" });
    if ((counter?.attempts ?? 21) > 20) throw new AdminError(429, "Слишком много попыток. Повторите через 15 минут.");
    if (!matchesAdminCode(input.code)) throw new AdminError(401, "Неверный код доступа.");
    const response = NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(adminCookie, createAdminToken(), { httpOnly: true, secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL, sameSite: "strict", path: adminCookiePath, maxAge: adminSessionSeconds });
    return response;
  } catch (error) { return adminErrorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    requireAdminOrigin(request);
    const response = NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set(adminCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production" || !!process.env.VERCEL, sameSite: "strict", path: adminCookiePath, maxAge: 0 });
    return response;
  } catch (error) { return adminErrorResponse(error); }
}

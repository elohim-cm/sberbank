import { NextResponse } from "next/server";
import { currentAccount, dashboardProfile, endSession, sessionCookie } from "@/lib/server/accounts";
import { sameOrigin } from "@/lib/server/http";

export async function GET() {
  try {
    const account = await currentAccount();
    if (!account) return NextResponse.json({ message: "Войдите в личный кабинет." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    return NextResponse.json({ profile: dashboardProfile(account) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ message: "Не удалось загрузить профиль. Попробуйте позже." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  try { await endSession(); }
  catch { return NextResponse.json({ message: "Не удалось завершить сеанс. Повторите попытку." }, { status: 503 }); }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(sessionCookie, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}

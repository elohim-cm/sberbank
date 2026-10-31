import { after, NextResponse } from "next/server";
import { emptyRegistration, validateRegistration, type RegistrationData } from "@/app/inscription/registration-data";
import { createAccount, dashboardProfile, sessionCookie, sessionDuration } from "@/lib/server/accounts";
import { readSmallJson, sameOrigin } from "@/lib/server/http";
import { deliverEmailsSafely } from "@/lib/server/notifications";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ message: "Запрос отклонён." }, { status: 403 });
  let body: unknown;
  try { body = await readSmallJson(request); }
  catch { return NextResponse.json({ message: "Не удалось прочитать данные формы." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ message: "Проверьте данные формы." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (input.product !== "virtual" && input.product !== "credit") return NextResponse.json({ message: "Выберите продукт." }, { status: 400 });
  const data = { ...emptyRegistration };
  for (const key of Object.keys(data) as (keyof RegistrationData)[]) {
    const value = input[key];
    if (typeof value !== "string" || value.length > 254) return NextResponse.json({ message: "Проверьте данные формы." }, { status: 400 });
    data[key] = value.trim();
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const errors = validateRegistration(data, today);
  if (Object.keys(errors).length) return NextResponse.json({ message: "Проверьте заполненные поля.", errors }, { status: 400 });
  try {
    const { account, token } = await createAccount(data, input.product);
    after(() => deliverEmailsSafely(account._id, `account_created:${account._id}`).then(() => undefined));
    const response = NextResponse.json({ profile: dashboardProfile(account) }, { status: 201, headers: { "Cache-Control": "no-store" } });
    response.cookies.set(sessionCookie, token, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
      path: "/", maxAge: sessionDuration,
    });
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === 11000) return NextResponse.json({ message: "Этот адрес электронной почты уже зарегистрирован." }, { status: 409 });
    // Never expose driver messages, connection strings, or submitted personal data.
    console.error("Account creation failed", error instanceof Error ? error.name : "UnknownError");
    return NextResponse.json({ message: "Не удалось сохранить профиль. Попробуйте ещё раз позже." }, { status: 503 });
  }
}

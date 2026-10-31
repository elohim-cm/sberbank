import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";

export const adminCookie = "bank_admin_access";
export const adminCookiePath = "/sberbank/admin";
export const adminSessionSeconds = 8 * 60 * 60;
export type AdminAccess = "local" | "code";

export class AdminError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const adminCodeConfigured = () => (process.env.ADMIN_ACCESS_CODE?.length ?? 0) >= 16;
export function matchesAdminCode(value: string) {
  if (!adminCodeConfigured()) return false;
  const hash = (input: string) => createHash("sha256").update(input).digest();
  return timingSafeEqual(hash(value), hash(process.env.ADMIN_ACCESS_CODE!));
}

export function localAdminAllowed(requestHeaders: Pick<Headers, "get">) {
  if (process.env.NODE_ENV !== "development" || process.env.VERCEL) return false;
  const isLoopback = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(host);
  const host = requestHeaders.get("host") || "";
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  return isLoopback(host) && (!forwardedHost || isLoopback(forwardedHost));
}

export function createAdminToken() {
  if (!adminCodeConfigured()) throw new AdminError(503, "Код доступа не настроен.");
  const payload = `${Math.floor(Date.now() / 1000) + adminSessionSeconds}.${randomBytes(24).toString("hex")}`;
  const signature = createHmac("sha256", process.env.ADMIN_ACCESS_CODE!).update(`admin:${payload}`).digest("hex");
  return `${payload}.${signature}`;
}

export function validAdminToken(token: string | undefined) {
  if (!token || !adminCodeConfigured() || !/^\d{10}\.[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, nonce, signature] = token.split(".");
  const timestamp = Number(expires);
  const now = Math.floor(Date.now() / 1000);
  if (timestamp <= now || timestamp > now + adminSessionSeconds + 5) return false;
  const expected = createHmac("sha256", process.env.ADMIN_ACCESS_CODE!).update(`admin:${expires}.${nonce}`).digest();
  return timingSafeEqual(Buffer.from(signature, "hex"), expected);
}

export async function currentAdmin(): Promise<AdminAccess | null> {
  if (localAdminAllowed(await headers())) return "local";
  return validAdminToken((await cookies()).get(adminCookie)?.value) ? "code" : null;
}

export async function requireAdmin() {
  const access = await currentAdmin();
  if (!access) throw new AdminError(401, "Введите код доступа администратора.");
  return access;
}

export function requireAdminOrigin(request: Request) {
  // Next's internal Request URL can use the bind hostname (e.g. 127.0.0.1)
  // rather than the browser-facing Host. Compare against that HTTP Host instead.
  const url = new URL(request.url);
  const host = request.headers.get("host") || url.host;
  const protocol = process.env.VERCEL ? request.headers.get("x-forwarded-proto") || url.protocol.slice(0, -1) : url.protocol.slice(0, -1);
  if (!["http", "https"].includes(protocol) || request.headers.get("origin") !== `${protocol}://${host}` || request.headers.get("sec-fetch-site") === "cross-site") throw new AdminError(403, "Запрос отклонён.");
}

export function adminErrorResponse(error: unknown) {
  unstable_rethrow(error);
  if (!(error instanceof AdminError)) console.error("Admin operation failed", error instanceof Error ? error.name : "UnknownError");
  return Response.json({ message: error instanceof AdminError ? error.message : "Не удалось выполнить действие. Повторите попытку." }, {
    status: error instanceof AdminError ? error.status : 503,
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}

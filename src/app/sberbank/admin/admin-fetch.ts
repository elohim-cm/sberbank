const api = "/sberbank/admin/api";

export class AdminRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${api}${path}`, { ...options, cache: "no-store", signal: options?.signal ?? AbortSignal.timeout(45_000) });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401 && path !== "/auth") window.location.reload();
    throw new AdminRequestError(response.status, body?.message || "Не удалось загрузить данные. Повторите попытку.");
  }
  return body as T;
}

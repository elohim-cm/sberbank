import { currentAccount } from "@/lib/server/accounts";
import { accountOperations, OperationCursorError } from "@/lib/server/account-operations";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  try {
    const account = await currentAccount();
    if (!account) return Response.json({ message: "Войдите в личный кабинет." }, { status: 401, headers });
    const cursor = new URL(request.url).searchParams.get("cursor");
    return Response.json(await accountOperations(account._id, cursor ?? undefined), { headers });
  } catch (error) {
    return Response.json({ message: error instanceof OperationCursorError ? error.message : "Не удалось загрузить историю. Попробуйте ещё раз." }, { status: error instanceof OperationCursorError ? 400 : 503, headers });
  }
}

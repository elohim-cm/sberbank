import "server-only";
import { ObjectId, type Filter } from "mongodb";
import type { AccountOperations } from "../account-operations";
import { getDatabase } from "./mongodb";

type IncomingOperation = {
  _id: ObjectId; accountId: ObjectId; status: string;
  amountMinor: number; currency: string; confirmedAt: Date;
};

export class OperationCursorError extends Error {}

function readCursor(value: string) {
  try {
    if (value.length > 200 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!cursor || typeof cursor.id !== "string" || !/^[a-f\d]{24}$/i.test(cursor.id) || typeof cursor.date !== "string") throw new Error();
    const date = new Date(cursor.date);
    if (!Number.isFinite(+date) || date.toISOString() !== cursor.date) throw new Error();
    return { id: new ObjectId(cursor.id), date };
  } catch { throw new OperationCursorError("Некорректная страница истории."); }
}

export async function accountOperations(accountId: ObjectId, cursor?: string): Promise<AccountOperations> {
  const filter: Filter<IncomingOperation> = {
    accountId, status: "confirmed", currency: "RUB",
    amountMinor: { $gt: 0, $lte: Number.MAX_SAFE_INTEGER },
    // Query $mod coerces fractional values to integers. The aggregation
    // expression preserves the fraction, so malformed sub-kopeck rows stay out.
    $expr: { $cond: [{ $in: [{ $type: "$amountMinor" }, ["double", "int", "long"]] }, { $eq: [{ $mod: ["$amountMinor", 1] }, 0] }, false] },
    confirmedAt: { $type: "date" },
  };
  if (cursor !== undefined) {
    const before = readCursor(cursor);
    filter.$or = [{ confirmedAt: { $lt: before.date } }, { confirmedAt: before.date, _id: { $lt: before.id } }];
  }
  const rows = await (await getDatabase()).collection<IncomingOperation>("incoming_transfers")
    .find(filter, { projection: { _id: 1, amountMinor: 1, confirmedAt: 1 } })
    .sort({ confirmedAt: -1, _id: -1 }).limit(21).toArray();
  const page = rows.slice(0, 20);
  const last = page.at(-1);
  return {
    items: page.map(row => ({ id: row._id.toHexString(), amountMinor: row.amountMinor, currency: "RUB", confirmedAt: row.confirmedAt.toISOString() })),
    nextCursor: rows.length > 20 && last ? Buffer.from(JSON.stringify({ id: last._id.toHexString(), date: last.confirmedAt.toISOString() })).toString("base64url") : null,
  };
}

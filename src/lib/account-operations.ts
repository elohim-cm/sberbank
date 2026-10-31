export type AccountOperation = {
  id: string;
  amountMinor: number;
  currency: "RUB";
  confirmedAt: string;
};

export type AccountOperations = {
  items: AccountOperation[];
  nextCursor: string | null;
  unavailable?: boolean;
};

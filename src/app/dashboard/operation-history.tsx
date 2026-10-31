"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { AccountOperations } from "@/lib/account-operations";
import Icon from "./icons";
import styles from "./dashboard.module.css";

const date = new Intl.DateTimeFormat("ru-RU", { timeZone: "Africa/Douala", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function OperationHistory({ initial, money, href }: { initial: AccountOperations; money: (value: number) => string; href?: string }) {
  const router = useRouter();
  const [history, setHistory] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);

  async function loadMore() {
    if (!history.nextCursor || controller.current) return;
    const request = new AbortController();
    controller.current = request;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/account/operations?cursor=${encodeURIComponent(history.nextCursor)}`, { cache: "no-store", signal: request.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Не удалось загрузить историю.");
      const next = result as AccountOperations;
      setHistory(current => ({ items: [...current.items, ...next.items.filter(item => !current.items.some(existing => existing.id === item.id))], nextCursor: next.nextCursor }));
    } catch (error) {
      if (!request.signal.aborted) setError(error instanceof Error ? error.message : "Не удалось загрузить историю.");
    } finally {
      if (!request.signal.aborted) { setBusy(false); controller.current = null; }
    }
  }

  const items = href ? history.items.slice(0, 5) : history.items;
  return <section className={`${styles.panel} ${styles.transactionPanel}`} aria-labelledby="transactions-title">
    <h2 id="transactions-title">История операций</h2>
    {initial.unavailable ? <div><p className={styles.subtle} role="alert">Не удалось загрузить историю операций.</p><button className={styles.outlineButton} type="button" onClick={() => router.refresh()}>Повторить</button></div>
      : items.length === 0 ? <p className={styles.subtle}>Операций пока нет.</p>
        : <ul className={styles.transactions}>{items.map(item => <li key={item.id} className={styles.operationRow}>
          <span className={`${styles.transactionIcon} ${styles.incoming}`} aria-hidden="true"><Icon name="plus" size={20} /></span>
          <div className={styles.transactionDescription}><strong>Зачисление на счёт</strong><time dateTime={item.confirmedAt}>{date.format(new Date(item.confirmedAt))}</time><span className={styles.operationStatus}>Зачислено</span></div>
          <span className={`${styles.transactionAmount} ${styles.positive}`}>+ {money(item.amountMinor / 100)}</span>
        </li>)}</ul>}
    {href && !initial.unavailable && items.length > 0 && <Link className={styles.allTransactions} href={href}>Все операции <Icon name="arrow" size={19} /></Link>}
    {error && <p className={styles.subtle} role="alert">{error}</p>}
    {!href && history.nextCursor && <button className={`${styles.outlineButton} ${styles.loadOperations}`} type="button" disabled={busy} onClick={() => void loadMore()}>{busy ? "Загружаем…" : error ? "Повторить загрузку" : "Показать ещё"}</button>}
  </section>;
}

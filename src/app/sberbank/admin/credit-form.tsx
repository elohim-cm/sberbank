"use client";

import { useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import type { AdminAccountDetail, AdminCreditReceipt } from "@/lib/admin-types";
import { rublesInputToMinor } from "@/lib/money";
import { adminFetch, AdminRequestError } from "./admin-fetch";
import Icon from "@/app/dashboard/icons";
import styles from "./admin.module.css";

type Draft = { operationKey: string; amountMinor: number; attempted: boolean };
const eventName = "admin-credit-draft";
const money = (minor: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(minor / 100);
function subscribe(callback: () => void) {
  window.addEventListener(eventName, callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener(eventName, callback); window.removeEventListener("storage", callback); };
}
function readDraft(key: string) { try { return sessionStorage.getItem(key); } catch { return null; } }
function parseDraft(value: string | null): Draft | null {
  try {
    const draft = value ? JSON.parse(value) : null;
    return draft && typeof draft.operationKey === "string" && /^[a-f\d-]{36}$/i.test(draft.operationKey) && Number.isSafeInteger(draft.amountMinor) && draft.amountMinor > 0 && typeof draft.attempted === "boolean" ? draft : null;
  } catch { return null; }
}

export default function CreditForm({ detail, busy, onBusy, onCredited }: { detail: AdminAccountDetail; busy: boolean; onBusy: (value: boolean) => void; onCredited: (result: AdminCreditReceipt) => void }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  const storageKey = `bank_admin_credit:${detail.account.id}`;
  const stored = useSyncExternalStore(subscribe, () => readDraft(storageKey), () => null);
  const draft = parseDraft(stored);
  const approved = detail.account.kycStatus === "approved" && detail.request?.status === "approved";
  function saveDraft(value: Draft | null) {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(eventName));
  }
  function prepare(event: FormEvent) {
    event.preventDefault();
    if (busy || !approved) return;
    const amountMinor = rublesInputToMinor(amount);
    if (amountMinor === null) { setError("Введите сумму больше нуля, не более двух знаков после запятой."); return; }
    try { saveDraft({ operationKey: crypto.randomUUID(), amountMinor, attempted: false }); setError(""); }
    catch { setError("Не удалось сохранить подтверждение операции. Разрешите хранилище браузера и повторите попытку."); }
  }
  async function credit() {
    if (!draft || !approved || inFlight.current || busy) return;
    inFlight.current = true; onBusy(true); setError("");
    try {
      // Persist before sending: a lost response or reload reuses this operation
      // instead of silently creating a second credit.
      saveDraft({ ...draft, attempted: true });
      const result = await adminFetch<AdminCreditReceipt>(`/accounts/${detail.account.id}/credits`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operationKey: draft.operationKey, amountMinor: draft.amountMinor, confirmed: true }) });
      try { saveDraft(null); } catch { /* Reusing the stored receipt key remains safe. */ }
      setAmount(""); onCredited(result);
    } catch (error) {
      if (error instanceof AdminRequestError && [400, 403, 404, 409].includes(error.status)) {
        try { saveDraft({ ...draft, attempted: false }); } catch { /* Keep the existing safe retry key. */ }
      }
      setError(error instanceof Error ? error.message : "Не удалось подтвердить зачисление.");
    }
    finally { inFlight.current = false; onBusy(false); }
  }
  return <section className={styles.creditBox} aria-labelledby="credit-title">
    <div className={styles.creditTitle}><Icon name="plus" size={20} /><h3 id="credit-title">Зачислить на баланс</h3><span>RUB</span></div>
    {!approved ? <p className={styles.muted}>Зачисление доступно после одобрения KYC клиента.</p> : draft ? <div className={styles.creditConfirmation}>
      <p className={styles.creditRecipient}>Получатель: <strong>{detail.account.name}</strong><span>{detail.account.email}</span></p>
      <strong className={styles.creditAmount}>+ {money(draft.amountMinor)}</strong>
      <p>{draft.attempted ? "Операция ожидает подтверждения. Повторное подтверждение не создаст второе зачисление." : "Сумма добавится к текущему балансу. Клиент получит уведомление по электронной почте."}</p>
      <div className={styles.decisionButtons}>{!draft.attempted && <button type="button" className={styles.secondary} disabled={busy} onClick={() => { try { saveDraft(null); setError(""); } catch { setError("Не удалось отменить подтверждение."); } }}>Отмена</button>}<button type="button" className={styles.primary} disabled={busy} onClick={() => void credit()}>{busy ? "Зачисляем…" : draft.attempted ? "Повторить подтверждение" : "Подтвердить зачисление"}</button></div>
    </div> : <form onSubmit={prepare}>
      <label htmlFor="admin-credit-amount">Сумма зачисления</label><div className={styles.creditInput}><input id="admin-credit-amount" name="amount" type="text" inputMode="decimal" autoComplete="off" placeholder="0,00" required maxLength={18} value={amount} onChange={event => setAmount(event.target.value)} disabled={busy} /><span>₽</span></div>
      <p>Сумма добавится к балансу {new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(detail.account.balance)}.</p><button className={styles.primary} type="submit" disabled={busy}>Продолжить<Icon name="arrow" size={17} /></button>
    </form>}
    {error && <p className={styles.error} role="alert">{error}</p>}
  </section>;
}

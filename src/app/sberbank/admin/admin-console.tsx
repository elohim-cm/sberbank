"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/app/dashboard/icons";
import branding from "@/app/header-data.json";
import type { AdminAccountDetail, AdminOverview } from "@/lib/admin-types";
import type { KycSlot } from "@/lib/kyc";
import { validKycRejectionReason } from "@/lib/kyc";
import styles from "./admin.module.css";
import { adminFetch } from "./admin-fetch";
import CreditForm from "./credit-form";

const api = "/sberbank/admin/api";
const money = (amount: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB" }).format(amount);
const date = (value: string | null) => value ? new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Douala" }).format(new Date(value)) : "—";
const statuses: Record<string, string> = { not_started: "Не отправлен", draft: "Черновик", pending: "На рассмотрении", approved: "Одобрен", rejected: "Не одобрен" };
const documents = { passport: "Паспорт", identity: "Удостоверение личности", licence: "Водительское удостоверение" };
const photoLabels: Record<KycSlot, string> = { front: "Лицевая сторона", back: "Обратная сторона", selfie: "Селфи" };
const emailLabels: Record<string, string> = { account_created: "Создание аккаунта", kyc_received: "Получение документов KYC", kyc_approved: "Одобрение KYC", kyc_rejected: "Отказ по KYC", incoming_transfer: "Входящий перевод" };
const emailStatuses: Record<string, string> = { queued: "В очереди", sending: "Отправляется", sent: "Принято Brevo", failed: "Ошибка отправки" };

export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function login(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await adminFetch("/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      setCode(""); router.refresh();
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось войти."); setBusy(false); }
  }
  return <main className={styles.loginPage}><div className={styles.loginCard}>
    <Image src={branding.logoImageUrl} width={122} height={48} alt="СберБанк" unoptimized />
    <span className={styles.loginSymbol}><Icon name="lock" size={28} /></span>
    <p className={styles.eyebrow}>Панель управления</p><h1>Доступ администратора</h1><p className={styles.muted}>Введите код доступа, чтобы открыть клиентские заявки и документы KYC.</p>
    {configured ? <form onSubmit={login}><label htmlFor="admin-code">Код доступа</label><input id="admin-code" name="code" type="password" autoComplete="current-password" required maxLength={512} value={code} onChange={event => setCode(event.target.value)} disabled={busy} autoFocus />
      {error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.primary} disabled={busy}>{busy ? "Открываем…" : "Открыть панель"}<Icon name="arrow" size={18} /></button></form>
      : <p className={styles.error} role="status">Доступ ещё не настроен. Добавьте ADMIN_ACCESS_CODE в переменные сервера. До настройки клиентские данные закрыты.</p>}
  </div></main>;
}

export default function AdminConsole({ access }: { access: "local" | "code" }) {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [detailResult, setDetailResult] = useState<AdminAccountDetail | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [success, setSuccess] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewer, setViewer] = useState<{ id: string; title: string } | null>(null);
  const detail = detailResult?.account.id === selected ? detailResult : null;

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ q: search, status, page: String(page) });
    adminFetch<AdminOverview>(`/overview?${params}`, { signal: controller.signal }).then(setOverview).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [search, status, page, revision]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    adminFetch<AdminAccountDetail>(`/accounts/${selected}`, { signal: controller.signal }).then(setDetailResult).catch(error => { if (!controller.signal.aborted) setDetailError(error.message); });
    return () => controller.abort();
  }, [selected, revision]);

  function refresh() { setError(""); setOverview(null); setDetailResult(null); setDetailError(""); setConfirm(false); setRejecting(false); setReason(""); setRevision(value => value + 1); }
  function select(id: string) { if (busy) return; setSelected(id); setDetailError(""); setConfirm(false); setRejecting(false); setReason(""); setSuccess(""); }
  function filter(value: string) { if (busy) return; setStatus(value); setPage(1); setOverview(null); setError(""); }
  async function approve() {
    if (!detail?.request || busy) return;
    setBusy(true); setDetailError("");
    try {
      await adminFetch(`/kyc/${detail.request.id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewed: true }) });
      setSuccess("Проверка KYC одобрена. Уведомление клиенту добавлено в очередь отправки.");
      refresh();
    } catch (error) { setDetailError(error instanceof Error ? error.message : "Не удалось одобрить заявку."); }
    finally { setBusy(false); }
  }
  async function logout() {
    if (busy) return;
    setBusy(true);
    try {
      await adminFetch("/auth", { method: "DELETE" });
      window.location.reload();
    } catch (error) { setError(error instanceof Error ? error.message : "Не удалось выйти."); setBusy(false); }
  }

  async function reject(event: FormEvent) {
    event.preventDefault();
    if (!detail?.request || busy || !validKycRejectionReason(reason)) return;
    setBusy(true); setDetailError("");
    try {
      await adminFetch(`/kyc/${detail.request.id}/reject`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reviewed: true, reason: reason.trim() }) });
      setSuccess("Заявка KYC не одобрена. Письмо с причиной отказа добавлено в очередь отправки.");
      refresh();
    } catch (error) { setDetailError(error instanceof Error ? error.message : "Не удалось сохранить решение."); }
    finally { setBusy(false); }
  }

  return <div className={styles.console}>
    <a className={styles.skipLink} href="#admin-main">Перейти к заявкам</a>
    <aside className={styles.sidebar}>
      <Image src={branding.logoImageUrl} width={122} height={48} alt="СберБанк" unoptimized />
      <div className={styles.sideLabel}>Управление</div><div className={styles.sideActive}><Icon name="shield" size={21} /><span>Проверка KYC</span></div>
      <div className={styles.sideNote}><Icon name="document" size={20} /><p>Клиенты, документы<br />и решения по заявкам</p></div>
      <div className={styles.sideBottom}><span className={styles.accessDot} />{access === "local" ? "Локальный доступ" : "Доступ по коду"}<p>Панель администратора</p></div>
    </aside>
    <div className={styles.workspace}>
      <header className={styles.topbar}><span>Администрирование <span className={styles.slash}>/</span> Проверка личности</span><div><span className={styles.accessBadge}><Icon name={access === "local" ? "settings" : "lock"} size={15} />{access === "local" ? "Локально" : "Защищённый доступ"}</span>{access === "code" && <button className={styles.iconButton} onClick={() => void logout()} disabled={busy} aria-label="Выйти из панели"><Icon name="logout" size={19} /></button>}</div></header>
      <main id="admin-main" className={styles.main}>
        <div className={styles.heading}><div><p className={styles.eyebrow}>Клиентские заявки</p><h1>Проверка личности</h1><p className={styles.muted}>Просматривайте документы и подтверждайте заявки KYC.</p></div><button className={styles.secondary} onClick={refresh} disabled={busy}><Icon name="refund" size={17} />Обновить</button></div>
        <div className={styles.stats} aria-label="Сводка по клиентам">{[
          ["Клиентов", overview?.stats.accounts, "user"], ["На рассмотрении", overview?.stats.pending, "credit"], ["Одобрено", overview?.stats.approved, "shield"], ["Писем в очереди", overview?.stats.emailsQueued, "list"],
        ].map(([label, value, icon], index) => <div key={String(label)} className={index === 1 ? styles.pendingStat : ""}><span>{label}</span><strong>{value ?? "—"}</strong><Icon name={icon as "user" | "credit" | "shield" | "list"} size={22} /></div>)}</div>
        {error && <div className={styles.error} role="alert">{error}<button className={styles.textButton} onClick={refresh}>Повторить</button></div>}
        <div className={`${styles.contentGrid} ${selected ? styles.detailsActive : ""}`}>
          <section className={styles.listPanel} aria-label="Список клиентов">
            <div className={styles.listHeading}><h2>Клиенты</h2><span>{overview ? `${overview.total} найдено` : "Загрузка…"}</span></div>
            <form className={styles.search} onSubmit={event => { event.preventDefault(); setSearch(query.trim()); setPage(1); setOverview(null); setError(""); setRevision(value => value + 1); }}><label className={styles.srOnly} htmlFor="admin-search">Имя или электронная почта</label><input id="admin-search" placeholder="Имя или электронная почта" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} /><button type="submit" disabled={busy}>Найти</button></form>
            <div className={styles.filters} role="group" aria-label="Статус KYC">{[["pending", "На рассмотрении"], ["approved", "Одобрены"], ["rejected", "Не одобрены"], ["not_started", "Не отправлены"], ["all", "Все"]].map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} disabled={busy} onClick={() => filter(value)}>{label}</button>)}</div>
            <div className={styles.rowLabels}><span>Клиент</span><span>Статус KYC</span></div>
            {!overview ? <div className={styles.empty} aria-busy="true"><span className={styles.spinner} />Загружаем клиентов…</div> : overview.accounts.length === 0 ? <div className={styles.empty}><Icon name="document" size={32} /><h3>Заявок пока нет</h3><p>{search ? "Попробуйте изменить поисковый запрос." : "Выберите другой статус или обновите список после получения новой заявки."}</p></div> : <ul className={styles.accountList}>{overview.accounts.map(account => <li key={account.id}><button className={`${styles.accountRow} ${selected === account.id ? styles.selectedRow : ""}`} onClick={() => select(account.id)} disabled={busy} aria-pressed={selected === account.id}>
              <span className={styles.avatar}>{account.name.trim().slice(0, 1).toUpperCase()}</span><span className={styles.accountName}><strong>{account.name}</strong><span>{account.email}</span><small>{account.submittedAt ? `Отправлено ${date(account.submittedAt)}` : `Регистрация ${date(account.createdAt)}`}</small></span><span className={`${styles.badge} ${account.kycStatus === "approved" ? styles.approvedBadge : account.kycStatus === "pending" ? styles.pendingBadge : styles.neutralBadge}`}>{statuses[account.kycStatus]}</span><Icon name="chevron" size={16} />
            </button></li>)}</ul>}
            {overview && overview.total > overview.pageSize && <div className={styles.pagination}><button className={styles.textButton} disabled={page <= 1 || busy} onClick={() => { setPage(page - 1); setOverview(null); }}>Назад</button><span>{page} / {Math.ceil(overview.total / overview.pageSize)}</span><button className={styles.textButton} disabled={page * overview.pageSize >= overview.total || busy} onClick={() => { setPage(page + 1); setOverview(null); }}>Далее</button></div>}
          </section>
          <section className={styles.detailPanel} aria-label="Данные выбранного клиента" aria-live="polite">
            {!selected ? <div className={styles.detailEmpty}><span><Icon name="document" size={34} /></span><h2>Выберите заявку</h2><p>Здесь появятся данные клиента, фотографии документа и селфи.</p><div>Документ <Icon name="arrow" size={15} /> Селфи <Icon name="arrow" size={15} /> Решение</div></div> : <>
              <button className={`${styles.textButton} ${styles.backToList}`} onClick={() => setSelected(null)} disabled={busy}>← Все клиенты</button>
              {success && <div className={styles.success} role="status">{success}</div>}{detailError && <div className={styles.error} role="alert">{detailError}<button className={styles.textButton} onClick={refresh} disabled={busy}>Повторить</button></div>}
              {!detail ? !detailError && <div className={styles.empty} aria-busy="true"><span className={styles.spinner} />Загружаем досье…</div> : <>
                <div className={styles.detailHeading}><p className={styles.eyebrow}>Досье клиента</p><h2>{detail.account.name}</h2><p>{detail.account.email}</p><span className={`${styles.badge} ${detail.account.kycStatus === "approved" ? styles.approvedBadge : styles.neutralBadge}`}>{statuses[detail.request?.status || "not_started"]}</span></div>
                <div className={styles.accountFacts}><div><span>Продукт</span><strong>{detail.account.product === "credit" ? "Кредитная карта" : "Виртуальная карта"}</strong></div><div><span>Текущий баланс</span><strong>{money(detail.account.balance)}</strong></div></div>
                <CreditForm key={detail.account.id} detail={detail} busy={busy} onBusy={setBusy} onCredited={result => { setSuccess(`На баланс ${detail.account.name} зачислено ${money(result.amountMinor / 100)}. Уведомление клиенту добавлено в очередь отправки.`); refresh(); }} />
                {detail.credits.length > 0 && <details className={styles.creditHistory}><summary>История зачислений <span>{detail.credits.length}</span><Icon name="chevron" size={16} /></summary><ul>{detail.credits.map(credit => <li key={credit.transferId}><div><strong>+ {money(credit.amountMinor / 100)}</strong><time dateTime={credit.confirmedAt}>{date(credit.confirmedAt)}</time></div><p>{money(credit.balanceBeforeMinor / 100)} → {money(credit.balanceAfterMinor / 100)}</p><small>{credit.reference}</small></li>)}</ul></details>}
                <details className={styles.personal}><summary>Персональные данные <Icon name="chevron" size={17} /></summary><dl>{detail.fields.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></details>
                <div className={styles.sectionHeading}><h3>Документы KYC</h3>{detail.request && <span>{documents[detail.request.documentKind]}</span>}</div>
                {detail.request && <p className={styles.documentMeta}>{detail.request.gender === "male" ? "Мужчина" : "Женщина"} · {detail.request.status === "approved" ? `Одобрено ${date(detail.request.approvedAt)}` : `Отправлено ${date(detail.request.submittedAt)}`}</p>}
                {detail.files.length === 0 ? <div className={styles.noDocuments}><Icon name="document" size={24} /><p>Клиент ещё не загрузил фотографии.</p></div> : <div className={styles.photos}>{detail.files.slice().sort((a, b) => ["front", "back", "selfie"].indexOf(a.slot) - ["front", "back", "selfie"].indexOf(b.slot)).map(file => <div className={styles.photoCard} key={file.id}><button type="button" className={styles.photoPreview} onClick={() => setViewer({ id: file.id, title: file.slot === "front" && detail.request?.documentKind === "passport" ? "Страница паспорта" : photoLabels[file.slot] })} aria-label={`Открыть: ${photoLabels[file.slot]}`}>
                  {/* Private images use the authenticated route directly, never the shared image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`${api}/files/${file.id}`} alt={photoLabels[file.slot]} loading="lazy" /><span><Icon name="eye" size={17} />Открыть</span></button><div className={styles.photoCaption}><strong>{file.slot === "front" && detail.request?.documentKind === "passport" ? "Страница паспорта" : photoLabels[file.slot]}</strong><a href={`${api}/files/${file.id}?download=1`} download aria-label={`Скачать: ${photoLabels[file.slot]}`}>Скачать ↓</a></div><small>{file.width} × {file.height} · {Math.ceil(file.size / 1024)} КБ</small></div>)}</div>}
                {detail.request?.status === "pending" && <div className={styles.decision}>
                  {!detail.request.complete && <p className={styles.error}>Не все обязательные фотографии доступны. Одобрить заявку нельзя.</p>}
                  {rejecting ? <form className={styles.rejectForm} onSubmit={event => void reject(event)}><h3>Отклонить заявку KYC?</h3><label htmlFor="kyc-rejection-reason">Причина отказа</label><textarea id="kyc-rejection-reason" required minLength={3} maxLength={500} rows={4} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} /><p>Клиент получит письмо с этой причиной и сможет повторно отправить документы.</p><div className={styles.decisionButtons}><button type="button" className={styles.secondary} disabled={busy} onClick={() => setRejecting(false)}>Отмена</button><button type="submit" className={styles.primary} disabled={busy || !validKycRejectionReason(reason)}>{busy ? "Сохраняем…" : "Подтвердить отказ"}</button></div></form> : <>
                  {confirm ? <><h3>Подтвердить проверку?</h3><p>Подтвердите, что вы просмотрели документ и селфи клиента. Статус KYC изменится на «Одобрен», клиенту будет отправлено уведомление.</p><div className={styles.decisionButtons}><button className={styles.secondary} disabled={busy} onClick={() => setConfirm(false)}>Отмена</button><button className={styles.primary} disabled={busy} onClick={() => void approve()}>{busy ? "Сохраняем…" : "Подтвердить одобрение"}</button></div></> : <><p>Просмотрите все фотографии перед принятием решения.</p><button className={styles.primary} disabled={!detail.request.complete || busy} onClick={() => setConfirm(true)}><Icon name="shield" size={19} />Одобрить KYC</button></>}
                  {!confirm && <button className={styles.secondary} disabled={busy} onClick={() => setRejecting(true)}>Отклонить KYC</button>}</>}
                </div>}
                {detail.request?.status === "approved" && <div className={styles.success}><Icon name="shield" size={20} />Проверка личности одобрена.</div>}
                {detail.request?.status === "rejected" && <div className={styles.error}><strong>Заявка не одобрена · {date(detail.request.rejectedAt)}</strong><p>{detail.request.rejectionReason}</p></div>}
                <div className={styles.sectionHeading}><h3>Уведомления клиенту</h3><span>Последние 20</span></div>
                {detail.notifications.length === 0 ? <p className={styles.muted}>Уведомлений пока нет.</p> : <ul className={styles.emailList}>{detail.notifications.map(item => <li key={item.id}><Icon name={item.status === "failed" ? "help" : "list"} size={18} /><div><strong>{emailLabels[item.kind] || item.kind}</strong><span>{date(item.sentAt || item.createdAt)}</span></div><span className={item.status === "failed" ? styles.failedText : styles.emailStatus}>{emailStatuses[item.status] || item.status}</span></li>)}</ul>}
              </>}
            </>}
          </section>
        </div>
      </main>
    </div>
    {viewer && <PhotoViewer file={viewer} onClose={() => setViewer(null)} />}
  </div>;
}

function PhotoViewer({ file, onClose }: { file: { id: string; title: string }; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} className={styles.viewer} aria-labelledby="photo-title" onClose={event => { if (!event.currentTarget.open) onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }}><header><h2 id="photo-title">{file.title}</h2><button className={styles.iconButton} autoFocus onClick={onClose} aria-label="Закрыть фотографию"><Icon name="close" /></button></header>
    {/* eslint-disable-next-line @next/next/no-img-element -- This private image requires the admin cookie and must bypass the image optimizer. */}
    <img src={`${api}/files/${file.id}`} alt={file.title} /><footer><a className={styles.secondary} href={`${api}/files/${file.id}?download=1`} download>Скачать фотографию ↓</a><a className={styles.textButton} href={`${api}/files/${file.id}`} target="_blank" rel="noopener noreferrer">Открыть оригинал ↗</a></footer></dialog>;
}

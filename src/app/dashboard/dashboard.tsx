"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { dashboardHref, type ProductKind } from "../test-profiles";
import Icon from "./icons";
import styles from "./dashboard.module.css";
import VerificationDialog from "./verification-dialog";
import type { DashboardProfile } from "../inscription/registration-data";
import BankCard from "./bank-card";
import OperationHistory from "./operation-history";
import CreditGuide from "./credit-guide";
import type { AccountOperations } from "@/lib/account-operations";

const navigation = [
  { id: "home", label: "Главная", icon: "home" },
  { id: "cards", label: "Карты", icon: "card" },
  { id: "accounts", label: "Счета", icon: "account" },
  { id: "transactions", label: "Операции", icon: "list" },
  { id: "transfers", label: "Переводы", icon: "transfer" },
  { id: "credit", label: "Кредит", icon: "credit" },
  { id: "profile", label: "Профиль", icon: "user" },
  { id: "help", label: "Помощь", icon: "help" },
] as const;
type Section = typeof navigation[number]["id"];
type Period = "week" | "month" | "year";
type Overlay = "verification" | "more" | "security" | "settings" | null;
type Fixture = DashboardProfile;
type Money = (value: number) => string;
type Brand = { logo: string; name: string };
const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", minimumFractionDigits: 2, maximumFractionDigits: 2 });
export default function Dashboard({ brand, profile, operations }: { brand: Brand; profile: DashboardProfile; operations: AccountOperations }) {
  const params = useSearchParams();
  const product = profile.product;
  const section: Section = navigation.find(item => item.id === params.get("section"))?.id ?? "home";
  return <DashboardView key={profile.id} profile={profile} operations={operations} product={product} section={section} brand={brand} />;
}

function DashboardView({ profile, product, section, brand, operations }: { profile: Fixture; product: ProductKind; section: Section; brand: Brand; operations: AccountOperations }) {
  const [hidden, setHidden] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [profileOpen, setProfileOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const router = useRouter();
  const [submissionCompleted, setSubmissionCompleted] = useState(false);
  const [approvalBannerDismissed, setApprovalBannerDismissed] = useState(false);
  const verificationApproved = profile.kycStatus === "approved";
  const verificationRejected = profile.kycStatus === "rejected";
  const verificationPending = !verificationApproved && !verificationRejected && (profile.kycStatus === "pending" || submissionCompleted);
  const profileRoot = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const infoDialog = useRef<HTMLDialogElement>(null);
  const infoTitle = useRef<HTMLHeadingElement>(null);
  const pageTitle = useRef<HTMLHeadingElement>(null);
  const title = section === "home" ? "Обзор" : navigation.find(item => item.id === section)!.label;
  const productTitle = product === "credit" ? "Кредитная карта" : "Виртуальная карта";
  const href = (target: Section) => dashboardHref(profile.id, product, target);
  const money: Money = value => hidden ? "•••• ₽" : currency.format(value);
  const operationsKey = `${profile.id}:${operations.unavailable ? "unavailable" : operations.items[0]?.id ?? "empty"}`;
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState("");

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError("");
    try {
      const response = await fetch("/api/account", { method: "DELETE" });
      if (!response.ok) throw new Error("logout");
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard cached authenticated pages after revoking the session.
      window.location.assign("/inscription");
    } catch { setLogoutError("Не удалось выйти. Повторите попытку."); setLoggingOut(false); }
  }

  useEffect(() => { pageTitle.current?.focus(); }, [section]);

  useEffect(() => {
    if (profile.kycStatus !== "pending" && profile.kycStatus !== "approved") return;
    const controller = new AbortController();
    let refreshing = false;
    async function checkDecision() {
      if (refreshing || document.visibilityState === "hidden") return;
      try {
        const response = await fetch("/api/account", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        if (result.profile && (result.profile.kycStatus !== profile.kycStatus || result.profile.balance !== profile.balance)) { refreshing = true; router.refresh(); }
      } catch { /* A temporary network error must not interrupt the dashboard. */ }
    }
    const interval = window.setInterval(() => void checkDecision(), 30_000);
    window.addEventListener("focus", checkDecision);
    document.addEventListener("visibilitychange", checkDecision);
    return () => { controller.abort(); window.clearInterval(interval); window.removeEventListener("focus", checkDecision); document.removeEventListener("visibilitychange", checkDecision); };
  }, [profile.kycStatus, profile.balance, router]);

  useEffect(() => {
    if (!profileOpen) return;
    const outside = (event: PointerEvent) => { if (!profileRoot.current?.contains(event.target as Node)) setProfileOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setProfileOpen(false); profileButton.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [profileOpen]);

  useEffect(() => {
    if (!overlay || overlay === "verification") return;
    const dialog = infoDialog.current;
    const previous = document.body.style.overflow;
    dialog?.showModal();
    infoTitle.current?.focus();
    document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = previous; };
  }, [overlay]);

  function navLink(item: typeof navigation[number], mobile = false) {
    return <Link key={item.id} href={href(item.id)} className={`${mobile ? styles.mobileNavLink : styles.navLink} ${section === item.id ? styles.active : ""}`} aria-current={section === item.id ? "page" : undefined} onClick={() => { setProfileOpen(false); setOverlay(null); }}><Icon name={item.icon} /><span>{mobile ? ({ home: "Главная", cards: "Карта", accounts: "Счёт", transactions: "Операции" } as Record<string, string>)[item.id] ?? item.label : item.label}</span></Link>;
  }

  const lockedMoney: Money = value => verificationApproved ? money(value) : "•••• ₽";
  const gate = (label: string, children: ReactNode) => verificationApproved ? children : <KycGate label={label} pending={verificationPending} onVerify={() => setOverlay("verification")}>{children}</KycGate>;
  const card = gate("Карты", <CardPanel profile={{ ...profile, lastDigits: "••••" }} product={product} money={lockedMoney} approved={verificationApproved} />);
  return <div className={styles.dashboard}>
    <a href="#dashboard-main" className={styles.skipLink}>Перейти к содержимому</a>
    <aside className={styles.sidebar} aria-label="Боковая панель">
      <Link href={href("home")} className={styles.brand} aria-label={`${brand.name} — главная`}>
        <Image src={brand.logo} width={121} height={48} alt="СберБанк" unoptimized />
      </Link>
      <nav className={styles.navigation} aria-label="Основные разделы">{navigation.slice(0, -1).map(item => navLink(item))}</nav>
      <div className={styles.sidebarBottom}>{navLink(navigation[7])}<p>Независимый проект<br />Тестовые данные</p></div>
    </aside>

    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <p className={styles.breadcrumb}>Личный кабинет <span>/</span> {section === "home" ? "Главная" : title}</p>
        <Link href={href("home")} className={styles.mobileBrand} aria-label={`${brand.name} — главная`}><Image src={brand.logo} width={91} height={36} alt="СберБанк" unoptimized /></Link>
        <div ref={profileRoot} className={styles.profileRoot}>
          <button ref={profileButton} className={styles.profileButton} type="button" title={profile.name} aria-expanded={profileOpen} aria-controls="dashboard-profile-menu" onClick={() => setProfileOpen(!profileOpen)}><Icon name="user" /><span className={styles.profileName}>{profile.name}</span><Icon name="chevron" size={17} /></button>
          {profileOpen && <nav id="dashboard-profile-menu" className={styles.profileMenu} aria-label="Меню профиля">
            <Link href={href("profile")} onClick={() => setProfileOpen(false)}><Icon name="user" size={19} /> Мой профиль</Link>
            <button type="button" onClick={() => setHidden(!hidden)}><Icon name={hidden ? "eye" : "eyeOff"} size={19} />{hidden ? "Показать суммы" : "Скрыть суммы"}</button>
            <button type="button" onClick={() => { setProfileOpen(false); setOverlay("settings"); }}><Icon name="settings" size={19} />Настройки</button>
            <button type="button" onClick={() => { setProfileOpen(false); setOverlay("security"); }}><Icon name="shield" size={19} />Безопасность</button>
            <span className={styles.language}>Язык интерфейса: Русский</span>
            <button type="button" disabled={loggingOut} onClick={() => void logout()}><Icon name="logout" size={19} />{loggingOut ? "Выходим…" : "Выйти"}</button>
            {logoutError && <p className={styles.subtle} role="alert">{logoutError}</p>}
          </nav>}
        </div>
      </header>

      <main id="dashboard-main" className={styles.main} tabIndex={-1}>
        {(!verificationApproved || !approvalBannerDismissed) && <section className={`${styles.kycBanner} ${verificationApproved ? styles.kycApproved : verificationPending ? styles.kycPending : ""}`} aria-label="Статус проверки личности" aria-live="polite" aria-atomic="true">
          <Icon name="shield" size={27} className={styles.kycIcon} />
          <div><h2>{verificationApproved ? "Личность подтверждена" : verificationRejected ? "Заявка KYC не одобрена" : verificationPending ? "Документы получены. Проверка в процессе" : "Подтвердите личность"}</h2><p>{verificationApproved ? "Проверка KYC одобрена. Информация о счетах, картах и балансе доступна для просмотра." : verificationRejected ? `${profile.kycRejectionReason || "Проверьте качество фотографий."} Исправьте замечания и повторно отправьте документы.` : verificationPending ? "Служба поддержки рассматривает вашу заявку. Карты, счета и финансовые операции станут доступны после подтверждения личности." : "Карты, счета, кредит и финансовые операции доступны после подтверждения личности."}</p></div>
          {!verificationPending && !verificationApproved && <button type="button" onClick={() => setOverlay("verification")}>Пройти проверку KYC</button>}
          {verificationApproved && <button type="button" className={styles.kycDismiss} onClick={() => setApprovalBannerDismissed(true)} aria-label="Закрыть уведомление о подтверждении личности"><Icon name="close" size={18} /></button>}
        </section>}
        <div className={styles.pageHeading}><h1 ref={pageTitle} tabIndex={-1}>{title}</h1><span className={styles.productBadge}>{productTitle}</span></div>

        {section === "home" && <>
          <div className={styles.topGrid}>
            <section className={`${styles.panel} ${styles.balancePanel}`} aria-labelledby="balance-title">
              <div className={styles.balanceLabel}><h2 id="balance-title">Общий баланс</h2><button className={styles.eyeButton} type="button" onClick={() => setHidden(!hidden)} aria-label={hidden ? "Показать суммы" : "Скрыть суммы"} aria-pressed={hidden}><Icon name={hidden ? "eyeOff" : "eye"} size={21} /></button></div>
              {gate("Общий баланс", <><p className={styles.balance} data-testid="total-balance">{lockedMoney(profile.balance)}</p><p className={styles.balanceCaption}>{product === "credit" ? "Доступно по выбранной карте" : "На выбранном счёте"}</p></>)}
              <div className={styles.quickActions} aria-label="Быстрые действия">
                <button type="button" disabled title={verificationApproved ? "Сервис платежей пока недоступен" : "Платежи недоступны до проверки личности"}><Icon name="lock" /><span>Оплатить</span></button>
                <button type="button" disabled title={verificationApproved ? "Сервис пополнения пока недоступен" : "Пополнение недоступно до подтверждения личности"}><Icon name="lock" /><span>Пополнить</span></button>
                <button type="button" disabled title={verificationApproved ? "Реквизиты счёта ещё не назначены" : "Реквизиты недоступны до подтверждения личности"}><Icon name="lock" /><span>Реквизиты</span></button>
              </div>
            </section>
            {card}
          </div>
          <div className={styles.lowerGrid}>
            {gate("Динамика баланса", <BalanceChart balance={verificationApproved ? profile.balance : 215000} period={period} onPeriod={setPeriod} hidden={hidden || !verificationApproved} money={lockedMoney} emptyHistory={verificationApproved} />)}
            <OperationHistory key={operationsKey} initial={operations} money={money} href={href("transactions")} />
          </div>
        </>}

        {section === "cards" && <div className={styles.singleProduct}>{card}</div>}
        {section === "accounts" && gate("Счета", <section className={`${styles.panel} ${styles.accountPanel}`}><div className={styles.sectionIcon}><Icon name="account" /></div><div><h2>Рублёвый счёт · ••••</h2></div><strong>{lockedMoney(profile.balance)}</strong><div className={styles.accountNote}></div></section>)}
        {section === "transactions" && <OperationHistory key={operationsKey} initial={operations} money={money} />}
        {section === "transfers" && <section className={`${styles.panel} ${styles.emptyPanel}`}><span className={styles.sectionIcon}><Icon name="transfer" size={26} /></span><h2>Вы ещё не совершали переводов</h2><p>{verificationApproved ? "История переводов появится здесь после первой операции." : verificationPending ? "Проверка личности в процессе. Переводы станут доступны после её одобрения." : "Для платежей и переводов необходимо подтвердить личность."}</p>{!verificationPending && !verificationApproved && <button type="button" className={styles.outlineButton} onClick={() => setOverlay("verification")}>Пройти проверку KYC</button>}</section>}
        {section === "credit" && (verificationApproved ? <div className={styles.creditPage}>{product === "credit" && <div className={styles.singleProduct}>{card}</div>}<CreditGuide /></div> : gate("Кредит", <section className={`${styles.panel} ${styles.emptyPanel}`}><span className={styles.sectionIcon}><Icon name="credit" size={26} /></span><h2>Как устроена кредитная карта</h2><p>Кредитный лимит, льготный период и погашение задолженности.</p></section>))}
        {section === "profile" && <section className={`${styles.panel} ${styles.profilePanel}`}><h2>Мой профиль</h2><dl className={styles.profileDetails}>{[["Фамилия", profile.lastName], ["Имя", profile.firstName], ["Дата рождения", profile.birth], ["Город", profile.city], ["Адрес", profile.address], ["Электронная почта", profile.email], ["Телефон", profile.phone], ["Гражданство", profile.citizenship], ["Страна проживания", profile.residence], ["Занятость", profile.occupation], ["Ежемесячный доход", `${profile.income} ₽`]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.accountNote}><Icon name="shield" size={18} />{verificationApproved ? "Личность подтверждена" : "Личность не подтверждена"}</p></section>}
        {section === "help" && <section className={`${styles.panel} ${styles.helpPanel}`}><h2>Помощь по личному кабинету</h2>{[
          ["Как скрыть баланс?", "Нажмите на значок глаза рядом с общим балансом или выберите «Скрыть суммы» в меню профиля."],
          ["Почему некоторые разделы недоступны?", "Карты, счета, кредит, баланс, график и финансовые операции доступны после одобрения проверки личности. Отправка документов не снимает ограничения. История операций, профиль и помощь остаются доступны."],
          ["Какие продукты отображаются?", "В кабинете отображается продукт, выбранный вами при регистрации."],
        ].map(([question, answer]) => <details key={question}><summary>{question}<Icon name="chevron" size={18} /></summary><p>{answer}</p></details>)}</section>}
      </main>
    </div>

    <nav className={styles.mobileNav} aria-label="Мобильная навигация">{navigation.slice(0, 4).map(item => navLink(item, true))}<button className={`${styles.mobileNavLink} ${!["home", "cards", "accounts", "transactions"].includes(section) ? styles.active : ""}`} type="button" onClick={() => setOverlay("more")} aria-label="Открыть все разделы"><Icon name="more" /><span>Ещё</span></button></nav>

    {overlay === "verification" && !verificationApproved && <VerificationDialog onClose={() => setOverlay(null)} onComplete={() => { setSubmissionCompleted(true); router.refresh(); }} />}
    {overlay && overlay !== "verification" && <dialog ref={infoDialog} className={`${styles.infoDialog} ${overlay === "more" ? styles.moreDialog : ""}`} aria-labelledby="dashboard-dialog-title" onClose={() => setOverlay(null)} onClick={event => { if (event.target === event.currentTarget) setOverlay(null); }}>
      <div className={styles.dialogHead}><h2 ref={infoTitle} id="dashboard-dialog-title" tabIndex={-1}>{overlay === "more" ? "Все разделы" : overlay === "settings" ? "Настройки" : "Безопасность"}</h2><button type="button" aria-label="Закрыть окно" onClick={() => setOverlay(null)}><Icon name="close" /></button></div>
      {overlay === "more" ? <nav aria-label="Все разделы">{navigation.map(item => navLink(item))}</nav> : overlay === "settings" ? <><div className={styles.settingsRow}><span>Скрывать суммы</span><button className={styles.settingToggle} type="button" aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? "Включено" : "Выключено"}<Icon name={hidden ? "eyeOff" : "eye"} size={19} /></button></div><p className={styles.subtle}>Язык интерфейса: Русский</p><p className={styles.subtle}>Настройки действуют только в текущем просмотре.</p><button className={styles.dialogDone} type="button" onClick={() => setOverlay(null)}>Готово</button></> : <><div className={styles.dialogSymbol}><Icon name="lock" size={30} /></div><p>Доступ к вашему профилю защищён сеансом в этом браузере. После выхода сеанс завершается. Не передавайте доступ к браузеру посторонним.</p><button className={styles.dialogDone} type="button" onClick={() => setOverlay(null)}>Понятно</button></>}
    </dialog>}
  </div>;
}

function KycGate({ label, pending, onVerify, children }: { label: string; pending: boolean; onVerify: () => void; children: ReactNode }) {
  const titleId = useId();
  return <section className={styles.kycGate} aria-label={`${label}: доступ ограничен`}>
    <div className={styles.lockedPreview} inert aria-hidden="true">{children}</div>
    <div className={styles.lockOverlay}>
      <span className={styles.lockSymbol} aria-hidden="true"><Icon name="lock" size={24} /></span>
      <h2 id={titleId}>{pending ? "Проверка личности в процессе" : "Подтвердите личность"}</h2>
      <p>Этот раздел станет доступен после подтверждения вашей личности.</p>
      {!pending && <button type="button" onClick={onVerify} aria-describedby={titleId}>Пройти проверку KYC</button>}
    </div>
  </section>;
}

function CardPanel({ profile, product, money, approved = false }: { profile: Omit<Fixture, "lastDigits"> & { lastDigits: string }; product: ProductKind; money: Money; approved?: boolean }) {
  return <section className={`${styles.panel} ${styles.cardPanel}`} aria-label="Выбранная карта">
    <BankCard product={product} lastDigits={profile.lastDigits} holder={profile.name} />
    <div className={styles.cardInfo}>
      {product === "credit" ? <><dl className={styles.creditFacts}><div><dt>Лимит</dt><dd>{money(profile.limit)}</dd></div><div><dt>Использовано</dt><dd>{money(profile.used)}</dd></div><div><dt>Доступно</dt><dd className={styles.positive}>{money(profile.limit - profile.used)}</dd></div></dl><div className={styles.payment}><span>Ближайший платёж</span><strong>{money(profile.payment)}</strong><span className={styles.dueDate}>Срок — по договору</span></div></> : <><dl className={styles.creditFacts}><div><dt>Баланс</dt><dd className={styles.positive}>{money(profile.balance)}</dd></div><div><dt>Валюта</dt><dd>Рубль · RUB</dd></div><div><dt>Тип карты</dt><dd>Виртуальная</dd></div></dl><p className={styles.virtualNote}>{approved ? "Проверка личности одобрена." : "Платежи доступны после проверки личности."}</p></>}
    </div>
  </section>;
}

function BalanceChart({ balance, period, onPeriod, hidden, money, emptyHistory = false }: { balance: number; period: Period; onPeriod: (value: Period) => void; hidden: boolean; money: Money; emptyHistory?: boolean }) {
  const gradient = useId();
  if (emptyHistory) return <section className={`${styles.panel} ${styles.chartPanel}`} aria-labelledby="chart-title"><div className={styles.chartHeader}><h2 id="chart-title">Динамика баланса</h2><div className={styles.periods} role="group" aria-label="Период графика">{([['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => onPeriod(value)}>{label}</button>)}</div></div><p className={styles.balance}>{money(balance)}</p><p className={styles.subtle}>История изменения баланса за выбранный период пока не накоплена.</p></section>;
  const scale = balance / 215000;
  const values = (period === "month" ? [194, 202, 200, 190, 185, 194, 190, 201, 204, 211, 208, 215] : period === "week" ? [201, 198, 204, 209, 206, 212, 215] : [163, 179, 172, 189, 195, 186, 199, 204, 210, 215]).map(value => value * 1000 * scale);
  const points = values.map((value, i) => ({ x: 72 + i / (values.length - 1) * 466, y: 188 - (value / scale - 150000) / 100000 * 164 }));
  let line = `M${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[Math.max(0, i - 1)], b = points[i], c = points[i + 1], d = points[Math.min(points.length - 1, i + 2)];
    line += ` C${b.x + (c.x - a.x) / 6},${b.y + (c.y - a.y) / 6} ${c.x - (d.x - b.x) / 6},${c.y - (d.y - b.y) / 6} ${c.x},${c.y}`;
  }
  const last = points[points.length - 1];
  const labels = period === "month" ? ["1 окт", "8 окт", "15 окт", "22 окт", "30 окт"] : period === "week" ? ["24 окт", "26 окт", "27 окт", "29 окт", "30 окт"] : ["Янв", "Мар", "Июн", "Авг", "Окт"];
  return <section className={`${styles.panel} ${styles.chartPanel}`} aria-labelledby="chart-title"><div className={styles.chartHeader}><h2 id="chart-title">Динамика баланса</h2><div className={styles.periods} role="group" aria-label="Период графика">{([['week', 'Неделя'], ['month', 'Месяц'], ['year', 'Год']] as const).map(([value, label]) => <button key={value} type="button" aria-pressed={period === value} onClick={() => onPeriod(value)}>{label}</button>)}</div></div>
    <svg viewBox="0 0 560 232" className={styles.chart} role="img" aria-label={hidden ? "Динамика баланса. Суммы скрыты." : `Динамика баланса. Последнее значение: ${currency.format(balance)}.`}>
      <defs><linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00aa4a" stopOpacity=".16" /><stop offset="100%" stopColor="#00aa4a" stopOpacity="0" /></linearGradient></defs>
      {[250000, 225000, 200000, 175000, 150000].map((value, i) => <g key={value}><line x1="72" x2="538" y1={24 + i * 41} y2={24 + i * 41} className={styles.gridLine} /><text x="0" y={28 + i * 41}>{hidden ? "••••" : new Intl.NumberFormat('ru-RU').format(Math.round(value * scale))} ₽</text></g>)}
      {labels.map((label, i) => <g key={label}><line x1={72 + i * 116.5} x2={72 + i * 116.5} y1="24" y2="188" className={styles.gridLine} /><text x={72 + i * 116.5} y="219" textAnchor={i === 4 ? "end" : "middle"}>{label}</text></g>)}
      <path d={`${line} L538,188 L72,188 Z`} fill={`url(#${gradient})`} /><path d={line} fill="none" stroke="#00a947" strokeWidth="2.3" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="7" fill="#fff" stroke="#00b751" strokeWidth="1" /><circle cx={last.x} cy={last.y} r="4.5" fill="#00a947" /><text x={last.x} y={last.y - 17} textAnchor="end" className={styles.chartValue}>{money(balance)}</text>
    </svg>
  </section>;
}

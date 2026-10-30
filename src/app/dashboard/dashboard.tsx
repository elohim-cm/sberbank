"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { dashboardHref, testProfiles, type ProductKind } from "../test-profiles";
import Icon, { type IconName } from "./icons";
import styles from "./dashboard.module.css";

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
type Fixture = typeof testProfiles[number];
type Money = (value: number) => string;
type Brand = { logo: string; name: string };
const currency = new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 });
const transactions: { id: number; title: string; date: string; amount: number; icon: IconName }[] = [
  { id: 1, title: "Покупка · пример", date: "28 октября 2026", amount: -4200, icon: "cart" },
  { id: 2, title: "Пополнение · пример", date: "25 октября 2026", amount: 20000, icon: "plus" },
  { id: 3, title: "Возврат · пример", date: "18 октября 2026", amount: 1500, icon: "refund" },
  { id: 4, title: "Покупка · пример", date: "12 октября 2026", amount: -7350, icon: "cart" },
];

export default function Dashboard({ brand }: { brand: Brand }) {
  const params = useSearchParams();
  const profile = testProfiles.find(item => item.id === params.get("profile")) ?? testProfiles[0];
  const requestedProduct = params.get("product");
  const product: ProductKind = requestedProduct === "virtual" || requestedProduct === "credit" ? requestedProduct : profile.product;
  const section: Section = navigation.find(item => item.id === params.get("section"))?.id ?? "home";
  return <DashboardView key={profile.id} profile={profile} product={product} section={section} brand={brand} />;
}

function DashboardView({ profile, product, section, brand }: { profile: Fixture; product: ProductKind; section: Section; brand: Brand }) {
  const [hidden, setHidden] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [profileOpen, setProfileOpen] = useState(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const profileRoot = useRef<HTMLDivElement>(null);
  const profileButton = useRef<HTMLButtonElement>(null);
  const infoDialog = useRef<HTMLDialogElement>(null);
  const infoTitle = useRef<HTMLHeadingElement>(null);
  const pageTitle = useRef<HTMLHeadingElement>(null);
  const title = section === "home" ? "Обзор" : navigation.find(item => item.id === section)!.label;
  const productTitle = product === "credit" ? "Кредитная карта" : "Виртуальная карта";
  const href = (target: Section) => dashboardHref(profile.id, product, target);
  const money: Money = value => hidden ? "•••• ₽" : currency.format(value);

  useEffect(() => { pageTitle.current?.focus(); }, [section]);

  useEffect(() => {
    if (!profileOpen) return;
    const outside = (event: PointerEvent) => { if (!profileRoot.current?.contains(event.target as Node)) setProfileOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setProfileOpen(false); profileButton.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); };
  }, [profileOpen]);

  useEffect(() => {
    if (!overlay) return;
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

  const card = <CardPanel profile={profile} product={product} money={money} />;
  return <div className={styles.dashboard}>
    <a href="#dashboard-main" className={styles.skipLink}>Перейти к содержимому</a>
    <aside className={styles.sidebar} aria-label="Боковая панель">
      <Link href={href("home")} className={styles.brand} aria-label={`${brand.name} — главная`}>
        <Image src={brand.logo} width={121} height={48} alt="СберБанк" unoptimized />
        <span>{brand.name}</span>
      </Link>
      <nav className={styles.navigation} aria-label="Основные разделы">{navigation.slice(0, -1).map(item => navLink(item))}</nav>
      <div className={styles.sidebarBottom}>{navLink(navigation[7])}<p>Независимый проект<br />Тестовые данные</p></div>
    </aside>

    <div className={styles.workspace}>
      <header className={styles.topbar}>
        <p className={styles.breadcrumb}>Личный кабинет <span>/</span> {section === "home" ? "Главная" : title}</p>
        <Link href={href("home")} className={styles.mobileBrand} aria-label={`${brand.name} — главная`}><Image src={brand.logo} width={91} height={36} alt="СберБанк" unoptimized /><span>{brand.name}</span></Link>
        <div ref={profileRoot} className={styles.profileRoot}>
          <button ref={profileButton} className={styles.profileButton} type="button" aria-expanded={profileOpen} aria-controls="dashboard-profile-menu" onClick={() => setProfileOpen(!profileOpen)}><Icon name="user" /><span className={styles.desktopProfile}>Тестовый профиль {profile.id}</span><span className={styles.mobileProfile}>Профиль {profile.id}</span><Icon name="chevron" size={17} /></button>
          {profileOpen && <nav id="dashboard-profile-menu" className={styles.profileMenu} aria-label="Меню профиля">
            <Link href={href("profile")} onClick={() => setProfileOpen(false)}><Icon name="user" size={19} /> Мой профиль</Link>
            <button type="button" onClick={() => setHidden(!hidden)}><Icon name={hidden ? "eye" : "eyeOff"} size={19} />{hidden ? "Показать суммы" : "Скрыть суммы"}</button>
            <button type="button" onClick={() => { setProfileOpen(false); setOverlay("settings"); }}><Icon name="settings" size={19} />Настройки</button>
            <button type="button" onClick={() => { setProfileOpen(false); setOverlay("security"); }}><Icon name="shield" size={19} />Безопасность</button>
            <span className={styles.language}>Язык интерфейса: Русский</span>
            <Link href="/inscription"><Icon name="logout" size={19} />Выйти</Link>
          </nav>}
        </div>
      </header>
      <p className={styles.mobileDisclosure}>Тестовые данные · Независимый проект</p>

      <main id="dashboard-main" className={styles.main} tabIndex={-1}>
        <section className={styles.kycBanner} aria-label="Статус проверки личности">
          <Icon name="shield" size={27} className={styles.kycIcon} />
          <div><h2>Подтвердите личность</h2><p>Просматривать разделы можно. Платежи доступны после проверки.</p></div>
          <button type="button" onClick={() => setOverlay("verification")}>Пройти проверку</button>
        </section>
        <div className={styles.pageHeading}><h1 ref={pageTitle} tabIndex={-1}>{title}</h1><span className={styles.productBadge}>{productTitle}<Icon name="chevron" size={17} /></span></div>

        {section === "home" && <>
          <div className={styles.topGrid}>
            <section className={`${styles.panel} ${styles.balancePanel}`} aria-labelledby="balance-title">
              <div className={styles.balanceLabel}><h2 id="balance-title">Общий баланс</h2><button className={styles.eyeButton} type="button" onClick={() => setHidden(!hidden)} aria-label={hidden ? "Показать суммы" : "Скрыть суммы"} aria-pressed={hidden}><Icon name={hidden ? "eyeOff" : "eye"} size={21} /></button></div>
              <p className={styles.balance} data-testid="total-balance">{money(profile.balance)}</p>
              <p className={styles.balanceCaption}>{product === "credit" ? "Доступно по выбранной карте" : "На выбранном счёте"}</p>
              <div className={styles.quickActions} aria-label="Быстрые действия">
                <button type="button" disabled title="Платежи недоступны до проверки личности"><Icon name="lock" /><span>Оплатить</span></button>
                <button type="button" disabled title="Предпросмотр будет добавлен позже"><Icon name="plus" /><span>Пополнить</span></button>
                <button type="button" disabled title="Предпросмотр будет добавлен позже"><Icon name="document" /><span>Реквизиты</span></button>
              </div>
            </section>
            {card}
          </div>
          <div className={styles.lowerGrid}>
            <BalanceChart balance={profile.balance} period={period} onPeriod={setPeriod} hidden={hidden} money={money} />
            <TransactionList money={money} href={href("transactions")} />
          </div>
        </>}

        {section === "cards" && <div className={styles.singleProduct}>{card}</div>}
        {section === "accounts" && <section className={`${styles.panel} ${styles.accountPanel}`}><div className={styles.sectionIcon}><Icon name="account" /></div><div><h2>Рублёвый счёт · •• {profile.lastDigits}</h2><p>Счёт выбранного продукта · Тестовые данные</p></div><strong>{money(profile.balance)}</strong><div className={styles.accountNote}><Icon name="lock" size={18} /> Платежи недоступны до проверки личности.</div></section>}
        {section === "transactions" && <TransactionList money={money} />}
        {section === "transfers" && <section className={`${styles.panel} ${styles.emptyPanel}`}><span className={styles.sectionIcon}><Icon name="transfer" size={26} /></span><h2>Переводы пока недоступны</h2><p>Вы можете просматривать разделы. Для платежей и переводов нужна проверка личности.</p><button type="button" className={styles.outlineButton} onClick={() => setOverlay("verification")}>О проверке личности</button></section>}
        {section === "credit" && (product === "credit" ? <div className={styles.singleProduct}>{card}</div> : <section className={`${styles.panel} ${styles.emptyPanel}`}><span className={styles.sectionIcon}><Icon name="credit" size={26} /></span><h2>Кредитный продукт не выбран</h2><p>В кабинете отображается только ваша виртуальная карта.</p><Link href={href("cards")} className={styles.outlineButton}>К моей карте</Link></section>)}
        {section === "profile" && <section className={`${styles.panel} ${styles.profilePanel}`}><h2>Мой профиль</h2><p className={styles.subtle}>Все сведения в этом профиле вымышлены.</p><dl className={styles.profileDetails}>{[["Полное имя", profile.name], ["Дата рождения", profile.birth], ["Город", profile.city], ["Адрес", profile.address], ["Электронная почта", profile.email], ["Телефон", profile.phone]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.accountNote}><Icon name="shield" size={18} />Личность не подтверждена</p></section>}
        {section === "help" && <section className={`${styles.panel} ${styles.helpPanel}`}><h2>Помощь по личному кабинету</h2>{[
          ["Как скрыть баланс?", "Нажмите на значок глаза рядом с общим балансом или выберите «Скрыть суммы» в меню профиля."],
          ["Почему платежи недоступны?", "Статус проверки личности не подтверждён. Этот проект использует только тестовые данные и не выполняет банковские операции."],
          ["Какие продукты отображаются?", "Только продукт, выбранный при регистрации. Для тестового входа используется продукт выбранного вымышленного профиля."],
        ].map(([question, answer]) => <details key={question}><summary>{question}<Icon name="chevron" size={18} /></summary><p>{answer}</p></details>)}</section>}
      </main>
    </div>

    <nav className={styles.mobileNav} aria-label="Мобильная навигация">{navigation.slice(0, 4).map(item => navLink(item, true))}<button className={`${styles.mobileNavLink} ${!["home", "cards", "accounts", "transactions"].includes(section) ? styles.active : ""}`} type="button" onClick={() => setOverlay("more")} aria-label="Открыть все разделы"><Icon name="more" /><span>Ещё</span></button></nav>

    {overlay && <dialog ref={infoDialog} className={`${styles.infoDialog} ${overlay === "more" ? styles.moreDialog : ""}`} aria-labelledby="dashboard-dialog-title" onClose={() => setOverlay(null)} onClick={event => { if (event.target === event.currentTarget) setOverlay(null); }}>
      <div className={styles.dialogHead}><h2 ref={infoTitle} id="dashboard-dialog-title" tabIndex={-1}>{overlay === "more" ? "Все разделы" : overlay === "verification" ? "Проверка личности" : overlay === "settings" ? "Настройки" : "Безопасность"}</h2><button type="button" aria-label="Закрыть окно" onClick={() => setOverlay(null)}><Icon name="close" /></button></div>
      {overlay === "more" ? <nav aria-label="Все разделы">{navigation.map(item => navLink(item))}</nav> : overlay === "settings" ? <><div className={styles.settingsRow}><span>Скрывать суммы</span><button className={styles.settingToggle} type="button" aria-pressed={hidden} onClick={() => setHidden(!hidden)}>{hidden ? "Включено" : "Выключено"}<Icon name={hidden ? "eyeOff" : "eye"} size={19} /></button></div><p className={styles.subtle}>Язык интерфейса: Русский</p><p className={styles.subtle}>Настройки действуют только в текущем просмотре.</p><button className={styles.dialogDone} type="button" onClick={() => setOverlay(null)}>Готово</button></> : <><div className={styles.dialogSymbol}><Icon name={overlay === "verification" ? "shield" : "lock"} size={30} /></div><p>{overlay === "verification" ? "Проверка личности пока не подключена. Платежи и переводы остаются недоступны. Документы и фотографии здесь не запрашиваются." : "В этом кабинете используются только вымышленные профили. Пароли, SMS-коды и реальные персональные данные не запрашиваются и не сохраняются."}</p><p className={styles.subtle}>Независимый проект · Тестовые данные</p><button className={styles.dialogDone} type="button" onClick={() => setOverlay(null)}>Понятно</button></>}
    </dialog>}
  </div>;
}

function CardPanel({ profile, product, money }: { profile: Fixture; product: ProductKind; money: Money }) {
  return <section className={`${styles.panel} ${styles.cardPanel}`} aria-label="Выбранная карта">
    <div className={styles.bankCard}>
      <h2>{product === "credit" ? "Кредитная карта" : "Виртуальная карта"}</h2>
      <span className={styles.chip} aria-hidden="true"><i /><i /><i /><i /><i /><i /></span>
      <Icon name="contactless" size={29} className={styles.contactless} />
      <p>••••&nbsp; {profile.lastDigits}</p>
    </div>
    <div className={styles.cardInfo}>
      {product === "credit" ? <><dl className={styles.creditFacts}><div><dt>Лимит</dt><dd>{money(profile.limit)}</dd></div><div><dt>Использовано</dt><dd>{money(profile.used)}</dd></div><div><dt>Доступно</dt><dd className={styles.positive}>{money(profile.limit - profile.used)}</dd></div></dl><div className={styles.payment}><span>Ближайший платёж</span><strong>{money(profile.payment)}</strong><span className={styles.dueDate}>До 15 ноября</span></div></> : <><dl className={styles.creditFacts}><div><dt>Баланс</dt><dd className={styles.positive}>{money(profile.balance)}</dd></div><div><dt>Валюта</dt><dd>Рубль · RUB</dd></div><div><dt>Тип карты</dt><dd>Виртуальная</dd></div></dl><p className={styles.virtualNote}>Платежи доступны после проверки личности.</p></>}
    </div>
    <p className={styles.cardDisclosure}>Тестовые данные · Независимый проект</p>
  </section>;
}

function TransactionList({ money, href }: { money: Money; href?: string }) {
  return <section className={`${styles.panel} ${styles.transactionPanel}`} aria-labelledby="transactions-title"><h2 id="transactions-title">Пример истории операций</h2><ul className={styles.transactions}>{transactions.map(item => <li key={item.id}><span className={`${styles.transactionIcon} ${item.amount > 0 ? styles.incoming : ""}`}><Icon name={item.icon} size={20} /></span><div className={styles.transactionDescription}><strong>{item.title}</strong><time dateTime={`2026-10-${item.id === 1 ? "28" : item.id === 2 ? "25" : item.id === 3 ? "18" : "12"}`}>{item.date}</time></div><span className={`${styles.transactionAmount} ${item.amount > 0 ? styles.positive : ""}`}>{item.amount > 0 ? "+ " : "− "}{money(Math.abs(item.amount))}</span></li>)}</ul>{href && <Link className={styles.allTransactions} href={href}>Все операции <Icon name="arrow" size={19} /></Link>}</section>;
}

function BalanceChart({ balance, period, onPeriod, hidden, money }: { balance: number; period: Period; onPeriod: (value: Period) => void; hidden: boolean; money: Money }) {
  const gradient = useId();
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

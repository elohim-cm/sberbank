"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { dashboardHref, testProfiles as profiles } from "../test-profiles";
import pageStyles from "./registration.module.css";
import styles from "./registration-dialog.module.css";
import RegistrationFields from "./registration-fields";
import { createLocalProfile, emptyRegistration, registrationSummary, validateRegistration, type RegistrationData, type RegistrationErrors } from "./registration-data";

// Editable registration is local to this frontend session; no backend is connected.
const products = [
  { title: "Виртуальная карта", icon: "▱" },
  { title: "Кредитная карта", icon: "+" },
];
const steps = ["Продукт", "Профиль", "Подтверждение"];

export default function RegistrationDialog() {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const focusFirstError = useRef(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"registration" | "login">("registration");
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState(0);
  const [profileIndex, setProfileIndex] = useState(0);
  const [data, setData] = useState<RegistrationData>({ ...emptyRegistration });
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [registeredId, setRegisteredId] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const profile = profiles[profileIndex];
  const destination = dashboardHref(mode === "registration" ? registeredId ?? "new" : profile.id, mode === "registration" ? (product === 1 ? "credit" : "virtual") : profile.product);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const fields = [
    ["Полное имя", profile.name], ["Дата рождения", profile.birth],
    ["Гражданство", "РФ — пример"], ["Страна проживания", "Россия — пример"],
    ["Город", profile.city], ["Адрес", profile.address],
    ["Электронная почта", profile.email], ["Телефон", profile.phone],
  ];

  useEffect(() => {
    if (!open) return;
    const currentDialog = dialog.current;
    currentDialog?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { currentDialog?.close(); document.body.style.overflow = previous; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    content.current?.scrollTo({ top: 0 });
    stepTitle.current?.focus();
  }, [open, step, mode, finished]);

  useEffect(() => {
    if (!finished || !open) return;
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 500 : 1150;
    const timer = window.setTimeout(() => router.replace(destination), delay);
    return () => window.clearTimeout(timer);
  }, [finished, open, destination, router]);

  useEffect(() => {
    if (open && (mode === "login" || registeredId)) router.prefetch(destination);
  }, [open, destination, router, mode, registeredId]);

  useEffect(() => {
    if (!focusFirstError.current) return;
    focusFirstError.current = false;
    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) document.getElementById(`registration-${firstInvalid}`)?.focus();
  }, [errors]);

  function updateField(key: keyof RegistrationData, value: string) {
    setData(previous => ({ ...previous, [key]: value }));
    if (errors[key]) setErrors(previous => { const next = { ...previous }; delete next[key]; return next; });
  }

  function advance() {
    if (finished) { router.replace(destination); return; }
    if (mode === "login") { setFinished(true); return; }
    if (step === 1 || step === 2) {
      const nextErrors = validateRegistration(data, today);
      if (Object.keys(nextErrors).length) { focusFirstError.current = true; setErrors(nextErrors); setStep(1); return; }
    }
    if (step === 2) {
      const localProfile = createLocalProfile(data, product === 1 ? "credit" : "virtual");
      setRegisteredId(localProfile.id);
      setFinished(true);
    } else setStep(step + 1);
  }

  function show() {
    setMode("registration");
    setStep(0);
    setProduct(0);
    setProfileIndex(0);
    setData({ ...emptyRegistration });
    setErrors({});
    setRegisteredId(null);
    setFinished(false);
    setOpen(true);
  }

  function switchMode(next: typeof mode) {
    setMode(next);
    setStep(0);
    setFinished(false);
  }

  const title = finished ? (mode === "registration" ? "Профиль подготовлен" : "Вход выполнен успешно") : mode === "login" ? "Выберите тестовый профиль" : ["Выберите продукт", "Личные сведения", "Проверьте ваши данные"][step];

  return <>
    <button ref={trigger} className={pageStyles.primary} type="button" onClick={show} aria-haspopup="dialog" aria-controls="registration-dialog">
      Создать личный кабинет <span aria-hidden="true">→</span>
    </button>
    {open && createPortal(<dialog id="registration-dialog" ref={dialog} className={styles.dialog} aria-labelledby="registration-title"
      onClose={() => { setOpen(false); setData({ ...emptyRegistration }); setErrors({}); trigger.current?.focus(); }}
      onClick={event => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <form className={styles.shell} noValidate onSubmit={event => { event.preventDefault(); advance(); }}>
        <header className={styles.header}></header>
        <div className={styles.tabs} role="group" aria-label="Режим просмотра">
          <button type="button" disabled={finished} aria-pressed={mode === "registration"} onClick={() => switchMode("registration")}>Регистрация</button>
          <button type="button" disabled={finished} aria-pressed={mode === "login"} onClick={() => switchMode("login")}>Вход</button>
        </div>
        <div className={styles.content} ref={content}>
          {mode === "registration" && !finished && <ol className={styles.steps} aria-label="Этапы просмотра">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}</ol>}
          <h2 id="registration-title" ref={stepTitle} tabIndex={-1} className={`${styles.title}${finished ? ` ${styles.successTitle}` : ""}`}>{title}</h2>
          {finished ? <div className={styles.result}>
            <span className={styles.check} aria-hidden="true">
              <svg className={styles.checkIcon} viewBox="0 0 32 32" fill="none">
                <path className={styles.checkPath} d="m7 17 6 6L25 8" pathLength="1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
          </div> : mode === "registration" && step === 0 ? <fieldset className={styles.products}>
            <legend className={styles.srOnly}>Категория продукта для просмотра</legend>
            {products.map((item, index) => <label className={styles.product} key={item.title}>
              <input type="radio" name="test-product" value={index} checked={product === index} onChange={() => setProduct(index)} />
              <span className={styles.productIcon} aria-hidden="true">{item.icon}</span>
              <span><strong>{item.title}</strong></span>
            </label>)}
          </fieldset> : mode === "registration" && step === 1 ? <RegistrationFields data={data} errors={errors} onChange={updateField} today={today} /> : <>
            {mode === "login" && <label className={styles.field}>Тестовый профиль
              <select value={profileIndex} onChange={event => setProfileIndex(Number(event.target.value))}>{profiles.map((item, index) => <option key={item.id} value={index}>{item.name}</option>)}</select>
            </label>}
            {mode === "registration" && step === 2 && <div className={styles.summary}><span>Продукт</span><strong>{products[product].title}</strong></div>}
            <dl className={styles.details}>{(mode === "registration" ? registrationSummary(data) : fields).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {/* <p className={styles.hint}>{mode === "login" ? "Тестовый вход не использует пароль или коды подтверждения." : "Поля профиля предназначены только для просмотра. Документы и KYC здесь не запрашиваются."}</p> */}
          </>}
        </div>
        <footer className={styles.footer}>
          <div className={styles.actions}>
            {!finished && mode === "registration" && step > 0 && <button type="button" className={styles.back} onClick={() => setStep(step - 1)}>Назад</button>}
            <button type="submit" className={styles.next}>{finished ? "Перейти в кабинет" : mode === "login" ? "Просмотреть профиль" : step === 2 ? "Подтвердить и продолжить" : "Далее"}<span aria-hidden="true">→</span></button>
          </div>
        </footer>
      </form>
    </dialog>, document.body)}
  </>;
}

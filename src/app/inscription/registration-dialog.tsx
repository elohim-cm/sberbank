"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import pageStyles from "./registration.module.css";
import styles from "./registration-dialog.module.css";
import RegistrationFields from "./registration-fields";
import { emptyRegistration, registrationSummary, validateRegistration, type RegistrationData, type RegistrationErrors } from "./registration-data";

const products = [
  { title: "Виртуальная карта", icon: "▱" },
  { title: "Кредитная карта", icon: "+" },
];
const steps = ["Продукт", "Профиль", "Подтверждение"];
const calendarToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Douala", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export default function RegistrationDialog() {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const stepTitle = useRef<HTMLHeadingElement>(null);
  const focusFirstError = useRef(false);
  const requestPending = useRef(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"registration" | "login">("registration");
  const [step, setStep] = useState(0);
  const [product, setProduct] = useState(0);
  const [data, setData] = useState<RegistrationData>({ ...emptyRegistration });
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [finished, setFinished] = useState(false);
  const destination = "/dashboard";
  const [today, setToday] = useState("");

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
    // A full navigation discards any dashboard cached before the session cookie.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    const timer = window.setTimeout(() => window.location.assign(destination), delay);
    return () => window.clearTimeout(timer);
  }, [finished, open, destination]);

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

  async function advance() {
    if (requestPending.current) return;
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard the pre-authentication client cache.
    if (finished) { window.location.assign(destination); return; }
    if (mode === "registration" && (step === 1 || step === 2)) {
      const nextErrors = validateRegistration(data, calendarToday());
      if (Object.keys(nextErrors).length) { focusFirstError.current = true; setErrors(nextErrors); setStep(1); return; }
    }
    if (mode === "registration" && step < 2) { setStep(step + 1); return; }
    requestPending.current = true;
    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch(mode === "registration" ? "/api/accounts" : "/api/account", {
        method: mode === "registration" ? "POST" : "GET",
        headers: mode === "registration" ? { "Content-Type": "application/json" } : undefined,
        body: mode === "registration" ? JSON.stringify({ ...data, product: product === 1 ? "credit" : "virtual" }) : undefined,
        cache: "no-store",
      });
      const result = await response.json();
      if (!response.ok) {
        if (mode === "registration" && result.errors) { focusFirstError.current = true; setErrors(result.errors); setStep(1); }
        throw new Error(response.status === 401 ? "Сеанс не найден. Зарегистрируйтесь, чтобы открыть личный кабинет. Восстановление доступа будет доступно позже." : result.message || "Не удалось сохранить профиль. Повторите попытку.");
      }
      if (!result.profile?.id) throw new Error("Не удалось подтвердить сохранение профиля.");
      setFinished(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Нет соединения с сервером. Повторите попытку.");
    } finally {
      requestPending.current = false;
      setSubmitting(false);
    }
  }

  function show() {
    setToday(calendarToday());
    setMode("registration");
    setStep(0);
    setProduct(0);
    setData({ ...emptyRegistration });
    setErrors({});
    setSubmitError("");
    setFinished(false);
    setOpen(true);
  }

  function switchMode(next: typeof mode) {
    setMode(next);
    setStep(0);
    setFinished(false);
    setSubmitError("");
  }

  const title = finished ? (mode === "registration" ? "Регистрация завершена" : "Вход выполнен успешно") : mode === "login" ? "Открыть личный кабинет" : ["Выберите продукт", "Личные сведения", "Проверьте ваши данные"][step];

  return <>
    <button ref={trigger} className={pageStyles.primary} type="button" onClick={show} aria-haspopup="dialog" aria-controls="registration-dialog">
      Создать личный кабинет <span aria-hidden="true">→</span>
    </button>
    {open && createPortal(<dialog id="registration-dialog" ref={dialog} className={styles.dialog} aria-labelledby="registration-title"
      onCancel={event => { if (requestPending.current) event.preventDefault(); }}
      onClose={() => { setOpen(false); setData({ ...emptyRegistration }); setErrors({}); trigger.current?.focus(); }}
      onClick={event => { if (!requestPending.current && event.target === event.currentTarget) dialog.current?.close(); }}>
      <form className={styles.shell} noValidate aria-busy={submitting} onSubmit={event => { event.preventDefault(); void advance(); }}>
        <header className={styles.header}></header>
        <div className={styles.tabs} role="group" aria-label="Режим просмотра">
          <button type="button" disabled={finished || submitting} aria-pressed={mode === "registration"} onClick={() => switchMode("registration")}>Регистрация</button>
          <button type="button" disabled={finished || submitting} aria-pressed={mode === "login"} onClick={() => switchMode("login")}>Вход</button>
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
          </fieldset> : mode === "registration" && step === 1 ? <RegistrationFields data={data} errors={errors} onChange={updateField} today={today} /> : mode === "login" ? <p className={styles.hint}>Если вы уже зарегистрировались в этом браузере, продолжите вход в текущий сеанс.</p> : <>
            {mode === "registration" && step === 2 && <div className={styles.summary}><span>Продукт</span><strong>{products[product].title}</strong></div>}
            <dl className={styles.details}>{registrationSummary(data).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
          </>}
        </div>
        <footer className={styles.footer}>
          {submitError && <p className={styles.submitError} role="alert">{submitError}</p>}
          <div className={styles.actions}>
            {!finished && mode === "registration" && step > 0 && <button type="button" disabled={submitting} className={styles.back} onClick={() => setStep(step - 1)}>Назад</button>}
            <button type="submit" disabled={submitting} className={styles.next}>{submitting ? "Сохраняем данные…" : finished ? "Перейти в кабинет" : mode === "login" ? "Продолжить вход" : step === 2 ? "Подтвердить и продолжить" : "Далее"}<span aria-hidden="true">→</span></button>
          </div>
        </footer>
      </form>
    </dialog>, document.body)}
  </>;
}

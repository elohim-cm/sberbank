"use client";

import { useEffect, useId, useRef, useState } from "react";
import Icon from "./icons";
import styles from "./verification-dialog.module.css";

function Check() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function DocumentSample({ variant, back = false }: { variant: number; back?: boolean }) {
  const id = useId();
  return <svg className={styles.document} viewBox="0 0 260 160" fill="none" aria-hidden="true">
    <defs><linearGradient id={id} x2="260" y2="160" gradientUnits="userSpaceOnUse"><stop stopColor={variant === 1 ? "#e0f0e9" : "#f7e6ef"} /><stop offset="1" stopColor={variant === 1 ? "#d0e8de" : "#c2e0ff"} /></linearGradient></defs>
    <rect x="1" y="1" width="258" height="158" rx="13" fill={`url(#${id})`} stroke={variant === 1 ? "#bfded3" : "#e8eef8"} />
    <path d="M204 159v-24c0-20 13-34 33-34h22v45a13 13 0 0 1-13 13Z" fill="white" opacity=".13" />
    {back ? <><path d="M36 32h100M36 52h100M36 72h100M36 92h65M36 127h100" stroke="#9fbdd2" strokeWidth="8" strokeLinecap="round" /><circle cx="215" cy="116" r="17" fill="#a9c6da" /></> : <><rect x="19" y="21" width="82" height="100" rx="7" fill={variant === 1 ? "#c8e3d8" : "#ffffff"} opacity=".65" />
    <g fill={variant === 1 ? "#7995a4" : "#99bce3"}><circle cx="60" cy="60" r="19" /><path d="M21 117c0-24 17-36 39-36s39 12 39 36a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4" /></g>
    <g stroke={variant === 1 ? "#819ba8" : "#8db4df"} strokeWidth="10" strokeLinecap="round"><path d="M128 37h107" /><path d="M128 57h60" opacity=".9" /><path d="M128 77h90" opacity=".75" /><path d="M128 97h46" opacity=".7" /></g>
    <path d="M23 143h87m23 0h43" stroke={variant === 1 ? "#a9bfc3" : "#a6c4e7"} strokeWidth="8" strokeLinecap="round" /></>}
  </svg>;
}

function SelfieSample({ variant }: { variant: number }) {
  const id = useId();
  const female = variant === 2;
  return <svg className={styles.selfie} viewBox="0 0 180 180" fill="none" aria-hidden="true">
    <defs><clipPath id={id}><circle cx="90" cy="90" r="90" /></clipPath></defs>
    <g clipPath={`url(#${id})`}><circle cx="90" cy="90" r="90" fill={female ? "#d0e6ff" : "#ccecdf"} />
      {female && <path d="M45 61c8-43 70-43 85-2 7 18 5 37 14 56 13 26-6 32-25 32H55c-22 0-28-12-19-31 8-20 6-38 9-55" fill="#4d607a" />}
      <path d="M23 180v-15c0-22 26-35 67-35s67 13 67 35v15" fill={female ? "#74adf5" : "#56b78d"} />
      <path d="M75 112h30v24c-5 12-25 12-30 0Z" fill="#ffc09c" />
      <path d="M75 114h30v11c-10 7-20 5-30 0" fill="#eda884" opacity=".65" />
      <ellipse cx="90" cy="85" rx="33" ry="39" fill="#ffc6a4" /><ellipse cx="57" cy="86" rx="7" ry="10" fill="#ffc6a4" /><ellipse cx="123" cy="86" rx="7" ry="10" fill="#ffc6a4" />
      {female ? <path d="M49 84c0-43 14-55 41-55 32 0 43 23 43 55l-12-2c-9-8-15-17-17-26-12 16-32 23-49 26Z" fill="#4d607a" /> : <path d="M56 78c-9-33-6-41 9-42 4-17 28-17 42-11 26 7 26 25 20 54l-7-20c-17 6-36 3-51-6l-7 23Z" fill="#4d607a" />}
    </g>
  </svg>;
}

type DocumentKind = "passport" | "identity" | "licence";
type Photos = { front?: File; back?: File };
const documentKinds: { id: DocumentKind; title: string; description: string }[] = [
  { id: "passport", title: "Паспорт", description: "Гражданина Российской Федерации" },
  { id: "identity", title: "Удостоверение личности", description: "Временное удостоверение личности гражданина РФ" },
  { id: "licence", title: "Водительское удостоверение", description: "Российское национальное водительское удостоверение" },
];

function DocumentIcon({ kind }: { kind: DocumentKind }) {
  return <svg viewBox="0 0 80 80" fill="none" aria-hidden="true">
    {kind === "passport" ? <><rect x="17" y="7" width="46" height="65" rx="5" fill="#07523e" /><circle cx="40" cy="33" r="13" stroke="#bde9d8" strokeWidth="2" /><ellipse cx="40" cy="33" rx="6" ry="13" stroke="#bde9d8" strokeWidth="1.5" /><path d="M27 33h26M29 27h22M29 39h22M31 57h18" stroke="#bde9d8" strokeWidth="2" /></> : kind === "identity" ? <><rect x="2" y="15" width="76" height="50" rx="6" fill="#e0f5ed" /><circle cx="22" cy="35" r="7" fill="#159b72" /><path d="M11 55c0-15 22-15 22 0" fill="#159b72" /><path d="M40 28h27M40 34h27M40 40h27M40 46h18M40 52h10" stroke="#77c6ae" strokeWidth="2.5" /></> : <><circle cx="40" cy="40" r="35" fill="#e0f5ed" /><path d="m22 34 5-14h26l6 14 5 6v18H16V40Z" fill="#07523e" /><path d="m28 23-4 12h32l-4-12Z" fill="#c2e8df" /><rect x="21" y="40" width="11" height="6" rx="3" fill="#effaf6" /><rect x="48" y="40" width="11" height="6" rx="3" fill="#effaf6" /><path d="M23 58v5m34-5v5" stroke="#07523e" strokeWidth="7" strokeLinecap="round" /></>}
  </svg>;
}

function UploadIcon() {
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function PhotoSlot({ label, file, onChange }: { label: string; file?: File; onChange: (file: File) => void }) {
  const [error, setError] = useState("");
  const preview = useRef<HTMLImageElement>(null);
  const inputId = useId();
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (preview.current) preview.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <div className={`${styles.photoSlot} ${file ? styles.hasPhoto : ""}`}>
    <div className={styles.photoPreview}>{file ? /* Local blob preview; no remote image request. */
      // eslint-disable-next-line @next/next/no-img-element
      <img ref={preview} alt={label} /> : <DocumentSample variant={1} back={label === "Обратная сторона"} />}</div>
    <strong>{label}</strong>
    <label className={styles.uploadButton} htmlFor={inputId}><UploadIcon /><span>{file ? "Заменить изображение" : "Выбрать изображение"}</span></label>
    <input id={inputId} className={styles.srOnly} type="file" accept="image/jpeg,image/png,image/webp" aria-label={label} aria-describedby={error ? `${inputId}-error` : undefined} onChange={event => {
      const selected = event.target.files?.[0];
      if (!selected) return;
      if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) setError("Выберите изображение JPG, PNG или WebP.");
      else if (selected.size > 10 * 1024 * 1024) setError("Размер изображения — не более 10 МБ.");
      else { setError(""); onChange(selected); }
      event.target.value = "";
    }} />
    {file && <span className={styles.fileName}>{file.name}</span>}
    {error && <span id={`${inputId}-error`} className={styles.uploadError} role="alert">{error}</span>}
  </div>;
}

export default function VerificationDialog({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [documentKind, setDocumentKind] = useState<DocumentKind | null>(null);
  const [photos, setPhotos] = useState<Partial<Record<DocumentKind, Photos>>>({});
  const [backwards, setBackwards] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    const trigger = window.document.activeElement as HTMLElement | null;
    const overflow = window.document.body.style.overflow;
    element?.showModal();
    window.document.body.style.overflow = "hidden";
    return () => { element?.close(); window.document.body.style.overflow = overflow; trigger?.focus(); };
  }, []);

  useEffect(() => { heading.current?.focus({ preventScroll: true }); }, [step]);

  function go(next: number) {
    setBackwards(next < step);
    setStep(next);
    dialog.current?.scrollTo({ top: 0, behavior: "instant" });
  }

  const currentPhotos = documentKind ? photos[documentKind] ?? {} : {};
  const photosReady = !!currentPhotos.front && (documentKind === "passport" || !!currentPhotos.back);
  function completeVerification() {
    if (!gender || !documentKind || !photosReady) return;
    onComplete();
    go(3);
  }
  function setPhoto(side: keyof Photos, file: File) {
    if (documentKind) setPhotos(previous => ({ ...previous, [documentKind]: { ...previous[documentKind], [side]: file } }));
  }

  return <dialog ref={dialog} className={styles.dialog} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
  }}>
    <header className={styles.header}><h2 id={titleId}>Проверка личности</h2><button type="button" className={styles.close} aria-label="Закрыть окно" onClick={onClose}><Icon name="close" size={28} /></button></header>
    <ol className={styles.steps} aria-label="Этапы проверки">
      {["Пол", "Документ", "Фото", "Статус"].map((label, index) => <li key={label} className={index <= step ? styles.active : ""} aria-current={index === step ? "step" : undefined}><span className={styles.stepNumber}>{index < step ? <Check /> : `0${index + 1}`}</span><span>{label}</span></li>)}
    </ol>
    <div key={step} className={`${styles.stage} ${backwards ? styles.backwards : ""}`}>
      {step === 0 ? <>
        <div className={styles.intro}><h3 ref={heading} tabIndex={-1}>Выберите ваш пол</h3></div>
        <fieldset className={styles.samples}><legend className={styles.srOnly}>Ваш пол</legend>{(["male", "female"] as const).map(value => <label key={value} className={styles.sample}>
          <input type="radio" name="gender" value={value} checked={gender === value} onChange={() => setGender(value)} />
          <span className={styles.radio} aria-hidden="true" />
          <SelfieSample variant={value === "male" ? 1 : 2} />
          <span>{value === "male" ? "Мужчина" : "Женщина"}</span>
        </label>)}</fieldset>
        <div className={styles.actions}><button type="button" className={styles.secondary} onClick={onClose}>Отмена</button><button type="button" className={styles.primary} disabled={!gender} onClick={() => go(1)}>Далее</button></div>
      </> : step === 1 ? <>
        <div className={`${styles.intro} ${styles.centeredIntro}`}><h3 ref={heading} tabIndex={-1}>Выберите документ</h3><p>Мы принимаем следующие документы<br />для идентификации</p></div>
        <fieldset className={styles.documentChoices}><legend className={styles.srOnly}>Выберите документ</legend>{documentKinds.map(item => <label key={item.id} className={styles.documentChoice}>
          <input type="radio" name="document-kind" value={item.id} checked={documentKind === item.id} onChange={() => setDocumentKind(item.id)} />
          <DocumentIcon kind={item.id} /><span><strong>{item.title}</strong><small>{item.description}</small></span><Icon name="chevron" size={20} />
        </label>)}</fieldset>
        <div className={`${styles.actions} ${styles.spreadActions}`}><button type="button" className={styles.secondary} onClick={() => go(0)}><span aria-hidden="true">←</span> Назад</button><button type="button" className={styles.primary} disabled={!documentKind} onClick={() => go(2)}>Продолжить <span aria-hidden="true">→</span></button></div>
      </> : step === 2 ? <>
        <div className={`${styles.intro} ${styles.centeredIntro}`}><h3 ref={heading} tabIndex={-1}>Добавьте фотографии документа</h3><p>{documentKind === "passport" ? "Загрузите четкую фотографию страницы с личными данными." : "Загрузите четкие фотографии лицевой и оборотной стороны."}<br />Все данные должны быть хорошо видны.</p></div>
        <div className={`${styles.photoSlots} ${documentKind === "passport" ? styles.singlePhoto : ""}`}>
          <PhotoSlot label={documentKind === "passport" ? "Страница с личными данными" : "Лицевая сторона"} file={currentPhotos.front} onChange={file => setPhoto("front", file)} />
          {documentKind !== "passport" && <PhotoSlot label="Обратная сторона" file={currentPhotos.back} onChange={file => setPhoto("back", file)} />}
        </div>
        <div className={styles.recipientSpace} aria-hidden="true" />
        <div className={`${styles.actions} ${styles.spreadActions}`}><button type="button" className={styles.secondary} onClick={() => go(1)}><span aria-hidden="true">←</span> Назад</button><button type="button" className={styles.primary} disabled={!photosReady} onClick={completeVerification}>Продолжить <span aria-hidden="true">→</span></button></div>
      </> : <>
        <div className={styles.success} aria-hidden="true"><svg viewBox="0 0 360 210" fill="none"><circle cx="180" cy="105" r="102" fill="#e9f7f1" /><circle cx="180" cy="105" r="78" fill="#d5f0e3" /><circle cx="180" cy="105" r="53" fill="#009746" /><path d="M180 76v30l20 12" stroke="white" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /><g stroke="#6cd6a1" strokeWidth="2.5" strokeLinecap="round"><path d="m43 61 16 16m-16 70 16-16m244-79 16 16m-16 67 16 16M15 105h16m-8-8v16m302-10h16m-8-8v16" /></g></svg></div>
        <div className={styles.completeIntro}><h3 ref={heading} tabIndex={-1}>Проверка личности в ожидании</h3></div>
        <div className={`${styles.actions} ${styles.completeActions}`}><button type="button" className={styles.primary} onClick={onClose}>Вернуться в кабинет</button></div>
      </>}
    </div>
  </dialog>;
}

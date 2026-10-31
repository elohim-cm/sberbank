"use client";

import { useEffect, useId, useRef, useState } from "react";
import { kycImageTypes, maxKycInputBytes } from "@/lib/kyc";
import styles from "./verification-dialog.module.css";

export default function SelfieCapture({ file, onChange, disabled }: { file?: File; onChange: (file: File | undefined) => void; disabled: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const preview = useRef<HTMLImageElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const cameraRequest = useRef(0);
  const [camera, setCamera] = useState<"idle" | "loading" | "ready">("idle");
  const [error, setError] = useState("");
  const inputId = useId();

  function releaseCamera() {
    cameraRequest.current++;
    stream.current?.getTracks().forEach(track => track.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
  }

  useEffect(() => () => {
    cameraRequest.current++;
    stream.current?.getTracks().forEach(track => track.stop());
  }, []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (preview.current) preview.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function openCamera() {
    releaseCamera();
    onChange(undefined);
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Камера недоступна. Откройте сайт по HTTPS или используйте кнопку выбора фотографии.");
      return;
    }
    setCamera("loading");
    const request = cameraRequest.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 1280 } } });
      if (request !== cameraRequest.current) { media.getTracks().forEach(track => track.stop()); return; }
      stream.current = media;
      if (!video.current) { releaseCamera(); return; }
      video.current.srcObject = media;
      await video.current.play();
      if (request === cameraRequest.current) setCamera("ready");
    } catch {
      if (request !== cameraRequest.current) return;
      releaseCamera();
      setCamera("idle");
      setError("Не удалось включить камеру. Разрешите доступ к камере или выберите фотографию.");
    }
  }

  async function takePhoto() {
    const element = video.current;
    if (!element?.videoWidth || !element.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = element.videoWidth;
    canvas.height = element.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.drawImage(element, 0, 0);
    const request = cameraRequest.current;
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", .94));
    if (request !== cameraRequest.current) return;
    if (!blob) { setError("Не удалось сделать фотографию. Повторите попытку."); return; }
    onChange(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
    releaseCamera();
    setCamera("idle");
  }

  return <div className={styles.selfieCapture}>
    <div className={styles.cameraPreview}>
      <video ref={video} autoPlay muted playsInline className={file || camera === "idle" ? styles.cameraHidden : styles.cameraVideo} aria-label="Предпросмотр камеры" />
      {file ? /* The preview is a local object URL, never a public document URL. */
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={preview} alt="Ваше селфи" /> : camera === "idle" ? <div className={styles.cameraPlaceholder}><svg viewBox="0 0 100 100" fill="none" aria-hidden="true"><circle cx="50" cy="34" r="19" stroke="currentColor" strokeWidth="3" /><path d="M15 90c0-35 70-35 70 0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg><span>Расположите лицо в центре кадра</span></div> : null}
    </div>
    <div className={styles.cameraControls}>
      {camera === "ready" ? <button type="button" className={styles.primary} disabled={disabled} onClick={() => void takePhoto()}>Сделать снимок</button> : <button type="button" className={styles.secondary} disabled={disabled || camera === "loading"} onClick={() => void openCamera()}>{camera === "loading" ? "Включаем камеру…" : file ? "Переснять селфи" : "Включить камеру"}</button>}
      <label className={`${styles.uploadButton} ${disabled ? styles.disabledUpload : ""}`} htmlFor={inputId}>Выбрать фото / камера телефона</label>
      <input id={inputId} type="file" className={styles.srOnly} accept="image/jpeg,image/png,image/webp" capture="user" disabled={disabled} aria-label="Сделать или выбрать фотографию селфи" onChange={event => {
        const selected = event.target.files?.[0];
        if (selected) {
          if (!kycImageTypes.includes(selected.type) || selected.size > maxKycInputBytes || !selected.size) setError("Выберите фотографию JPG, PNG или WebP размером не более 10 МБ.");
          else { releaseCamera(); setCamera("idle"); setError(""); onChange(selected); }
        }
        event.target.value = "";
      }} />
    </div>
    {error && <p role="alert" className={styles.uploadError}>{error}</p>}
  </div>;
}

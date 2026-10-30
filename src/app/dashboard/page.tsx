import type { Metadata } from "next";
import { Suspense } from "react";
import Dashboard from "./dashboard";
import branding from "../header-data.json";
import styles from "./dashboard.module.css";

export const metadata: Metadata = {
  title: `Личный кабинет — ${branding.appButtonTitle} · Тестовые данные`,
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <Suspense fallback={<main className={styles.loading} aria-busy="true"><span className={styles.loadingMark} /><p>Загружаем личный кабинет…</p></main>}><Dashboard brand={{ logo: branding.logoImageUrl, name: branding.appButtonTitle }} /></Suspense>;
}

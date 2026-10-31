import type { Metadata } from "next";
import { Suspense } from "react";
import { adminCodeConfigured, currentAdmin } from "@/lib/server/admin-access";
import AdminConsole, { AdminLogin } from "./admin-console";
import styles from "./admin.module.css";

export const metadata: Metadata = { title: "Проверка KYC — Администрирование", robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" };

export default function AdminPage() {
  return <Suspense fallback={<main className={styles.loading} aria-busy="true">Открываем панель управления…</main>}><AdminScreen /></Suspense>;
}

async function AdminScreen() {
  const access = await currentAdmin();
  if (!access) return <AdminLogin configured={adminCodeConfigured()} />;
  return <AdminConsole access={access} />;
}

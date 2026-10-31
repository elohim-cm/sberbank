import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { currentAccount, dashboardProfile } from "@/lib/server/accounts";
import Dashboard from "./dashboard";
import branding from "../header-data.json";
import styles from "./dashboard.module.css";
import { accountOperations } from "@/lib/server/account-operations";
import type { AccountOperations } from "@/lib/account-operations";

export const metadata: Metadata = {
  title: `Личный кабинет — ${branding.appButtonTitle}`,
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <Suspense fallback={<main className={styles.loading} aria-busy="true"><span className={styles.loadingMark} /><p>Загружаем личный кабинет…</p></main>}><AccountDashboard /></Suspense>;
}

async function AccountDashboard() {
  let account;
  try { account = await currentAccount(); }
  catch { return <main className={styles.loading}><p>Не удалось загрузить профиль. Попробуйте обновить страницу позже.</p><Link href="/inscription">Вернуться к регистрации</Link></main>; }
  if (!account) redirect("/inscription");
  let operations: AccountOperations;
  try { operations = await accountOperations(account._id); }
  catch { operations = { items: [], nextCursor: null, unavailable: true }; }
  return <Dashboard profile={dashboardProfile(account)} operations={operations} brand={{ logo: branding.logoImageUrl, name: branding.appButtonTitle }} />;
}

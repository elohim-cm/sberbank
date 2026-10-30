import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import styles from "./registration.module.css";
import RegistrationDialog from "./registration-dialog";

export const metadata: Metadata = {
  title: "Регистрация",
  robots: { index: false, follow: false },
};

export default function RegistrationPage() {
  return (
    <main className={styles.page}>
      <div className={styles.heading}>
        <span className={styles.mark} aria-hidden="true">↻</span>
        <h1>РЕГИСТРАЦИЯ</h1>
      </div>

      <section className={styles.panel} aria-label="Личный кабинет">
        <div className={styles.firstRow}>
          <section className={styles.welcome} aria-labelledby="welcome-title">
            <h2 id="welcome-title">Добро пожаловать<br />в ваш личный кабинет</h2>
            <svg className={styles.spark} viewBox="0 0 24 40" fill="none" aria-hidden="true"><path d="m5 10 6-6M9 21h11M5 32l6 5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            <p>Откройте для себя удобный сервис,<br className={styles.desktopBreak} /> созданный для повседневной жизни.</p>
            <RegistrationDialog />
          </section>

          <section className={styles.phone} aria-labelledby="phone-title">
            <h2 id="phone-title">Всё под рукой</h2>
            <div className={styles.phonePicture} role="img" aria-label="Телефон с примером баланса 1 200 000 рублей">
              <div className={styles.phoneDevice}>
                <Image src="/common/fhouse/main/images/quick/phone_premium1.webp" width={1350} height={1350} sizes="300px" alt="" className={styles.phoneImage} />
                <span className={styles.balance} aria-hidden="true">1 200 000 ₽</span>
              </div>
              <svg className={styles.phoneSpark} viewBox="0 0 24 40" fill="none" aria-hidden="true"><path d="m5 10 6-6M9 21h11" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            </div>
          </section>
        </div>

        <div className={styles.secondRow}>
          <section className={styles.personal} aria-labelledby="personal-title">
            <div className={styles.shield} aria-hidden="true">
              <svg viewBox="0 0 68 64" fill="none"><path d="M25 8c7 5 12 6 20 8v14c0 13-8 22-20 28C13 52 5 43 5 30V16c8-2 13-3 20-8Z" stroke="currentColor" strokeWidth="3.5" strokeLinejoin="round" /><path d="m16 32 6 6 13-14M57 5l3-8M61 18l7-3" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <h2 id="personal-title">Ваш личный<br />кабинет</h2>
            <p>Предварительный просмотр без реальных данных.</p>
          </section>

          <section className={styles.everyday} aria-labelledby="everyday-title">
            <Image src="/common/fhouse/main/images/trustnew/sbercat_2.webp" width={2184} height={3204} sizes="290px" alt="Серый кот с зелёной подушкой" className={styles.catPicture} />
            <h2 id="everyday-title">Повседневная<br />жизнь проще</h2>
            <p>Сервисы, которые<br />всегда рядом.</p>
          </section>
        </div>

        <nav className={styles.footer} aria-label="Полезные ссылки">
          <Link href="/">На главную <Arrow /></Link>
          <Link href="/ru/person#questions">Помощь и поддержка <Arrow /></Link>
        </nav>
      </section>
    </main>
  );
}

function Arrow() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

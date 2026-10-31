import { useId } from "react";
import type { ProductKind } from "../test-profiles";
import styles from "./bank-card.module.css";

export default function BankCard({ product, lastDigits, holder }: { product: ProductKind; lastDigits: string; holder: string }) {
  const id = useId();
  const black = product === "credit";
  const title = black ? "Кредитная карта" : "Виртуальная карта";
  const maskedNumber = `••••  ••••  ••••  ${lastDigits}`;
  return <svg className={styles.card} viewBox="0 0 856 540" role="img" aria-label={`${title}. ${maskedNumber}`}>
    <defs>
      <linearGradient id={`${id}-surface`} x1="0" y1="0" x2=".9" y2="1" gradientUnits="objectBoundingBox">
        <stop stopColor={black ? "#182c23" : "#00572b"} /><stop offset=".4" stopColor={black ? "#0c1510" : "#09913d"} /><stop offset="1" stopColor={black ? "#16231b" : "#91da65"} />
      </linearGradient>
      <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor={black ? "#f1f4e9" : "#e6ffc1"} /><stop offset=".23" stopColor={black ? "#9aada0" : "#b7ed89"} /><stop offset=".48" stopColor={black ? "#e6ece0" : "#efffc9"} /><stop offset=".7" stopColor={black ? "#81958a" : "#a1df6f"} /><stop offset="1" stopColor={black ? "#d5ded3" : "#d1f6a5"} />
      </linearGradient>
      <linearGradient id={`${id}-chip`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#e4e9d9" /><stop offset=".35" stopColor="#c3cbb9" /><stop offset=".58" stopColor="#f3f5e9" /><stop offset="1" stopColor="#a6b8a5" />
      </linearGradient>
      <linearGradient id={`${id}-light`} x1="0" y1="0" x2="1" y2="1">
        <stop stopColor="#ffffff" stopOpacity=".16" /><stop offset=".35" stopColor="#ffffff" stopOpacity="0" /><stop offset=".72" stopColor="#ffffff" stopOpacity="0" /><stop offset="1" stopColor="#ffffff" stopOpacity=".12" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx=".92" cy=".18" r=".9">
        <stop stopColor={black ? "#78a27d" : "#c5ff95"} stopOpacity={black ? ".12" : ".38"} /><stop offset="1" stopColor="#ffffff" stopOpacity="0" />
      </radialGradient>
      <clipPath id={`${id}-clip`}><rect x="1" y="1" width="854" height="538" rx="30" /></clipPath>
      <filter id={`${id}-texture`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="3" stitchTiles="stitch" />
        <feColorMatrix type="saturate" values="0" />
        <feComponentTransfer><feFuncA type="linear" slope=".035" /></feComponentTransfer>
        <feBlend in="SourceGraphic" mode="soft-light" />
      </filter>
    </defs>
    <g clipPath={`url(#${id}-clip)`}>
      <rect width="856" height="540" fill={`url(#${id}-surface)`} />
      <rect width="856" height="540" fill={`url(#${id}-glow)`} />
      <path d="M-100 470C95 265 365 265 972 30V540H-100Z" fill={black ? "#38543c" : "#b5ee82"} opacity={black ? ".05" : ".025"} />
      <rect width="856" height="540" fill={`url(#${id}-light)`} filter={`url(#${id}-texture)`} />
      <g transform="translate(32 32) scale(.64)" fill={`url(#${id}-metal)`}>
        {/* Exact symbol paths from the site's logo: /static/constructor/dict/1778652591668.svg. */}
        <g transform="translate(50 35) scale(5.84) translate(-14.7 -13.03)">
          <path d="M36.62 23.99C36.62 23.32 36.56 22.67 36.45 22.03L34.09 23.77C34.09 23.84 34.09 23.92 34.09 23.99C34.09 28.64 30.31 32.43 25.66 32.43C21.01 32.43 17.23 28.64 17.23 23.99C17.23 19.35 21.01 15.56 25.66 15.56C27.42 15.56 29.06 16.11 30.41 17.03L32.55 15.46C30.66 13.94 28.27 13.03 25.66 13.03C19.61 13.03 14.7 17.94 14.7 23.99C14.7 30.05 19.61 34.96 25.66 34.96C31.71 34.96 36.62 30.05 36.62 23.99Z" />
          <path d="M34.33 17.29C34.85 17.96 35.29 18.69 35.65 19.47L25.66 26.83L21.48 24.22L21.48 21.07L25.66 23.69L34.33 17.29Z" />
        </g>
        <text x="205" y="158" fontFamily="Arial, Helvetica, sans-serif" fontSize="168" fontWeight="700" letterSpacing="-7">СБЕР</text>
      </g>
      <g transform="translate(64 238)">
        <rect width="112" height="84" rx="13" fill={`url(#${id}-chip)`} stroke="#667d67" strokeWidth="2" />
        <path d="M0 27h29m54 0h29M0 56h29m54 0h29M30 0v23l10 10v19L30 62v22m52-84v23L72 33v19l10 10v22M40 33h32M40 52h32" fill="none" stroke="#71866d" strokeWidth="2" />
        <rect x="42" y="17" width="28" height="50" rx="9" fill="none" stroke="#71866d" strokeWidth="1.5" />
        <path d="M5 7h96" stroke="#fff" strokeOpacity=".45" strokeWidth="2" />
      </g>
      <g transform="translate(207 253)" fill="none" stroke={black ? "#c9d7c7" : "#e2ffd0"} strokeWidth="5" strokeLinecap="round" opacity=".85">
        <path d="M0 17q10 10 0 20M12 8q18 19 0 38M25 0q25 27 0 54" />
      </g>
      <text x="64" y="390" fill={black ? "#a8bbaa" : "#e0ffd2"} fontFamily="Arial, Helvetica, sans-serif" fontSize="23" letterSpacing="1">{title}</text>
      <text x="62" y="441" fill={black ? "#ecf1e8" : "#f4ffe6"} fontFamily="Arial, Helvetica, sans-serif" fontSize="29" letterSpacing="4">{maskedNumber}</text>
      <text x="64" y="489" fill={black ? "#acbcad" : "#e8ffdc"} fontFamily="Arial, Helvetica, sans-serif" fontSize="18" letterSpacing="1.6">{holder.toLocaleUpperCase("ru-RU").slice(0, 34)}</text>
      <text x="787" y="492" textAnchor="end" fill={black ? `url(#${id}-metal)` : "#f1ffe3"} fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="58" letterSpacing="-3">МИР</text>
      <rect x="1" y="1" width="854" height="538" rx="30" fill="none" stroke="#ffffff" strokeOpacity=".22" strokeWidth="2" />
    </g>
  </svg>;
}

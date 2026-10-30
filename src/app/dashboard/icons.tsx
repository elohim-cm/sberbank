import type { CSSProperties, ReactNode } from "react";

export type IconName = "home" | "card" | "account" | "list" | "transfer" | "credit" | "user" | "help" | "shield" | "lock" | "plus" | "document" | "eye" | "eyeOff" | "chevron" | "arrow" | "cart" | "refund" | "more" | "logout" | "settings" | "close" | "contactless";
const paths: Record<IconName, ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="M3 10h18M7 15h3" /></>,
  account: <><path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M14 3v5h5M8 12h7M8 16h7" /></>,
  list: <><path d="M9 5h11M9 12h11M9 19h11" /><circle cx="4" cy="5" r="1" /><circle cx="4" cy="12" r="1" /><circle cx="4" cy="19" r="1" /></>,
  transfer: <><path d="M4 8h16m-4-4 4 4-4 4M20 16H4m4-4-4 4 4 4" /></>,
  credit: <><path d="M3 12a9 9 0 1 0 2.7-6.3L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
  user: <><circle cx="12" cy="7" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2Z" /></>,
  help: <><circle cx="12" cy="12" r="9" /><path d="M9.5 8.5a2.5 2.5 0 1 1 4.2 2.3c-1.2.8-1.7 1.2-1.7 2.7M12 17h.01" /></>,
  shield: <><path d="m12 2 8 4v6c0 5-4 8-8 10-4-2-8-5-8-10V6Z" /><path d="M12 7v5M12 16h.01" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M7 12h10" /></>,
  document: <><path d="M5 3h9l5 5v13H5Z" /><path d="M14 3v6h5M8 13h8M8 17h8" /></>,
  eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  eyeOff: <><path d="m3 3 18 18M10.6 5.1 12 5c6 0 10 7 10 7a19 19 0 0 1-3.1 3.8M6.1 6.1A23 23 0 0 0 2 12s4 7 10 7c1.8 0 3.4-.6 4.8-1.4M10 10a3 3 0 0 0 4 4" /></>,
  chevron: <path d="m7 10 5 5 5-5" />,
  arrow: <path d="M4 12h16m-5-5 5 5-5 5" />,
  cart: <><path d="M2 3h3l3 13h11l3-9H6M9 20h.01M18 20h.01" /><circle cx="9" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
  refund: <><path d="m8 4-5 5 5 5M3 9h11a6 6 0 0 1 0 12H9" /></>,
  more: <><circle cx="4" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="20" cy="12" r="1" /></>,
  logout: <><path d="M9 3H4v18h5M13 7l5 5-5 5M8 12h13" /></>,
  settings: <><path d="m10 2-.6 3-2 .9-2.6-1.5-2 3.4L5 10v3L2.8 15l2 3.5 2.6-1.4 2 .9.6 3h4l.6-3 2-.9 2.6 1.4 2-3.5-2.2-2v-3l2.2-2.2-2-3.4L16.6 6l-2-.9L14 2Z" /><circle cx="12" cy="11.5" r="3" /></>,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  contactless: <><path d="M8 8a6 6 0 0 1 0 8M12 5a10 10 0 0 1 0 14M16 2a14 14 0 0 1 0 20" /></>,
};

export default function Icon({ name, size = 22, className, style }: { name: IconName; size?: number; className?: string; style?: CSSProperties }) {
  return <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

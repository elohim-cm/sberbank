import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "СберБанк — Частным клиентам",
  icons: { icon: [{ url: "/favicon.ico" }, { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" }] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}

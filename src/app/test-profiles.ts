// Local fixtures shared by the registration preview and dashboard. No real accounts.
export type ProductKind = "virtual" | "credit";

export const testProfiles = [
  { id: "01", name: "Тестовый пользователь 01", birth: "21.01.1990", city: "Тестовый город А", address: "Тестовая улица, д. 1", email: "profile-01@example.invalid", phone: "+7 (000) 000-00-01", product: "credit", balance: 215000, limit: 300000, used: 85000, payment: 5000, lastDigits: "0842" },
  { id: "02", name: "Тестовый пользователь 02", birth: "15.06.1985", city: "Тестовый город Б", address: "Тестовая улица, д. 2", email: "profile-02@example.invalid", phone: "+7 (000) 000-00-02", product: "virtual", balance: 120000, limit: 200000, used: 80000, payment: 3000, lastDigits: "1953" },
  { id: "03", name: "Тестовый пользователь 03", birth: "09.03.1960", city: "Тестовый город В", address: "Тестовая улица, д. 3", email: "profile-03@example.invalid", phone: "+7 (000) 000-00-03", product: "credit", balance: 365000, limit: 500000, used: 135000, payment: 7500, lastDigits: "2607" },
] as const;

export function dashboardHref(profile: string, product: ProductKind, section = "home") {
  return `/dashboard?${new URLSearchParams({ profile, product, ...(section !== "home" ? { section } : {}) })}`;
}

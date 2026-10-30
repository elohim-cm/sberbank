import type { ProductKind } from "../test-profiles";

export type RegistrationData = {
  lastName: string;
  firstName: string;
  birth: string;
  citizenship: string;
  residence: string;
  city: string;
  address: string;
  email: string;
  phone: string;
  occupation: string;
  income: string;
};

export const emptyRegistration: RegistrationData = {
  lastName: "", firstName: "", birth: "", citizenship: "", residence: "",
  city: "", address: "", email: "", phone: "", occupation: "", income: "",
};

export const occupations = ["Наёмный работник", "Руководитель", "Предприниматель", "Фрилансер", "Самозанятый", "Пенсионер", "Без работы", "Другое"];
export type RegistrationErrors = Partial<Record<keyof RegistrationData, string>>;

export function validateRegistration(data: RegistrationData, today: string): RegistrationErrors {
  const errors: RegistrationErrors = {};
  for (const key of Object.keys(emptyRegistration) as (keyof RegistrationData)[]) {
    if (!data[key].trim()) errors[key] = "Заполните это поле.";
  }
  if (data.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) errors.email = "Введите корректный адрес электронной почты.";
  if (data.phone.trim() && (!/^[+\d\s().-]+$/.test(data.phone) || !/^\d{7,15}$/.test(data.phone.replace(/\D/g, "")))) errors.phone = "Введите корректный номер телефона.";
  if (data.birth) {
    const date = new Date(`${data.birth}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.birth) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== data.birth || data.birth > today) errors.birth = "Введите корректную дату рождения, не позднее сегодняшнего дня.";
  }
  if (data.occupation && !occupations.includes(data.occupation)) errors.occupation = "Выберите вашу занятость.";
  if (data.income.trim() && (!/^\d+(?:[.,]\d{1,2})?$/.test(data.income.trim()) || !Number.isFinite(Number(data.income.replace(",", "."))))) errors.income = "Введите доход не меньше нуля, с точностью до копеек.";
  return errors;
}

export function registrationSummary(data: RegistrationData): [string, string][] {
  const birth = data.birth ? new Intl.DateTimeFormat("ru-RU", { timeZone: "UTC" }).format(new Date(`${data.birth}T00:00:00Z`)) : "";
  return [
    ["Фамилия", data.lastName.trim()], ["Имя", data.firstName.trim()],
    ["Дата рождения", birth], ["Гражданство", data.citizenship.trim()],
    ["Страна проживания", data.residence.trim()], ["Город", data.city.trim()],
    ["Адрес", data.address.trim()], ["Электронная почта", data.email.trim()],
    ["Телефон", data.phone.trim()], ["Занятость", data.occupation],
    ["Ежемесячный доход", `${new Intl.NumberFormat("ru-RU").format(Number(data.income.replace(",", ".")))} ₽`],
  ];
}

export type DashboardProfile = {
  id: string; name: string; birth: string; city: string; address: string; email: string; phone: string;
  product: ProductKind; balance: number; limit: number; used: number; payment: number; lastDigits: string;
  firstName?: string; lastName?: string;
  citizenship?: string; residence?: string; occupation?: string; income?: string;
};

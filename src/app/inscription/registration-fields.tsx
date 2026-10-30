import type { HTMLInputAutoCompleteAttribute } from "react";
import { occupations, type RegistrationData, type RegistrationErrors } from "./registration-data";
import styles from "./registration-dialog.module.css";

const fields: { key: keyof RegistrationData; label: string; type?: string; autoComplete?: HTMLInputAutoCompleteAttribute; placeholder?: string }[] = [
  { key: "lastName", label: "Фамилия", autoComplete: "family-name", placeholder: "Введите фамилию" },
  { key: "firstName", label: "Имя", autoComplete: "given-name", placeholder: "Введите имя" },
  { key: "birth", label: "Дата рождения", type: "date", autoComplete: "bday" },
  { key: "citizenship", label: "Гражданство", placeholder: "Укажите гражданство" },
  { key: "residence", label: "Страна проживания", autoComplete: "country-name", placeholder: "Введите страну" },
  { key: "city", label: "Город", autoComplete: "address-level2", placeholder: "Введите город" },
  { key: "address", label: "Адрес проживания", autoComplete: "street-address", placeholder: "Улица, дом, квартира" },
  { key: "email", label: "Электронная почта", type: "email", autoComplete: "email", placeholder: "Введите электронную почту" },
  { key: "phone", label: "Телефон", type: "tel", autoComplete: "tel", placeholder: "Номер с кодом страны" },
];

export default function RegistrationFields({ data, errors, onChange, today }: {
  data: RegistrationData; errors: RegistrationErrors; onChange: (key: keyof RegistrationData, value: string) => void; today: string;
}) {
  return <div className={styles.formGrid}>
    {fields.map(field => <label key={field.key} className={styles.field} htmlFor={`registration-${field.key}`}>{field.label}
      <input id={`registration-${field.key}`} name={field.key} type={field.type ?? "text"} required autoComplete={field.autoComplete} value={data[field.key]} placeholder={field.placeholder} max={field.type === "date" ? today : undefined} maxLength={field.type === "date" ? undefined : 254} aria-invalid={!!errors[field.key]} aria-describedby={errors[field.key] ? `registration-${field.key}-error` : undefined} onChange={event => onChange(field.key, event.target.value)} />
      {errors[field.key] && <span id={`registration-${field.key}-error`} className={styles.fieldError}>{errors[field.key]}</span>}
    </label>)}
    <label className={styles.field} htmlFor="registration-occupation">Занятость
      <select id="registration-occupation" name="occupation" required value={data.occupation} aria-invalid={!!errors.occupation} aria-describedby={errors.occupation ? "registration-occupation-error" : undefined} onChange={event => onChange("occupation", event.target.value)}>
        <option value="" disabled>Выберите вашу занятость</option>{occupations.map(item => <option key={item} value={item}>{item}</option>)}
      </select>
      {errors.occupation && <span id="registration-occupation-error" className={styles.fieldError}>{errors.occupation}</span>}
    </label>
    <label className={styles.field} htmlFor="registration-income">Ежемесячный доход, ₽
      <input id="registration-income" name="income" type="text" inputMode="decimal" required value={data.income} placeholder="Введите сумму" maxLength={20} aria-invalid={!!errors.income} aria-describedby={errors.income ? "registration-income-error" : undefined} onChange={event => onChange("income", event.target.value)} />
      {errors.income && <span id="registration-income-error" className={styles.fieldError}>{errors.income}</span>}
    </label>
  </div>;
}

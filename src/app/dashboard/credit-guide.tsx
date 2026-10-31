import Icon, { type IconName } from "./icons";
import styles from "./credit-guide.module.css";

const terms: { title: string; text: string; icon: IconName }[] = [
  { title: "Кредитный лимит", icon: "card", text: "Сумма заёмных средств, которой можно пользоваться по карте. Покупки уменьшают доступный остаток. Погашение основного долга обычно восстанавливает доступную сумму в пределах действующего лимита." },
  { title: "Льготный период", icon: "credit", text: "По некоторым операциям проценты можно не платить, если выполнить условия договора и вернуть требуемую сумму вовремя. Срок, начало отсчёта и перечень операций зависят от карты." },
  { title: "Минимальный платёж", icon: "refund", text: "Сумма, которую необходимо внести к установленной дате. Она уменьшает долг, но сама по себе не гарантирует отсутствие процентов. Для сохранения льготных условий может потребоваться погасить большую сумму." },
  { title: "Процентная ставка и ПСК", icon: "document", text: "Ставка определяет проценты за пользование кредитом. Полная стоимость кредита — ПСК — помогает оценить расходы с учётом предусмотренных платежей. Сравнивайте условия за пределами рекламного периода." },
  { title: "Наличные и переводы", icon: "transfer", text: "Для снятия наличных и переводов могут действовать отдельные комиссии и ставки. Льготный период нередко распространяется только на покупки. Условия таких операций стоит проверять отдельно." },
  { title: "Выписка и срок оплаты", icon: "list", text: "Выписка помогает сверить операции, задолженность, минимальный платёж и дату его внесения. Учитывайте время зачисления денег: отправка платежа и погашение задолженности могут происходить в разные моменты." },
];

const checks = [
  "Процентная ставка и полная стоимость кредита, включая условия после окончания акций.",
  "Какие операции входят в льготный период и какую сумму нужно вернуть для его сохранения.",
  "Размер минимального платежа, дата оплаты и срок зачисления пополнения.",
  "Комиссии за обслуживание, снятие наличных, переводы и дополнительные услуги.",
  "Последствия просрочки и порядок полного погашения задолженности.",
];

const questions = [
  ["Достаточно ли вносить только минимальный платёж?", "Он помогает выполнить требование по очередному платежу, но оставшаяся задолженность может продолжать приносить проценты. Погашение только минимума обычно увеличивает срок возврата долга и общие расходы."],
  ["Каждая покупка получает полный льготный период?", "Не обязательно. Отсчёт может быть связан с расчётным периодом, датой покупки или другими правилами договора. Поэтому рекламируемое количество дней не всегда одинаково для всех покупок."],
  ["Что происходит при пропуске платежа?", "В зависимости от договора возможны проценты, неустойка, потеря льготных условий и негативная запись в кредитной истории. Если возникают трудности, заранее обсудите ситуацию с кредитором."],
];

export default function CreditGuide() {
  return <div className={styles.guide}>
    <section className={styles.intro} aria-labelledby="credit-guide-title">
      <span className={styles.symbol} aria-hidden="true"><Icon name="credit" size={28} /></span>
      <div><span className={styles.eyebrow}>Общая информация</span><h2 id="credit-guide-title">Как устроена кредитная карта</h2><p>Кредитная карта позволяет оплачивать покупки заёмными средствами в пределах установленного лимита. Использованную сумму нужно вернуть в соответствии с договором.</p></div>
      <p className={styles.scope}>Здесь описаны общие принципы. Лимит, ставки, комиссии и сроки определяются договором и тарифами конкретной карты.</p>
    </section>

    <section aria-labelledby="credit-terms-title"><div className={styles.sectionHeading}><h2 id="credit-terms-title">Основные понятия</h2><p>Что важно понимать до первой покупки</p></div><div className={styles.terms}>{terms.map(term => <article key={term.title} className={styles.term}><span className={styles.termIcon} aria-hidden="true"><Icon name={term.icon} size={22} /></span><h3>{term.title}</h3><p>{term.text}</p></article>)}</div></section>

    <section className={styles.example} aria-labelledby="credit-example-title"><div className={styles.exampleHeading}><div><span className={styles.eyebrow}>Учебный пример</span><h2 id="credit-example-title">Как меняется доступная сумма</h2></div><span className={styles.exampleTag}>Условные суммы</span></div>
      <dl className={styles.figures}><div><dt>Кредитный лимит</dt><dd>100 000 ₽</dd></div><div><dt>Покупка по карте</dt><dd>15 000 ₽</dd></div><div><dt>Осталось доступно</dt><dd>85 000 ₽</dd></div></dl>
      <div className={styles.limitBar} role="img" aria-label="В учебном примере использовано 15 процентов лимита, доступно 85 процентов"><span /></div><div className={styles.barLabels}><span>Использовано 15%</span><span>Доступно 85%</span></div>
      <p>После возврата 15 000 ₽ доступная сумма снова составит 100 000 ₽, если лимит не изменился и нет других операций, процентов или комиссий. Это пример расчёта, а не данные вашего счёта.</p>
    </section>

    <div className={styles.lowerGrid}><section className={styles.checklist} aria-labelledby="credit-checklist-title"><h2 id="credit-checklist-title">Что проверить в договоре</h2><ul>{checks.map(item => <li key={item}><span aria-hidden="true">✓</span>{item}</li>)}</ul></section>
      <section className={styles.faq} aria-labelledby="credit-faq-title"><h2 id="credit-faq-title">Частые вопросы</h2>{questions.map(([question, answer]) => <details key={question}><summary>{question}<Icon name="chevron" size={18} /></summary><p>{answer}</p></details>)}</section></div>

    <details className={styles.sources}><summary>Источники информации<Icon name="chevron" size={17} /></summary><p>Официальные просветительские материалы о типовых принципах кредитования. Конкретные условия и применимые правила зависят от договора и страны выпуска карты.</p><ul>
      <li><a href="https://fincult.info/upload/iblock/e16/dg92asbovpqd5ym2m92ar1e4ifr9zcxz/ispolzovanie_osnovnyh_fin_uslug.pdf#page=22" target="_blank" rel="noopener noreferrer">Финансовая культура — банковские и кредитные карты</a></li>
      <li><a href="https://www.cbr.ru/faq/bank_s/kredity/" target="_blank" rel="noopener noreferrer">Банк России — договор, платежи и стоимость кредита</a></li>
      <li><a href="https://www.cbr.ru/press/event/?id=21049" target="_blank" rel="noopener noreferrer">Банк России — полная стоимость кредита по картам</a></li>
      <li><a href="https://www.consumerfinance.gov/ask-cfpb/what-is-a-grace-period-for-a-credit-card-en-47/" target="_blank" rel="noopener noreferrer">CFPB — принципы льготного периода</a></li>
      <li><a href="https://consumer.ftc.gov/articles/using-credit-cards-and-disputing-charges" target="_blank" rel="noopener noreferrer">FTC — платежи и проверка выписки</a></li>
      <li><a href="https://mycreditunion.gov/manage-your-money/consumer-loans-credit-cards/credit-cards" target="_blank" rel="noopener noreferrer">NCUA — кредитный лимит и доступная сумма</a></li>
    </ul></details>
  </div>;
}

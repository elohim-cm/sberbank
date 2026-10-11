"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import data from "./home-data.json";
import "./home.css";

type MenuItem = { text: string; href: string; children: MenuItem[] };
type Slide = { heading: string; description: string; imgUrl: string; serviceLogoUrl: string; serviceName: string; skipSlideDuration: number; isLightTheme?: boolean; reachBtn?: { text: string; linkUrl: string; isNewTab: boolean } };
const segments = [["Для всех", "/ru/person"], ["Для молодёжи", "/ru/person_young"], ["Для семьи", "/ru/person_family"], ["Пенсионерам", "/ru/person_pens"], ["Премиум", "/ru/person/premium"]];

export default function Home() {
  const [panel, setPanel] = useState<string | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const header = useRef<HTMLElement>(null);
  const slides: Slide[] = story === null ? [] : data.stories[story].stories;
  const slide = slides[slideIndex];

  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setPanel(null); };
    const outside = (event: PointerEvent) => { if (!header.current?.contains(event.target as Node)) setPanel(null); };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); };
  }, []);
  useEffect(() => {
    if (story === null) return;
    const currentDialog = dialog.current;
    currentDialog?.showModal();
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { currentDialog?.close(); document.body.style.overflow = oldOverflow; };
  }, [story]);

  const toggle = (name: string) => setPanel(panel === name ? null : name);
  const advanceStory = (direction: number) => {
    if (story === null) return;
    if (slideIndex + direction >= 0 && slideIndex + direction < slides.length) setSlideIndex(slideIndex + direction);
    else if (story + direction >= 0 && story + direction < data.stories.length) { setStory(story + direction); setSlideIndex(direction > 0 ? 0 : data.stories[story - 1].stories.length - 1); }
    else setStory(null);
  };
  const renderMenu = (items: MenuItem[]): React.ReactNode => items.map((item) => item.children.length ? (
    <details key={item.text} className="menu-category"><summary>{item.text}<span aria-hidden="true">›</span></summary><div className="menu-sublinks">{renderMenu(item.children)}</div></details>
  ) : <a key={item.href + item.text} href={item.href}>{item.text}</a>);

  return (
    <>
      <div className="page-background" aria-hidden="true" />
      <header className="site-header" ref={header}>
        <nav className="top-links" aria-label="Разделы сайта">
          <a href="/ru/person">Частным клиентам</a><a href="/ru/svoedelo/start">Самозанятым</a><a href="/ru/s_m_business?segment=you">Малому бизнесу и ИП</a>
          <div className="more-wrap"><button onClick={() => toggle("more")} aria-expanded={panel === "more"} aria-controls="more-links-popup">Еще <span className="small-chevron" aria-hidden="true" /></button>
            {panel === "more" && <div id="more-links-popup" className="header-popup more-popup">{data.moreLinks.map(link => <a href={link.href} key={link.href}>{link.text}</a>)}</div>}
          </div>
        </nav>
        <nav className="navigation-bar" aria-label="Основная навигация">
          <a href="/ru/person" aria-label="На главную" className="brand"><img src="/1778653460576.svg" width="121" height="48" alt="Логотип" fetchPriority="high" /></a>
          <button className="menu-button" onClick={() => toggle("menu")} aria-expanded={panel === "menu"} aria-controls="main-menu" aria-label="Открыть главное меню"><svg width="14" height="11" viewBox="0 0 13.333 10.833" aria-hidden="true"><path d="M12.083 0H1.25a1.25 1.25 0 1 0 0 2.5h10.833a1.25 1.25 0 0 0 0-2.5ZM1.25 4.167h10.833a1.25 1.25 0 1 1 0 2.5H1.25a1.25 1.25 0 1 1 0-2.5Zm0 4.166h10.833a1.25 1.25 0 1 1 0 2.5H1.25a1.25 1.25 0 1 1 0-2.5Z" fill="currentColor" /></svg><span>Меню</span></button>
          <div className="segment-tabs" aria-label="Клиенты">{segments.map(([text, href], i) => <a key={href} href={href} className={i === 0 ? "selected" : undefined} aria-current={i === 0 ? "page" : undefined}>{text}</a>)}</div>
          <button className="search-button" onClick={() => toggle("search")} aria-label="Поиск по сайту" aria-expanded={panel === "search"} aria-controls="header-search"><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M17.93 15.8 14.1 11.97a6.73 6.73 0 1 0-1.86 1.95l3.79 3.79a1.34 1.34 0 0 0 1.9-1.91ZM8.4 12.95a4.55 4.55 0 1 1 0-9.1 4.55 4.55 0 0 1 0 9.1Z" fill="currentColor" /></svg></button>
          <div className="online-button"><a href="/ru/person/dist_services/inner_sbol" aria-label="Перейти в СберБанк Онлайн">СберБанк Онлайн</a><button onClick={() => toggle("apps")} aria-expanded={panel === "apps"} aria-controls="sbol-products-menu" aria-label="Открыть меню продуктов СберБанка"><span className="down-chevron" aria-hidden="true" /></button>
            {panel === "apps" && <div id="sbol-products-menu" className="header-popup apps-popup"><strong>Установите на телефон</strong><a href="/ru/person/dist_services/sberbank-online">СберБанк Онлайн</a><a href="/ru/person/bank_cards/debit/sberkarta_kids/sberkids">СберKids</a><a href="/ru/person/investments/sberinvesticii">СберИнвестиции</a></div>}
          </div>
        </nav>
        {panel === "menu" && <nav id="main-menu" className="header-popup main-menu" aria-label="Основное меню">{renderMenu(data.menu)}</nav>}
        {panel === "search" && <div id="header-search" className="header-popup search-popup" role="search"><input name="query" type="search" placeholder="Поиск с ГигаЧатом" aria-label="Поисковый запрос" autoFocus /></div>}
      </header>
      <main>
        <a className="certificate-alert" href="/ru/certificates"><svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true"><path d="M2.33093 13.9994C2.33093 7.55942 7.55762 2.33276 13.9976 2.33276C20.4376 2.33276 25.6643 7.55942 25.6643 13.9994C25.6643 20.4394 20.4376 25.6661 13.9976 25.6661C7.55762 25.6661 2.33093 20.4394 2.33093 13.9994ZM15.1643 9.99991C15.1643 10.2761 14.9404 10.4999 14.6643 10.4999L13.3309 10.4999C13.0548 10.4999 12.8309 10.2761 12.8309 9.99991L12.8309 8.6666C12.8309 8.39044 13.0548 8.1666 13.3309 8.1666L14.6643 8.1666C14.9404 8.1666 15.1643 8.39044 15.1643 8.6666L15.1643 9.99991ZM13.9976 19.8333C13.356 19.8333 12.8309 19.3083 12.8309 18.6666L12.8309 13.9999C12.8309 13.3582 13.356 12.8333 13.9976 12.8333C14.6393 12.8333 15.1643 13.3582 15.1643 13.9999L15.1643 18.6666C15.1643 19.3083 14.6393 19.8333 13.9976 19.8333Z" fill="#24b23e" fillRule="evenodd" /></svg><span>Установите российские сертификаты, чтобы не терять доступ к сайту</span><span className="alert-chevron" aria-hidden="true">›</span></a>
        <section className="hero" aria-labelledby="hero-title">
          <h1 id="hero-title">{data.teaser.desktop.header}</h1>
          <div className="hero-cards">
            <a className="hero-offer" href={data.teaser.desktop.link.href} target="_blank" rel="noreferrer" style={{ background: data.teaser.desktop.background }}><div className="hero-offer-heading" style={{ background: data.teaser.desktop.link.background }}><span>{data.teaser.desktop.link.header}</span></div><span className="hero-offer-link">{data.teaser.desktop.link.label}<span aria-hidden="true">›</span></span></a>
            <div className="hero-image"><img src={data.teaser.desktop.image} alt="Превью изображение для видео" width="728" height="728" fetchPriority="high" /></div>
          </div>
          <div className="stories" aria-label="Истории Сбера">{data.stories.map((card, index) => <div className="story-preview" key={card.text}><button onClick={() => { setSlideIndex(0); setStory(index); }} aria-haspopup="dialog" aria-controls="stories-pop" aria-expanded={story === index} aria-label={`Открыть историю: ${card.text}`}><img src={card.imgUrl} alt="" width="96" height="96" /></button><div className="story-title">{card.text}</div></div>)}</div>
        </section>
      </main>
      <dialog id="stories-pop" className="story-dialog" ref={dialog} onCancel={() => setStory(null)} onClick={event => { if (event.target === event.currentTarget) setStory(null); }} onKeyDown={event => { if (event.key === "ArrowRight") advanceStory(1); if (event.key === "ArrowLeft") advanceStory(-1); }}>
        {slide && <article className={`story-slide ${slide.isLightTheme ? "story-light" : ""}`}><img className="story-image" src={slide.imgUrl} alt="" /><div className="story-progress">{slides.map((_, i) => <button key={i} className={i <= slideIndex ? "active" : ""} onClick={() => setSlideIndex(i)} aria-label={`История ${i + 1}`} />)}</div><div className="story-service"><img src={slide.serviceLogoUrl} alt="" width="28" height="28" />{slide.serviceName}</div><button className="story-close" onClick={() => setStory(null)} aria-label="Закрыть историю" autoFocus>×</button><div className="story-text"><h2>{slide.heading}</h2><p>{slide.description}</p></div>{slide.reachBtn && <a className="story-cta" href={slide.reachBtn.linkUrl} target={slide.reachBtn.isNewTab ? "_blank" : undefined} rel="noreferrer">{slide.reachBtn.text}</a>}<button className="story-previous" onClick={() => advanceStory(-1)} aria-label="Предыдущая история">‹</button><button className="story-next" onClick={() => advanceStory(1)} aria-label="Следующая история">›</button></article>}
      </dialog>
    </>
  );
}

"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import data from "./home-data.json";
import "./home.css";
import "./quick-actions.css";

import "./trust-reference.css";
import "./trust.css";
import "./questions-reference.css";
import "./feedback-reference.css";
import "./questions.css";
import "./footer-links.css";
import "./footer-dark-reference.css";
import "./footer-dark.css";
type MenuItem = { text: string; href: string; children: MenuItem[] };
type TrustSwiper = { destroy: (deleteInstance?: boolean, cleanStyles?: boolean) => void };
type TrustSwiperConstructor = new (element: HTMLElement, options: Record<string, unknown>) => TrustSwiper;
type Slide = { heading: string; description: string; imgUrl: string; serviceLogoUrl: string; serviceName: string; skipSlideDuration: number; isLightTheme?: boolean; reachBtn?: { text: string; linkUrl: string; isNewTab: boolean } };
const segments = [["Для всех", "/ru/person"], ["Для молодёжи", "/ru/person_young"], ["Для семьи", "/ru/person_family"], ["Пенсионерам", "/ru/person_pens"], ["Премиум", "/ru/person/premium"]];

export default function Home() {
  const [panel, setPanel] = useState<string | null>(null);
  const [story, setStory] = useState<number | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [mobileStory, setMobileStory] = useState(false);
  const [question, setQuestion] = useState("");
  const [rating, setRating] = useState<string | null>(null);
  const [ratingHover, setRatingHover] = useState<string | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const searchLink = (text: string) => `/ru/search?searchid=2315434&text=${encodeURIComponent(text)}`;
  const dialog = useRef<HTMLDialogElement>(null);
  const header = useRef<HTMLElement>(null);
  const slides: Slide[] = story === null ? [] : story === data.stories.length ? (mobileStory ? data.novelties.blocks[4].stories?.mobile : data.novelties.blocks[4].stories?.desktop) ?? [] : data.stories[story].stories;
  const trustDesktop = useRef<HTMLDivElement>(null);
  const trustSlider = useRef<HTMLDivElement>(null);
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
  useEffect(() => {
    const element = trustDesktop.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { element.classList.add("visible"); observer.disconnect(); }
    }, { threshold: .3 });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let active = true;
    let slider: TrustSwiper | undefined;
    const initialize = () => {
      const element = trustSlider.current;
      const Swiper = (window as Window & { Swiper?: TrustSwiperConstructor }).Swiper;
      if (!active || !element || !Swiper) return;
      slider = new Swiper(element, {
        slidesPerView: "auto", spaceBetween: 16,
        breakpoints: { 768: { spaceBetween: 24 } },
        pagination: { el: element.querySelector(".swiper-pagination"), clickable: true },
        a11y: { containerMessage: "Карточки о Сбере", slideLabelMessage: "Карточка {{index}} из {{slidesLength}}", paginationBulletMessage: "Перейти к карточке {{index}}", firstSlideMessage: "Первая карточка", lastSlideMessage: "Последняя карточка", prevSlideMessage: "Предыдущая карточка", nextSlideMessage: "Следующая карточка" },
      });
    };
    let script = document.getElementById("trust-swiper-runtime") as HTMLScriptElement | null;
    const loaded = Boolean((window as Window & { Swiper?: TrustSwiperConstructor }).Swiper);
    if (!script && !loaded) {
      script = document.createElement("script");
      script.id = "trust-swiper-runtime";
      script.src = "/vendor/swiper/swiper-bundle.min.js";
      script.async = true;
      script.addEventListener("load", initialize);
      document.head.append(script);
    } else if (loaded) initialize();
    else script?.addEventListener("load", initialize);
    return () => { active = false; script?.removeEventListener("load", initialize); slider?.destroy(true, true); };
  }, []);
  const advanceStory = (direction: number) => {
    if (story === null) return;
    if (slideIndex + direction >= 0 && slideIndex + direction < slides.length) setSlideIndex(slideIndex + direction);
    else if (story !== data.stories.length && story + direction >= 0 && story + direction < data.stories.length) { setStory(story + direction); setSlideIndex(direction > 0 ? 0 : data.stories[story - 1].stories.length - 1); }
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
        <section id="novelties" className="novelties" aria-labelledby="novelties-title">
          <h2 id="novelties-title" className="novelties-heading"><span className="novelties-heading-desktop">{data.novelties.header}</span><span className="novelties-heading-mobile">{data.novelties.headerMobile}</span></h2>
          <ul className="novelties-list">{data.novelties.blocks.map((card, index) => {
            const content = <>{index === 0 ? <div className="novelty-background" style={{ backgroundImage: `url(${card.image})` }} /> : <img className="novelty-image" src={card.image} alt="" loading="lazy" decoding="async" />}<div className="novelty-description-block"><h2 className="novelty-description">{card.description}</h2><span className="novelty-arrow" aria-hidden="true"><svg width="5.208374" height="8.912109" viewBox="0 0 5.208374 8.912109"><path d="M0 1.33L0 1C0 0.09 1.11 -0.35 1.73 0.32L4.94 3.77C5.29 4.15 5.29 4.75 4.94 5.13L1.73 8.59C1.11 9.25 0 8.81 0 7.91L0 7.55C0 7.3 0.09 7.06 0.25 6.88L2.13 4.78C2.3 4.59 2.3 4.31 2.13 4.12L0.25 2C0.09 1.82 0 1.58 0 1.33Z" fill="#262626" fillOpacity=".54902" /></svg></span></div></>;
            return <li key={card.image} className={`novelty${index === 0 ? " novelty-first" : ""}`}>{"stories" in card ? <button type="button" className="novelty-wrapper" onClick={() => { setSlideIndex(0); setMobileStory(window.matchMedia("(max-width: 767px)").matches); setStory(data.stories.length); }} aria-haspopup="dialog" aria-controls="stories-pop" aria-expanded={story === data.stories.length}>{content}</button> : <a className="novelty-wrapper" href={card.link} target="_blank" rel="noopener noreferrer">{content}</a>}</li>;
          })}</ul>
        </section>
        <section id="launcher" className="launcher-section" aria-labelledby="launcher-title">
          <div className="launcher-panel"><div className="launcher-content">
            <h2 id="launcher-title" className="launcher-heading">{data.launcher.title}</h2>
            <div className="launcher-products"><div className="launcher-grid">{data.launcher.cards.map(card => <a className="product-card" href={card.linkUrl} target="_blank" rel="noopener noreferrer" key={card.imageUrl}><div className="product-image"><img src={card.imageUrl} alt="" loading="lazy" decoding="async" /></div><h2 className="product-title">{card.text}</h2></a>)}</div></div>
          </div></div>
        </section>
        <section id="quick-actions" className="quick-actions-section" aria-label="Сервисы Сбера">
          <div className="pl-section"><div className="pl-section__btns-wrap"><div className="pl-section__btns">
            <div className="pl-section__btn">
              <button type="button" className="pl-section__calc" aria-labelledby="quick-calc-label">
                <div className="pl-section__auto-credit"><div className="pl-section__placeholder-title">Автокредит</div></div>
                <div className="pl-section__credit"><div className="pl-section__placeholder-title">Кредит</div></div>
                <div className="pl-section__deposit">
                  <img className="pl-section__deposit-bg" src={data.quickActions.depositPreviewImgUrl} alt="" loading="lazy" />
                  <div>{data.quickActions.calcBtn.depositPreviewRevenueLabel}</div>
                  <div>{data.quickActions.calcBtn.depositPreviewRevenueValue}</div>
                  <div className="pl-section__deposit-result"><div>{data.quickActions.calcBtn.depositPreviewProfitLabel}</div><div>{data.quickActions.calcBtn.depositPreviewProfitValue}</div></div>
                </div>
              </button>
              <div id="quick-calc-label" className="pl-section__label">{data.quickActions.calcBtn.label}</div>
            </div>
            <div className="pl-section__btn">
              <button type="button" className="pl-section__app" aria-labelledby="quick-app-label">
                <img className="pl-section__app-back-bg" src={data.quickActions.sbolBgImgUrl} alt="" loading="lazy" />
                <div className="pl-section__app-front-img"><img src={data.quickActions.sbolBtn.sbolFrontImgUrl} alt="" loading="lazy" /></div>
                {data.quickActions.hoverIcons.map(icon => <span key={icon}><img src={icon} alt="" loading="lazy" /></span>)}
              </button>
              <div id="quick-app-label" className="pl-section__label">{data.quickActions.sbolBtn.label}</div>
            </div>
            <div className="pl-section__btn">
              <a className="pl-section__offices" href={data.quickActions.officeBtn.linkUrl} target={data.quickActions.officeBtn.isNewTab ? "_blank" : undefined} rel="noopener noreferrer" aria-labelledby="quick-offices-label"><img src={data.quickActions.officeBtn.firstImgUrl} alt="" loading="lazy" /><img src={data.quickActions.officeBtn.secondImgUrl} alt="" loading="lazy" /></a>
              <div id="quick-offices-label" className="pl-section__label">{data.quickActions.officeBtn.label}</div>
            </div>
            <div className="pl-section__btn">
              <a className="pl-section__rates" href={data.quickActions.ratesBtn.linkUrl} target={data.quickActions.ratesBtn.isNewTab ? "_blank" : undefined} rel="noopener noreferrer" aria-labelledby="quick-rates-label">
                <div><img className="pl-section__rates-bg" src={data.quickActions.metalBgImgUrl} alt="" loading="lazy" /></div>
                <div style={{ backgroundImage: `url(${data.quickActions.ratesFrontImgUrl})` }}><div className="pl-section__rates-title">Сейчас в офисе</div><div className="pl-section__rates-values"><div>EUR</div><div>{data.quickActions.referenceRates.EUR}</div><div>USD</div><div>{data.quickActions.referenceRates.USD}</div></div></div>
              </a>
              <div id="quick-rates-label" className="pl-section__label">{data.quickActions.ratesBtn.label}</div>
            </div>
          </div></div></div>
        </section>
      <section id="trust" className="trust-section" aria-label="Блок доверия">
        <img className="trust-background" src={data.trustBlock.desktop.backgroundImage} alt="" loading="lazy" aria-hidden="true" />
        <div className="ShortMainPage-TrustBlock ShortMainPage-TrustBlock_segment_all">
          <div className="ShortMainPage-DesktopTrust" ref={trustDesktop}>
            <div className="ShortMainPage-DesktopTrust__centralBlock">
              <h2 className="ShortMainPage-DesktopTrust__heading">{data.trustBlock.desktop.title.split("<br>").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h2>
              <a className="ShortMainPage-DesktopTrust__button" href={data.trustBlock.buttonLink} target="_blank" rel="noopener noreferrer">{data.trustBlock.buttonText}</a>
            </div>
            {data.trustBlock.desktop.blocks.map((card, index) => <div key={card.id} className={`ShortMainPage-DesktopTrust__block ShortMainPage-DesktopTrust__block_number_${index + 1}`}>
              <div className="ShortMainPage-DesktopTrust__content-wrapper"><h3 className="ShortMainPage-DesktopTrust__item-heading">{card.title}</h3><div className="ShortMainPage-DesktopTrust__item-description">{card.description}</div></div>
              <img className={`ShortMainPage-DesktopTrust__img ShortMainPage-DesktopTrust__img_number_${index + 1}`} src={card.image} alt="" loading="lazy" aria-hidden="true" />
            </div>)}
          </div>
          <div className="ShortMainPage-MobileAndTabletTrust">
            <h2 className="ShortMainPage-MobileAndTabletTrust__heading">{data.trustBlock.mobileAndTablet.title}</h2>
            <div className="ShortMainPage-Slider"><div className="swiper" ref={trustSlider}><div className="swiper-wrapper">
              {data.trustBlock.mobileAndTablet.blocks.map(card => <div className="swiper-slide" key={card.id}><div className="ShortMainPage-Card" style={{ backgroundColor: card.backgroundColor }}><img className="ShortMainPage-Card__bg" src={card.backgroundImage} alt="" loading="lazy" aria-hidden="true" /><div className="ShortMainPage-Card__title" style={{ color: card.titleColor }}>{card.title}</div><div className="ShortMainPage-Card__description" style={{ color: card.descriptionColor }}>{card.description}</div></div></div>)}
            </div><div className="swiper-pagination" /></div></div>
            <a className="ShortMainPage-MobileAndTabletTrust__button" href={data.trustBlock.buttonLink} target="_blank" rel="noopener noreferrer">{data.trustBlock.buttonText}</a>
          </div>
        </div>
      </section>
      <section id="questions" className="questions-section" aria-labelledby="questions-title" style={{ "--questions-background-xs": `url(${data.questionsAndAnswers.backgroundImage.backgroundImageXS})`, "--questions-background-md": `url(${data.questionsAndAnswers.backgroundImage.backgroundImageMD})`, "--questions-background-xl": `url(${data.questionsAndAnswers.backgroundImage.backgroundImageXL})`, "--suggestion-color": data.questionsAndAnswers.suggestionColor, "--suggestion-color-hover": data.questionsAndAnswers.suggestionColorHover, "--suggestion-text-color": data.questionsAndAnswers.suggestionTextColor } as React.CSSProperties}>
        <div className="ShortMainPage-QuestionsAndAnswers">
          <div className="ShortMainPage-QuestionsAndAnswers__bg-img" aria-hidden="true" />
          <h2 id="questions-title" className="ShortMainPage-QuestionsAndAnswers__heading">{data.questionsAndAnswers.title.split("<br>").map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</h2>
          <div className="ShortMainPage-QuestionsAndAnswers__searchBlock">
            <div className="dk-sbol-input__wrap"><input className="dk-sbol-input ShortMainPage-QuestionsAndAnswers__input" type="text" placeholder={data.questionsAndAnswers.placeholder} aria-label={data.questionsAndAnswers.placeholder} value={question} onChange={event => setQuestion(event.target.value)} onKeyDown={event => { if (event.key === "Enter") window.location.assign(searchLink(question)); }} /></div>
            <a className="ShortMainPage-QuestionsAndAnswers__iconWrapper" href={searchLink(question)} rel="noreferrer" aria-label="Поиск"><img src="/common/fhouse/main/images/questions/search.svg" width="17.999939" height="17.756836" alt="" /></a>
          </div>
          <div className="ShortMainPage-Suggestions"><ul className="ShortMainPage-Suggestions__list">{data.questionsAndAnswers.suggestions.split("|").filter(Boolean).map(suggestion => <li key={suggestion}><a className="ShortMainPage-Suggestions__suggestion" href={searchLink(suggestion)}><div className="ShortMainPage-Suggestions__text">{suggestion}</div></a></li>)}</ul></div>
        </div>
        <div className="feedback-spacing"><div className="csat-review-form" data-test-id="CSATWidget"><div className="csat-review-form__content">
          <h3 id="form-heading" className="csat-review-form__popup-heading">{data.feedback.formHeading}</h3>
          <div className="csat-review-form__popup-rate-btns" data-test-id="CSATRatesBtns">{data.feedback.rates.map(rate => <div className="csat-rate-button" key={rate.type} onMouseEnter={() => setRatingHover(rate.type)} onMouseLeave={() => setRatingHover(null)}>
            {ratingHover === rate.type && <div className="csat-rate-button__popup-hint">{rate.label}</div>}
            <button type="button" className={`csat-rate-button__popup-rate-btn${rating === rate.type ? " csat-rate-button__popup-rate-btn_active" : rating === null ? " csat-rate-button__popup-rate-btn_idle" : ""}`} data-test-id={`CSATRateButton_${rate.type}`} aria-label={rate.label} aria-pressed={rating === rate.type} aria-controls="form-feedback-panel" onClick={() => setRating(rate.type)}><img src={rate.image} width="160" height="160" alt="" loading="lazy" /></button>
          </div>)}</div>
          {rating !== null && <form id="form-feedback-panel" className="csat-review-form__form" data-test-id="CSATFormFeedback" onSubmit={event => event.preventDefault()}>
            <textarea id="form-feedback" className="csat-review-form__form-textarea" placeholder={data.feedback.formPlaceholder} aria-label={data.feedback.formPlaceholder} aria-describedby="form-feedback-length" maxLength={data.feedback.maxFieldLength} value={feedbackComment} onChange={event => setFeedbackComment(event.target.value.slice(0, data.feedback.maxFieldLength))} />
            <div className="csat-review-form__form-textarea-comp"><div className="csat-review-form__form-textarea-error" /><div id="form-feedback-length" className="csat-review-form__form-textarea-length">{feedbackComment.length} / {data.feedback.maxFieldLength}</div></div>
            <button type="submit" className="csat-review-form__form-btn" disabled>{data.feedback.sendBtnText}</button>
          </form>}
        </div></div></div>
      </section>
      </main>
      <footer className="footer-widget" aria-label="Разделы сайта">
      <div id="footer-links" className="footer-widget-lightFooter">
        <nav className="footer-widget-lightFooter__wrapper" aria-label="Навигация внизу страницы">{data.footerLinks.map(column => <div className={`footer-widget-lightFooter__block footer-widget-lightFooter__block_section_${column.title}`} key={column.title}>
          {column.links.map((link, index) => <a className={`footer-widget-lightFooter__item${link.heading ? " footer-widget-lightFooter__item_type_heading" : ""}`} href={link.href} target={link.target} rel={link.rel} key={link.href + index}><div className="dk-sbol-text dk-sbol-text_size_sm">{link.text}</div></a>)}
        </div>)}</nav>
      </div>
      <div id="dark-footer" className="footer-widget-darkFooter footer-widget-darkFooter_extraMargin">
        <div className="footer-widget-darkFooter__wrapper">
          <div className="footer-widget-darkFooter__firstBlock">
            <nav className="footer-widget-darkFooter__links" aria-label="Информация о Сбере">{data.darkFooter.links.map(link => <a className="footer-widget-darkFooter__link" href={link.href} target={link.target} rel={link.rel} key={link.href}><div className="dk-sbol-text dk-sbol-text_size_sm">{link.text}</div></a>)}</nav>
            <div className="footer-widget-darkFooter__info">
              <div className="dk-sbol-text dk-sbol-text_size_sm footer-widget-darkFooter__info-item footer-widget-darkFooter__info-item_address">{data.darkFooter.address.map((line, index) => <span key={line}>{index > 0 && <br />}{line}</span>)}</div>
              {data.darkFooter.legal.map(link => <a className="footer-widget-darkFooter__info-item" href={link.href} target={link.target} rel={link.rel} key={link.href}><div className="dk-sbol-text dk-sbol-text_size_sm">{link.text}</div></a>)}
            </div>
          </div>
          <div className="footer-widget-darkFooter__secondBlock">
            <div className="footer-widget-phones">{data.darkFooter.phones.map(phone => <div key={phone.href}>
              <a className="dk-sbol-link dk-sbol-link_size_md dk-sbol-link_type_primary dk-sbol-link_chevron footer-widget-phones__phone" href={phone.href} aria-label={phone.ariaLabel}><span className="dk-sbol-link__text dk-sbol-link__text_size_md dk-sbol-link__text_iconPosition_right">{phone.text}</span></a>
              <div className="dk-sbol-text dk-sbol-text_size_md footer-widget-phones__description">{phone.description}</div>
            </div>)}</div>
            <div className="footer-widget-apps__apps">{data.darkFooter.apps.map(app => <a className="footer-widget-apps__app" href={app.href} target={app.target} rel={app.rel} key={app.href}>
              <img className="footer-widget-apps__icon" src={app.image} alt="" aria-hidden="true" />
              <div className="dk-sbol-text dk-sbol-text_size_sm footer-widget-apps__title">{app.title}</div>
              <div className="dk-sbol-text dk-sbol-text_size_sm footer-widget-apps__subtitle">{app.subtitle}</div>
            </a>)}</div>
            <div className="footer-widget-darkFooter__social-lang">
              <ul className="footer-widget-social" aria-label="Сбербанк в социальных сетях">{data.darkFooter.social.map(social => <li className="footer-widget-social__item" key={social.href}><a className="footer-widget-social__link" style={{ backgroundImage: `url(${social.image})` }} href={social.href} aria-label={social.ariaLabel} /></li>)}</ul>
              <div className="footer-widget-darkFooter__engversion"><a className="footer-widget-darkFooter__englink" href={data.darkFooter.english.href} target={data.darkFooter.english.target} rel={data.darkFooter.english.rel}>
                <img className="footer-widget-darkFooter__icon" src={data.darkFooter.english.image} alt="" aria-hidden="true" />
                <div className="dk-sbol-text dk-sbol-text_size_sm footer-widget-darkFooter__englink-text">{data.darkFooter.english.text}</div>
              </a></div>
            </div>
          </div>
        </div>
      </div>
      </footer>
      <dialog id="stories-pop" className="story-dialog" ref={dialog} onCancel={() => setStory(null)} onClick={event => { if (event.target === event.currentTarget) setStory(null); }} onKeyDown={event => { if (event.key === "ArrowRight") advanceStory(1); if (event.key === "ArrowLeft") advanceStory(-1); }}>
        {slide && <article className={`story-slide ${slide.isLightTheme ? "story-light" : ""}`}><img className="story-image" src={slide.imgUrl} alt="" /><div className="story-progress">{slides.map((_, i) => <button key={i} className={i <= slideIndex ? "active" : ""} onClick={() => setSlideIndex(i)} aria-label={`История ${i + 1}`} />)}</div><div className="story-service"><img src={slide.serviceLogoUrl} alt="" width="28" height="28" />{slide.serviceName}</div><button className="story-close" onClick={() => setStory(null)} aria-label="Закрыть историю" autoFocus>×</button><div className="story-text"><h2>{slide.heading}</h2><p>{slide.description}</p></div>{slide.reachBtn && <a className="story-cta" href={slide.reachBtn.linkUrl} target={slide.reachBtn.isNewTab ? "_blank" : undefined} rel="noreferrer">{slide.reachBtn.text}</a>}<button className="story-previous" onClick={() => advanceStory(-1)} aria-label="Предыдущая история">‹</button><button className="story-next" onClick={() => advanceStory(1)} aria-label="Следующая история">›</button></article>}
      </dialog>
    </>
  );
}

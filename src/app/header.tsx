"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import source from "./header-data.json";
import regions from "./header-regions.json";
import { productDestination, searchProducts } from "./header-search";
import "./header-reference.css";
import "./header.css";

type MenuLink = { text: string; link: string; showItemPromoIcon?: boolean; promoText?: string; promoColor?: string };
type MenuSection = { title: string; titleGroup: string; link?: string; items?: MenuLink[]; subsections?: { title: string; reflectTitle?: boolean; items: MenuLink[] }[]; showButton?: boolean; buttonText?: string; buttonLink?: string; buttonColor?: string; showPromoIcon?: boolean; promoText?: string; promoColor?: string };
const sections: MenuSection[] = source.secondLevelMenus;
const groups = [...new Set(sections.map(section => section.titleGroup))];
type Popup = "more" | "apps" | "search" | "segments" | "regions" | "audience" | null;
const text = (value: string) => value.replace(/&nbsp;/g, "\u00a0").replace(/&amp;/g, "&");
const searchHref = (value: string) => `${source.searchPageUrl}?searchid=2315434&l10n=ru&reqenc=&text=${encodeURIComponent(value)}`;
const searchIcons = ["Karty.svg", "сredit_icon.svg", "Prilozhenie.svg"];
const subscribeScroll = (listener: () => void) => { window.addEventListener("scroll", listener, { passive: true }); return () => window.removeEventListener("scroll", listener); };
const scrollSnapshot = () => window.scrollY > 100;
const serverScrollSnapshot = () => false;
const subscribeDesktop = (listener: () => void) => { const media = window.matchMedia("(min-width: 1366px)"); media.addEventListener("change", listener); return () => media.removeEventListener("change", listener); };
const desktopSnapshot = () => window.matchMedia("(min-width: 1366px)").matches;

function Arrow({ small = false }: { small?: boolean }) {
  if (small) return <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M9.67 6.78C9.83 6.64 10.04 6.56 10.26 6.56C11.07 6.56 11.46 7.55 10.87 8.1L8.41 10.38C8.03 10.74 7.43 10.74 7.05 10.38L4.61 8.11C4.01 7.56 4.4 6.56 5.22 6.56C5.44 6.56 5.65 6.64 5.82 6.78L7.4 8.2C7.59 8.37 7.87 8.38 8.06 8.21L9.67 6.78Z" fill="currentColor" /></svg>;
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M12.78 8.2h.34c.91 0 1.35 1.11.68 1.73l-3.46 3.21a1 1 0 0 1-1.35 0L5.53 9.93c-.67-.62-.23-1.73.68-1.73h.36c.25 0 .49.09.67.25L9 10.03c.38.34.95.34 1.33.01l1.79-1.59c.18-.16.42-.25.66-.25Z" fill="currentColor" /></svg>;
}
function Cross() {
  return <svg width="11.172" height="11.172" viewBox="0 0 11.172 11.172" fill="none" aria-hidden="true"><path d="m.29 9.23 3.65-3.65L.29 1.93a.996.996 0 0 1 0-1.41L.52.29a.996.996 0 0 1 1.41 0l3.65 3.65L9.23.29a.996.996 0 0 1 1.41 0l.23.23c.39.39.39 1.02 0 1.41L7.23 5.58l3.64 3.65c.39.39.39 1.02 0 1.41l-.23.23a.996.996 0 0 1-1.41 0L5.58 7.22l-3.65 3.65a.996.996 0 0 1-1.41 0l-.23-.23a.996.996 0 0 1 0-1.41Z" fill="currentColor" /></svg>;
}
function SearchIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M17.93 15.8 14.1 11.97a6.73 6.73 0 1 0-1.86 1.95l3.79 3.79a1.34 1.34 0 0 0 1.9-1.91ZM8.4 12.95a4.55 4.55 0 1 1 0-9.1 4.55 4.55 0 0 1 0 9.1Z" fill="currentColor" /></svg>;
}
function RegionIcon() {
  return <svg width="9.599609" height="9.603516" viewBox="0 0 9.59961 9.60352" aria-hidden="true"><path d="M9.57 0.47L6.15 9.38C6.13 9.44 6.08 9.5 6.03 9.54C5.97 9.58 5.9 9.6 5.83 9.6L5.81 9.6C5.74 9.59 5.67 9.57 5.61 9.52C5.56 9.47 5.52 9.41 5.5 9.33C4.9 6.73 2.86 4.7 0.26 4.1C0.19 4.08 0.12 4.04 0.08 3.99C0.03 3.93 0 3.86 0 3.79C-0.01 3.72 0.01 3.65 0.05 3.58C0.09 3.52 0.14 3.48 0.21 3.45L9.12 0.02C9.19 0 9.25 -0.01 9.32 0C9.39 0.02 9.45 0.05 9.5 0.1C9.54 0.14 9.58 0.2 9.59 0.27C9.6 0.33 9.59 0.4 9.57 0.47Z" fill="currentColor" /></svg>;
}

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [popup, setPopup] = useState<Popup>(null);
  const [activeSection, setActiveSection] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [regionQuery, setRegionQuery] = useState("");
  const [region, setRegion] = useState("Москва");
  const root = useRef<HTMLElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const previouslyOpen = useRef(false);
  const scrolled = useSyncExternalStore(subscribeScroll, scrollSnapshot, serverScrollSnapshot);
  const desktop = useSyncExternalStore(subscribeDesktop, desktopSnapshot, serverScrollSnapshot);
  const searchResults = query.trim()
    ? searchProducts(query).map(product => ({ text: product.product, href: productDestination(product.product, searchHref(product.product)), icon: product.icon }))
    : source.searchHints.map(hint => ({ text: hint.text, href: productDestination(hint.text, searchHref(hint.text)), icon: `/common/img/uploaded/files/gigasearch/${searchIcons[hint.position - 1]}` }));
  const selected = activeSection === null ? null : sections[activeSection];
  const modal = popup === "regions" || popup === "segments";

  const openPopup = (name: Popup) => {
    trigger.current = document.activeElement as HTMLElement;
    setPopup(current => current === name ? null : name);
    if (name === "search" && popup !== "search") setQuery("");
    if (name === "regions") { setRegionQuery(""); setMenuOpen(false); }
  };
  const closePopup = () => { setPopup(null); setQuery(""); if (trigger.current?.isConnected) trigger.current.focus(); else menuTrigger.current?.focus(); };
  const closeMenu = () => { setPopup(null); setQuery(""); setMenuOpen(false); menuTrigger.current?.focus(); };

  useEffect(() => {
    if (!menuOpen && !modal && popup !== "search") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [menuOpen, modal, popup]);

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (popup) { setPopup(null); setQuery(""); if (trigger.current?.isConnected) trigger.current.focus(); else menuTrigger.current?.focus(); }
        else if (menuOpen) { setMenuOpen(false); menuTrigger.current?.focus(); }
      }
      const scope = modal ? overlay.current : menuOpen ? menu.current : popup ? root.current?.querySelector<HTMLElement>("[data-header-popup]") : null;
      if (!scope) return;
      const controls = Array.from(scope.querySelectorAll<HTMLElement>('a[href], button, input, [tabindex="0"]')).filter(element => element.getClientRects().length && !element.hasAttribute("disabled"));
      const current = controls.indexOf(document.activeElement as HTMLElement);
      if (event.key === "Tab" && controls.length && (event.shiftKey ? current <= 0 : current === controls.length - 1)) {
        event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0].focus();
      }
      if ((popup === "more" || popup === "apps" || popup === "audience") && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault(); controls[(current + (event.key === "ArrowDown" ? 1 : -1) + controls.length) % controls.length]?.focus();
      }
    };
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setPopup(null); setMenuOpen(false); }
      else if (!modal && popup && !(event.target as HTMLElement).closest("[data-header-control]")) setPopup(null);
    };
    document.addEventListener("keydown", keydown);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", keydown); document.removeEventListener("pointerdown", outside); };
  }, [popup, menuOpen, modal]);

  useEffect(() => {
    if (popup) Array.from(root.current?.querySelectorAll<HTMLElement>('[data-header-popup] input, [data-header-popup] a, [data-header-popup] button') ?? []).find(element => element.getClientRects().length)?.focus();
    else if (menuOpen) menu.current?.querySelector<HTMLElement>("a, button")?.focus();
    else if (previouslyOpen.current) menuTrigger.current?.focus();
    previouslyOpen.current = menuOpen;
  }, [popup, menuOpen]);

  const more = (inMenu = false) => <div className={`header-widget-link-more${inMenu ? " header-widget-link-more_isOpenMenu" : ""}`} data-header-control>
    <button className={`header-widget-link-more__text-container${popup === "more" ? " header-widget-link-more__text-container_popup-open" : ""}`} aria-label="Открыть дополнительные ссылки" aria-expanded={popup === "more"} aria-controls="header-more-links" onClick={() => openPopup("more")}>
      <span className={`header-widget-link-more__text${inMenu ? " header-widget-link-more__text_menu-open" : ""}`}>Еще</span><span className={`header-widget-link-more__image${inMenu ? " header-widget-link-more__image_menu-open" : ""}${popup === "more" ? " header-widget-link-more__image_popup-open" : ""}`}><Arrow /></span>
    </button>
    {popup === "more" && <nav id="header-more-links" data-header-popup className="header-widget-popup-small header-widget-popup-small_visible" aria-label="Дополнительные разделы" style={{ top: inMenu ? 25 : 30, left: inMenu ? -14 : 0, paddingRight: 64 }}>{source.topMenuItems.slice(3).map(link => <a className="header-widget-link-more__nav-link" href={link.link} target="_self" rel="noopener noreferrer" key={link.position}>{link.text}</a>)}</nav>}
  </div>;

  const online = () => <div className={`header-widget-sbol-button${menuOpen ? " header-widget-sbol-button_menu-open" : ""} header-widget-sbol-button_segments`} style={{ background: source.appButtonColor }} data-header-control>
    <a href={source.appButtonUrl} target="_blank" rel="noopener noreferrer" className={`header-widget-sbol-button__main${menuOpen ? " header-widget-sbol-button__main_menu-open" : ""}`} aria-label="Перейти в СберБанк Онлайн"><span className="header-widget-sbol-button__text">{source.appButtonTitle}</span></a>
    <button className={`header-widget-sbol-button__arrow-container${popup === "apps" ? " header-widget-sbol-button__arrow-container_popup-visible" : ""}`} aria-label="Открыть меню продуктов СберБанка" aria-controls="header-apps" aria-expanded={popup === "apps"} onClick={() => openPopup("apps")}><span className={`header-widget-sbol-button__arrow${popup === "apps" ? " header-widget-sbol-button__arrow_popup-open" : ""}`}><Arrow /></span></button>
    {popup === "apps" && <section id="header-apps" data-header-popup className="header-widget-popup-small header-widget-popup-small_visible header-apps-popup" aria-label={source.appDropdownTitle}><div className="header-widget-sbol-button__title">{source.appDropdownTitle}</div><div className="header-widget-sbol-button__links-container">{source.appItems.map(item => <a className="header-widget-sbol-button__link-container" href={item.link} key={item.position}><span className="header-widget-sbol-button__icon" style={{ backgroundImage: `url("${item.iconUrl}")` }} aria-hidden="true" /><span className="header-widget-sbol-button__link">{item.text}</span></a>)}</div></section>}
  </div>;

  const search = () => <section className={`header-widget-search-section header-widget-search-section_isSegments${menuOpen ? " header-widget-search-section_isOpenMenu" : ""}${popup === "search" ? " header-widget-search-section_isFocus" : ""}`} aria-label="Поиск по сайту" data-header-control>
    <form role="search" action={source.searchPageUrl} target="_blank" onSubmit={event => { if (!query.trim()) event.preventDefault(); }} className={`header-widget-search-section__wrapper${popup === "search" ? ` header-widget-search-section__wrapper_isFocus${menuOpen ? " header-widget-search-section__wrapper_isFocus_isOpenMenu" : ""}` : ""}`} data-header-popup={popup === "search" ? "" : undefined}>
      <input type="hidden" name="searchid" value="2315434" /><input type="hidden" name="l10n" value="ru" /><input type="hidden" name="reqenc" value="" />
      <div className={`header-widget-search-section__container header-widget-search-section__container_isSegments${menuOpen ? " header-widget-search-section__container_isOpenMenu" : ""}${popup === "search" ? " header-widget-search-section__container_isFocus" : ""}`}>
        <input name="text" type="text" role="combobox" aria-autocomplete="list" className={`header-widget-search-section__input header-widget-search-section__input_isSegments${menuOpen ? " header-widget-search-section__input_isOpenMenu" : ""}${popup === "search" ? " header-widget-search-section__input_isFocus" : ""}`} placeholder={menuOpen && !desktop && popup !== "search" ? "Поиск" : source.searchPlaceholder} aria-label="Поисковый запрос" value={query} onChange={event => setQuery(event.target.value)} onFocus={() => { if (popup !== "search") openPopup("search"); }} aria-expanded={popup === "search"} aria-controls="header-search-hints" />
        <button type={popup === "search" || menuOpen ? "submit" : "button"} onClick={() => { if (!menuOpen && popup !== "search") openPopup("search"); }} className={`header-widget-search-section__icon header-widget-search-section__icon_isSegments${menuOpen ? " header-widget-search-section__icon_isOpenMenu" : ""}${popup === "search" ? " header-widget-search-section__icon_isFocus" : ""}`} aria-label={popup === "search" || menuOpen ? "Выполнить поиск" : "Поиск по сайту"}><SearchIcon /></button>
      </div>
      {popup === "search" && searchResults.length > 0 && <div id="header-search-hints" className="search-hints-popup"><div className="search-hints-popup__section"><p className="search-hints-popup__section-title">Продукты</p><ul className="search-hints-popup__product-list">{searchResults.map(result => <li key={result.text}><a className="search-hints-popup__product-item" href={result.href} target="_blank" rel="noopener noreferrer" onClick={() => setQuery(result.text)}><img className="search-hints-popup__product-icon" src={result.icon} alt="" /><span className="search-hints-popup__product-text">{result.text}</span></a></li>)}</ul></div></div>}
    </form>
  </section>;

  const links = (items: MenuLink[], useful = false) => <ul className="header-widget-links-list__links-list-container header-widget-links-list__links-list-container_isSecondLvl" style={{ gridTemplateRows: `repeat(${useful ? Math.min(items.length, 5) : items.length}, auto)` }}>{items.map(item => <li className="header-widget-links-list__list-link-container" key={item.link + item.text}><a className="header-widget-links-list__list-link" data-widget="header-link" href={item.link} target="_self" rel="noopener noreferrer"><span>{text(item.text)}</span>{item.showItemPromoIcon && item.promoText && <span className="header-widget-links-list__tooltip" style={{ background: item.promoColor }}><span className="header-widget-links-list__tooltip-text">{item.promoText}</span></span>}</a></li>)}</ul>;
  const lowered = regionQuery.toLocaleLowerCase("ru").trim();
  const keyboardFrom = "qwertyuiop[]asdfghjkl;'zxcvbnm,.";
  const keyboardTo = "йцукенгшщзхъфывапролджэячсмитьбю";
  const converted = [...lowered].map(letter => keyboardFrom.includes(letter) ? keyboardTo[keyboardFrom.indexOf(letter)] : letter).join("");
  const filteredRegions = regions.filter(name => !lowered || name.toLocaleLowerCase("ru").includes(lowered) || name.toLocaleLowerCase("ru").includes(converted));

  return <header ref={root} className={`header-widget header-demo${scrolled ? " header-demo_scrolled" : ""}`}>
    {(menuOpen || popup === "search") && <div className="header-widget__blur-container" onClick={() => { setPopup(null); if (popup !== "search") closeMenu(); }} aria-hidden="true" />}
    <div className={`header-widget__main-container${menuOpen ? " header-widget__main-container_isOpenMenu" : ""}`}>
      {!menuOpen ? <div className="header-widget__closed-menu-container header-widget__closed-menu-container_segmentationEnabled">
        <nav className="header-widget-top-menu" aria-label="Разделы сайта">{source.topMenuItems.slice(0, 3).map(link => <a className="header-widget-top-menu__link" href={link.link} key={link.position}>{link.text}</a>)}{more()}</nav>
        <nav className="header-widget-navigation-bar header-widget-navigation-bar_segments" aria-label="Основная навигация">
          <a className="header-widget__image-container header-widget__image-container_isWideLogo" href={source.logoLink} aria-label="Логотип, переход на главную страницу"><img className="header-widget__logo-image" src={source.logoImageUrl} alt="Логотип" /></a>
          <button ref={menuTrigger} className="header-widget-menu-button" aria-label="Открыть главное меню" aria-expanded={false} aria-controls="header-main-menu" onClick={() => { setPopup(null); setMenuOpen(true); }}><span className="header-widget-menu-button__icon"><svg width="14" height="11" viewBox="0 0 13.333 10.833" aria-hidden="true"><path d="M12.083 0H1.25a1.25 1.25 0 1 0 0 2.5h10.833a1.25 1.25 0 0 0 0-2.5ZM1.25 4.167h10.833a1.25 1.25 0 1 1 0 2.5H1.25a1.25 1.25 0 1 1 0-2.5Zm0 4.166h10.833a1.25 1.25 0 1 1 0 2.5H1.25a1.25 1.25 0 1 1 0-2.5Z" fill="currentColor" /></svg></span><span className="header-widget-menu-button__text">Меню</span></button>
          <div className="header-widget__tabs-wrapper"><div className="header-widget-slider-tabs header-widget-slider-tabs_size_md header-widget-slider-tabs_type_nav" style={{ background: source.backgroundColor }}>{source.segments.map(segment => <a className={`header-widget-slider-tabs__tab header-widget-slider-tabs__tab_type_nav header-widget-slider-tabs__tab_size_md${segment.currentSegment ? " header-widget-slider-tabs__tab_active" : ""}`} href={segment.url} aria-current={segment.currentSegment ? "page" : undefined} key={segment.position}>{segment.segmentText}</a>)}</div><div className="header-widget-segments-dropdown header-widget-segments-dropdown_objectModelEnabled" data-header-control><button className="header-widget-segments-dropdown__dropdown-button" onClick={() => openPopup("segments")} aria-label={source.segmentsTitle} aria-expanded={popup === "segments"}><span className="header-widget-segments-dropdown__text-logo-container"><span className="header-widget-segments-dropdown__selected-text">Для всех</span></span><span className="header-widget-segments-dropdown__dropdown-arrow"><Arrow small /></span></button></div></div>
          {search()}{online()}
        </nav>
      </div> : <div ref={menu} id="header-main-menu" className="header-widget__open-menu-container header-widget__open-menu-container_isOpenMenu" role="dialog" aria-modal="true" aria-label="Основное меню">
        <section className="header-widget-menu-open"><div className="header-widget-menu-open__header">
          <nav className="header-widget-menu-open-navigation" aria-label="Основная навигация"><div className="header-widget-menu-open-navigation__left"><a href={source.logoLink} className="header-widget-menu-open-navigation__logo header-widget-menu-open-navigation__logo_isWideLogo" aria-label="Логотип, переход на главную страницу" style={{ backgroundImage: `url("${source.logoImageUrl}")` }} />{desktop && <div className="header-widget-menu-open-navigation__links header-open-desktop">{source.topMenuItems.slice(0, 3).map(link => <a className="header-widget-menu-open-navigation__link" href={link.link} key={link.position}>{link.text}</a>)}{more(true)}</div>}</div><div className="header-widget-menu-open-navigation__right">{desktop && <div className="header-widget-menu-open-navigation__search header-open-desktop">{search()}</div>}{online()}<button className="header-widget-menu-open-navigation__close" aria-label="Закрыть меню" onClick={closeMenu}><Cross /></button></div></nav>
          {!desktop && <><div className="header-widget-menu-open-navigation__search-mobile header-open-mobile">{search()}</div><div className="header-widget-menu-open-navigation__links-mobile header-open-mobile" data-header-control><button className="header-widget-menu-open-navigation__link header-audience-button" aria-expanded={popup === "audience"} onClick={() => openPopup("audience")}>Частным клиентам <Arrow /></button>{popup === "audience" && <nav data-header-popup className="header-widget-popup-small header-widget-popup-small_visible header-audience-popup" aria-label="Разделы сайта">{source.topMenuItems.map(link => <a className="header-widget-link-more__nav-link" href={link.link} key={link.position}>{link.text}</a>)}</nav>}</div></>}
        </div><div className="header-widget-menu-open__content"><div className="header-widget-menu-open-content"><nav className="header-widget-links-list" aria-label="Основное меню">
          {selected && <button className="header-widget-links-list__go-back-link-container" onClick={() => setActiveSection(null)}><div className="header-widget-links-list__list-link-icon" aria-hidden="true" /><span className="header-widget-links-list__go-back-link">Назад</span></button>}
          <div key={activeSection ?? "root"} className="header-widget-links-list__animation-container">
            {!selected ? <div className="header-widget-links-list__links-list-container" role="menu" aria-label="Основные разделы">{groups.map(group => <div className="header-widget-links-list__main-menu-group" key={group}><div className="header-widget-links-list__main-menu-title" aria-hidden="true">{group}</div>{sections.map((section, index) => section.titleGroup !== group ? null : <div className="header-widget-links-list__list-link-container" role="none" key={section.title}>{section.items ? <button className="header-widget-links-list__list-link" data-widget="header-link" role="menuitem" aria-haspopup="true" aria-expanded={false} onClick={() => setActiveSection(index)}><span>{text(section.title)}</span></button> : <a className="header-widget-links-list__list-link" data-widget="header-link" role="menuitem" href={section.link} target="_self" rel="noopener noreferrer"><span>{text(section.title)}</span></a>}</div>)}</div>)}</div> : <div className="header-widget-links-list__content-container header-widget-links-list__content-container_isTwoCols header-widget-links-list__content-container_isSecondLvl"><div className="header-widget-links-list__main-links-container"><div className="header-widget-links-list__main-menu-title">{text(selected.title)}</div>{links(selected.items ?? [])}{selected.showButton && <a className="header-widget-links-list__reach-button" href={selected.buttonLink} target="_blank" rel="noopener noreferrer" style={{ background: selected.buttonColor }}>{selected.buttonText}</a>}</div>{selected.subsections?.map((subsection, index) => <div className="header-widget-links-list__useful-container" key={index}>{subsection.reflectTitle && <div className="header-widget-links-list__useful-title">{text(subsection.title)}</div>}{links(subsection.items, true)}</div>)}</div>}
          </div>
        </nav><div className="header-widget-menu-open-content__footer"><section className="header-widget-menu-open-content-footer"><div className="header-widget-menu-open-content-footer__content-container"><button className="header-widget-menu-open-content-footer__footer-icon-text-container" aria-label={`Выбрать регион, текущий регион: ${region}`} onClick={() => openPopup("regions")}><span className="header-widget-menu-open-content-footer__footer-arrow header-region-arrow" aria-hidden="true"><RegionIcon /></span><span className="header-widget-menu-open-content-footer__footer-text">{region}</span></button><a href={source.otherLanguageLink} aria-label={`Переключить язык на ${source.otherLanguageTitle}`}><span className="header-widget-menu-open-content-footer__footer-text">{source.otherLanguageTitle}</span></a></div></section></div></div></div></section>
      </div>}
    </div>
    {modal && <div ref={overlay} className="header-widget-popup" style={{ height: "100dvh" }} role="dialog" aria-modal="true" aria-labelledby={popup === "regions" ? "header-regions-title" : "header-segments-title"} data-header-popup onClick={event => { if (event.target === event.currentTarget) closePopup(); }}>
      {popup === "regions" ? <div className="header-widget-popup__content header-widget-popup__content_position_top header-widget-regions__pop-content"><div className="header-widget-regions__wrapper"><div className="header-widget-regions__head-container"><span className="header-widget-regions__header" id="header-regions-title">Выбор региона</span><button className="header-widget-regions__icon" aria-label="Закрыть окно" onClick={closePopup}><Cross /></button></div><form className="header-widget-regions__search-form" onSubmit={event => event.preventDefault()}><input className="header-widget-regions__search" aria-label="Введите имя региона" placeholder={region} value={regionQuery} onChange={event => setRegionQuery(event.target.value)} autoComplete="off" /></form><ul className="header-widget-regions__list">{filteredRegions.map(name => <li className="header-widget-regions__item" key={name}><button className="header-widget-regions__region" onClick={() => { setRegion(name); closePopup(); }}>{name}</button></li>)}</ul><div className="header-widget-regions__bottomShadow" aria-hidden="true" /></div></div> : <div className="header-widget-popup__content header-widget-popup__content_position_bottom header-widget-segments-dropdown__pop-content"><section className="segments-list-popup"><div className="segments-list-popup__content"><h2 id="header-segments-title" className="segments-list-popup__title">{source.segmentsTitle}</h2><ul className="segments-list-popup__list">{source.segments.map(segment => <li key={segment.position}><a className="segments-list-popup__list-item" href={segment.url}><span className="segments-list-popup__icon" style={{ backgroundImage: `url("${segment.iconUrl}")` }} aria-hidden="true" /><span className="segments-list-popup__text">{segment.segmentText}</span><span className="segments-list-popup__arrow"><Arrow /></span></a></li>)}</ul></div><button className="header-widget-popup__close-btn header-widget-segments-dropdown__pop-close-btn" aria-label="Закрыть окно" onClick={closePopup}><Cross /></button></section></div>}
    </div>}
  </header>;
}

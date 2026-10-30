// Public reference links use the official site. Local demo routes bypass this helper.
export function officialHref(href: string): string;
export function officialHref(href: string | undefined): string | undefined;
export function officialHref(href: string | undefined): string | undefined {
  return href?.startsWith("/") && !href.startsWith("//")
    ? `https://www.sberbank.ru${href}`
    : href;
}

import catalogue from "./header-search-data.json";

// Same keyword matching, catalogue order and three-result limit as the reference.
export function searchProducts(query: string) {
  if (!query.trim()) return [];
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return catalogue.filter(product => product.keywords.some(keyword => words.some(word => keyword.toLowerCase().includes(word)))).slice(0, 3);
}

export function productDestination(label: string, fallback: string) {
  const lowered = label.toLowerCase();
  return catalogue.find(product => [product.product, ...product.keywords].some(value => value.toLowerCase() === lowered))?.url ?? fallback;
}

import { authFetch } from "./api";

type PaginatedProducts<TProduct> = {
  products: TProduct[];
  pagination?: {
    page: number;
    pageCount: number;
  };
};

export async function fetchAllProducts<TProduct>(apiBase: string, params?: Record<string, string | number | boolean | undefined>) {
  const products: TProduct[] = [];
  let page = 1;
  let pageCount = 1;

  do {
    const searchParams = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== "") searchParams.set(key, String(value));
    });
    searchParams.set("page", String(page));
    searchParams.set("pageSize", "100");

    const data = await authFetch<PaginatedProducts<TProduct>>(`${apiBase}/catalog/products?${searchParams.toString()}`);
    products.push(...data.products);
    pageCount = data.pagination?.pageCount || 1;
    page += 1;
  } while (page <= pageCount);

  return products;
}

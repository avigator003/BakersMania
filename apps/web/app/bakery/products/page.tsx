"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { Eye, IndianRupee, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { Modal } from "../../../components/modal";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Route = {
  id: string;
  name: string;
};

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  city?: string | null;
  route?: Route | null;
};

type Category = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  _count?: { products: number };
};

type Product = {
  id: string;
  name: string;
  category: string;
  description?: string | null;
  unitPrice: string;
  taxRate: string;
  active: boolean;
  categoryRef?: Category | null;
  customerPrices: CustomerPrice[];
};

type CustomerPrice = {
  id: string;
  price: string;
  notes?: string | null;
  customer: Customer;
};

const initialProductForm = {
  name: "",
  categoryId: "",
  description: "",
  unitPrice: "",
  taxRate: "0",
  active: true
};

const initialPriceForm = {
  name: "",
  categoryId: "",
  description: "",
  unitPrice: "",
  taxRate: "0",
  active: true
};

function formatAmount(value?: string | number | null) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export default function BakeryProductsPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [productOpen, setProductOpen] = useState(false);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [editForm, setEditForm] = useState(initialPriceForm);
  const [search, setSearch] = useState("");

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) =>
      [product.name, product.category, product.description]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [products, search]);

  async function loadData() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [categoryData, productData] = await Promise.all([
        authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`),
        authFetch<{ products: Product[] }>(`${apiBase}/catalog/products`)
      ]);
      setCategories(categoryData.categories);
      setProducts(productData.products);
    } catch (error) {
      toast.error("Could not load products", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/catalog/products`, {
        method: "POST",
        body: JSON.stringify({
          ...productForm,
          unitPrice: Number(productForm.unitPrice || 0),
          taxRate: Number(productForm.taxRate || 0),
          categoryId: productForm.categoryId || undefined
        })
      });
      toast.success("Product created", `${productForm.name} was added to the catalog.`);
      setProductForm(initialProductForm);
      setProductOpen(false);
      await loadData();
    } catch (error) {
      toast.error("Product creation failed", error instanceof Error ? error.message : "Could not create product.");
    } finally {
      setSaving(false);
    }
  }

  async function updateProduct(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase || !editProduct) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/catalog/products/${editProduct.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...editForm,
          unitPrice: Number(editForm.unitPrice || 0),
          taxRate: Number(editForm.taxRate || 0),
          categoryId: editForm.categoryId || undefined
        })
      });
      toast.success("Product updated", `${editForm.name} details were saved.`);
      setEditProduct(null);
      await loadData();
    } catch (error) {
      toast.error("Product update failed", error instanceof Error ? error.message : "Could not update product.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(product: Product) {
    setEditProduct(product);
    setEditForm({
      name: product.name,
      categoryId: product.categoryRef?.id || "",
      description: product.description || "",
      unitPrice: String(product.unitPrice || ""),
      taxRate: String(product.taxRate || "0"),
      active: product.active
    });
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Product categories, catalog, and customer-specific pricing" surface="bakery">
      <div className="grid gap-6">
        <section className="summary-grid">
          {[
            ["Categories", categories.length],
            ["Products", products.length],
            ["Active products", products.filter((product) => product.active).length],
            ["Customer prices", products.reduce((total, product) => total + product.customerPrices.length, 0)]
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-2 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Product Management</h1>
              <p className="mt-1 text-sm text-muted">Create categories, products, and special prices for selected customers and their routes.</p>
            </div>
            <div className="grid gap-2 sm:flex sm:flex-wrap">
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setProductOpen(true)}>
                <Plus size={16} />
                Add Product
              </button>
              <button className="focus-ring grid h-10 w-full place-items-center rounded-md border border-line bg-panel2 sm:w-10" onClick={loadData} title="Refresh products">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          <div className="border-b border-line p-4">
            <label className="flex max-w-md items-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2">
              <Search size={16} className="text-muted" />
              <input
                className="w-full bg-transparent text-sm outline-none"
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search product or category"
                value={search}
              />
            </label>
          </div>

          {loading ? <p className="p-4 text-sm text-muted">Loading products...</p> : null}

          <div className="grid gap-3 p-3 sm:hidden">
            {filteredProducts.map((product) => (
              <article key={product.id} className="rounded-lg border border-line bg-panel2 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold">{product.name}</h3>
                    <p className="text-xs text-muted">{product.categoryRef?.name || product.category}</p>
                  </div>
                  <span className={`shrink-0 rounded-md border px-2 py-1 text-xs font-semibold ${product.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                    {product.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <span>
                    <span className="block text-xs text-muted">Base price</span>
                    <span className="font-semibold">{formatAmount(product.unitPrice)}</span>
                  </span>
                  <span>
                    <span className="block text-xs text-muted">Tax</span>
                    <span className="font-semibold">{Number(product.taxRate || 0)}%</span>
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => setViewProduct(product)} title="View product prices">
                    <Eye size={16} />
                  </button>
                  <button className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" onClick={() => openEdit(product)} title="Edit product">
                    <Pencil size={16} />
                  </button>
                  <Link className="focus-ring grid h-10 place-items-center rounded-md border border-line bg-panel" href={`products/${product.id}/prices`} title="Set customer prices">
                    <IndianRupee size={16} />
                  </Link>
                </div>
              </article>
            ))}
            {!loading && !filteredProducts.length ? (
              <p className="rounded-lg border border-line bg-panel2 p-4 text-center text-sm text-muted">No products found.</p>
            ) : null}
          </div>

          <div className="hidden max-h-[680px] w-full max-w-full overflow-auto sm:block">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead className="sticky top-0 z-10 border-b border-line bg-panel2 text-xs uppercase text-muted">
                <tr>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Base price</th>
                  <th className="px-4 py-3">Tax</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="align-top">
                    <td className="px-4 py-3">
                      <span className="block font-semibold">{product.name}</span>
                      <span className="text-xs text-muted">{product.description || "No description"}</span>
                    </td>
                    <td className="px-4 py-3">{product.categoryRef?.name || product.category}</td>
                    <td className="px-4 py-3">{formatAmount(product.unitPrice)}</td>
                    <td className="px-4 py-3">{Number(product.taxRate || 0)}%</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${product.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                        {product.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2 hover:border-mint" onClick={() => setViewProduct(product)} title="View product prices">
                          <Eye size={16} />
                        </button>
                        <button className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2 hover:border-mint" onClick={() => openEdit(product)} title="Edit product">
                          <Pencil size={16} />
                        </button>
                        <Link className="focus-ring grid h-9 w-9 place-items-center rounded-md border border-line bg-panel2 hover:border-mint" href={`products/${product.id}/prices`} title="Set customer prices">
                          <IndianRupee size={16} />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && !filteredProducts.length ? (
                  <tr>
                    <td className="px-4 py-6 text-center text-sm text-muted" colSpan={6}>No products found.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <Modal open={productOpen} title="Add Product" description="Create a product inside a category with base pricing." onClose={() => setProductOpen(false)}>
          <form className="grid gap-3" onSubmit={createProduct}>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Product name</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))} value={productForm.name} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Category</span>
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setProductForm((current) => ({ ...current, categoryId: event.target.value }))} value={productForm.categoryId}>
                <option value="">Select category</option>
                {categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Description</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))} value={productForm.description} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium">Base price</span>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setProductForm((current) => ({ ...current, unitPrice: event.target.value }))} type="number" value={productForm.unitPrice} />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">Tax %</span>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setProductForm((current) => ({ ...current, taxRate: event.target.value }))} type="number" value={productForm.taxRate} />
              </label>
            </div>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setProductOpen(false)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving || !categories.length} type="submit">{saving ? "Saving..." : "Create Product"}</button>
            </div>
          </form>
        </Modal>

        <Modal open={Boolean(viewProduct)} title="Product Details" description={viewProduct ? `${viewProduct.name} pricing for different customers.` : ""} onClose={() => setViewProduct(null)}>
          <div className="grid gap-4">
            <div className="grid gap-3 rounded-md border border-line bg-panel2 p-3 text-sm sm:grid-cols-2">
              <div>
                <p className="text-muted">Category</p>
                <p className="font-semibold">{viewProduct?.categoryRef?.name || viewProduct?.category || "-"}</p>
              </div>
              <div>
                <p className="text-muted">Base price</p>
                <p className="font-semibold">{formatAmount(viewProduct?.unitPrice)}</p>
              </div>
              <div>
                <p className="text-muted">Tax</p>
                <p className="font-semibold">{Number(viewProduct?.taxRate || 0)}%</p>
              </div>
              <div>
                <p className="text-muted">Status</p>
                <p className="font-semibold">{viewProduct?.active ? "Active" : "Inactive"}</p>
              </div>
            </div>
            <div className="rounded-md border border-line">
              <div className="border-b border-line bg-panel2 px-3 py-2">
                <p className="font-semibold">Customer prices</p>
              </div>
              <div className="max-h-72 divide-y divide-line overflow-auto">
                {viewProduct?.customerPrices.map((price) => (
                  <div key={price.id} className="grid gap-1 p-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <p className="font-semibold">{price.customer.name}</p>
                      <p className="text-muted">{price.customer.route?.name || "No route"} · {price.customer.city || "No city"} · {price.customer.phone || "No phone"}</p>
                      {price.notes ? <p className="text-xs text-muted">{price.notes}</p> : null}
                    </div>
                    <p className="font-bold text-mint">{formatAmount(price.price)}</p>
                  </div>
                ))}
                {!viewProduct?.customerPrices.length ? <p className="p-3 text-sm text-muted">No customer prices set yet.</p> : null}
              </div>
            </div>
          </div>
        </Modal>

        <Modal open={Boolean(editProduct)} title="Edit Product" description={editProduct ? `Update ${editProduct.name}.` : ""} onClose={() => setEditProduct(null)}>
          <form className="grid gap-3" onSubmit={updateProduct}>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Product name</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} value={editForm.name} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Category</span>
              <select className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, categoryId: event.target.value }))} value={editForm.categoryId}>
                <option value="">Select category</option>
                {categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Description</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} value={editForm.description} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-medium">Base price</span>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, unitPrice: event.target.value }))} type="number" value={editForm.unitPrice} />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">Tax %</span>
                <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setEditForm((current) => ({ ...current, taxRate: event.target.value }))} type="number" value={editForm.taxRate} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input checked={editForm.active} onChange={(event) => setEditForm((current) => ({ ...current, active: event.target.checked }))} type="checkbox" />
              Active product
            </label>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setEditProduct(null)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Save Product"}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

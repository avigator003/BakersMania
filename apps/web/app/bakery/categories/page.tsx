"use client";

import { FormEvent, useEffect, useState } from "react";
import { Layers3, Plus, RefreshCw } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { Modal } from "../../../components/modal";
import { useToast } from "../../../components/toast-provider";
import { authFetch, getStoredTenantSlug } from "../../../lib/api";

type Category = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  _count?: { products: number };
};

const initialCategoryForm = {
  name: "",
  description: ""
};

export default function BakeryCategoriesPage() {
  const toast = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialCategoryForm);

  const tenantSlug = typeof window === "undefined" ? "" : getStoredTenantSlug() || "";
  const apiBase = tenantSlug ? `/t/${tenantSlug}` : "";

  async function loadCategories() {
    if (!apiBase) {
      toast.error("Bakery slug missing", "Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await authFetch<{ categories: Category[] }>(`${apiBase}/catalog/categories`);
      setCategories(response.categories);
    } catch (error) {
      toast.error("Could not load categories", error instanceof Error ? error.message : "Please check API and login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  async function createCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBase) return;
    setSaving(true);
    try {
      await authFetch(`${apiBase}/catalog/categories`, {
        method: "POST",
        body: JSON.stringify(form)
      });
      toast.success("Category created", `${form.name} is ready for products.`);
      setForm(initialCategoryForm);
      setOpen(false);
      await loadCategories();
    } catch (error) {
      toast.error("Category creation failed", error instanceof Error ? error.message : "Could not create category.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Bakery CRM" subtitle="Product category list and descriptions" surface="bakery">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Category Management</h1>
              <p className="mt-1 text-sm text-muted">Create and review product categories before adding products.</p>
            </div>
            <div className="flex gap-2">
              <button className="focus-ring inline-flex items-center gap-2 rounded-md bg-mint px-4 py-2 text-sm font-semibold text-white" onClick={() => setOpen(true)}>
                <Plus size={16} />
                Add Category
              </button>
              <button className="focus-ring grid h-10 w-10 place-items-center rounded-md border border-line bg-panel2" onClick={loadCategories} title="Refresh categories">
                <RefreshCw size={16} />
              </button>
            </div>
          </div>

          {loading ? <LoadingSpinner label="Loading categories" /> : null}

          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {categories.map((category) => (
              <article key={category.id} className="rounded-md border border-line bg-panel2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{category.name}</p>
                    <p className="mt-1 text-sm text-muted">{category.description || "No description"}</p>
                  </div>
                  <Layers3 className="text-mint" size={18} />
                </div>
                <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-muted">{category._count?.products || 0} products</span>
                  <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${category.active ? "border-mint/30 bg-mint/10 text-mint" : "border-slate-400/30 bg-slate-100 text-slate-600"}`}>
                    {category.active ? "Active" : "Inactive"}
                  </span>
                </div>
              </article>
            ))}
            {!loading && !categories.length ? <p className="text-sm text-muted">No categories found.</p> : null}
          </div>
        </section>

        <Modal open={open} title="Add Category" description="Create a product category with a description." onClose={() => setOpen(false)}>
          <form className="grid gap-3" onSubmit={createCategory}>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Category name</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} value={form.name} />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Description</span>
              <input className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint" onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} value={form.description} />
            </label>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setOpen(false)} type="button">Cancel</button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">{saving ? "Saving..." : "Create Category"}</button>
            </div>
          </form>
        </Modal>
      </div>
    </AppShell>
  );
}

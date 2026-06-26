import { Clock, CreditCard, ShoppingCart } from "lucide-react";
import { AppShell } from "../../components/shell";

const products = [
  { name: "Chocolate Truffle Cake", price: "₹850", category: "Cakes" },
  { name: "Butter Croissant Box", price: "₹420", category: "Pastries" },
  { name: "Custom Birthday Cake", price: "From ₹1,200", category: "Custom" }
];

export default function CustomerPage() {
  return (
    <AppShell title="Customer Portal" subtitle="Place orders, view invoices, and track bakery updates" surface="customer">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="border-b border-line p-4">
            <h1 className="text-xl font-semibold">Order From Sweet Crust Bakery</h1>
            <p className="text-sm text-muted">Portal orders and WhatsApp orders land in the same bakery order queue.</p>
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            {products.map((product) => (
              <article key={product.name} className="rounded-lg border border-line bg-panel2 p-4">
                <p className="text-sm text-mint">{product.category}</p>
                <h2 className="mt-1 text-lg font-semibold">{product.name}</h2>
                <p className="mt-3 text-xl font-bold">{product.price}</p>
                <button className="focus-ring mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-mint px-4 py-3 font-semibold text-white">
                  <ShoppingCart size={18} />
                  Add to Order
                </button>
              </article>
            ))}
          </div>
        </section>

        <aside id="orders" className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
          <h2 className="text-lg font-semibold">My Latest Order</h2>
          <div className="mt-4 grid gap-3">
            <div className="flex items-center gap-3 rounded-md bg-panel2 p-3">
              <Clock className="text-mint" size={20} />
              <span>
                <span className="block font-medium">Ready tomorrow</span>
                <span className="block text-sm text-muted">Custom birthday cake</span>
              </span>
            </div>
            <div className="flex items-center gap-3 rounded-md bg-panel2 p-3">
              <CreditCard className="text-mint" size={20} />
              <span>
                <span className="block font-medium">Partially paid</span>
                <span className="block text-sm text-muted">Balance visible on invoice</span>
              </span>
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

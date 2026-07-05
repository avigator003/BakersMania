import type { LucideIcon } from "lucide-react";

export function ModulePage({
  eyebrow,
  title,
  description,
  icon: Icon,
  stats,
  actions
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  stats: Array<[string, string]>;
  actions: string[];
}) {
  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-line bg-panel p-5 shadow-subtle">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-mint">{eyebrow}</p>
            <h1 className="mt-2 text-2xl font-bold">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
          </div>
          <span className="grid h-12 w-12 place-items-center rounded-md bg-panel2 text-mint">
            <Icon size={24} />
          </span>
        </div>
      </section>

      <section className="rounded-lg border border-line bg-panel p-4 shadow-subtle">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
            {stats.map(([label, value]) => (
              <span key={label}>{label}: <span className="font-semibold text-ink">{value}</span></span>
            ))}
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((action) => (
            <button key={action} className="focus-ring rounded-md border border-line bg-panel2 px-4 py-3 text-left font-semibold hover:border-mint">
              {action}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

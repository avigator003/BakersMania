"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Database, Edit3, Plus, RefreshCw, Trash2 } from "lucide-react";
import { AppShell } from "../../../components/shell";
import { LoadingSpinner } from "../../../components/loading-spinner";
import { ConfirmModal, Modal } from "../../../components/modal";
import { useToast } from "../../../components/toast-provider";
import { authFetch } from "../../../lib/api";

type PostgresConnection = {
  id: string;
  name: string;
  databaseUrl: string;
  createdAt: string;
  updatedAt: string;
  tenant?: {
    id: string;
    name: string;
    slug: string;
    status: string;
  } | null;
};

function maskDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.password) url.password = "*****";
    if (url.username) url.username = url.username.slice(0, 3) ? `${url.username.slice(0, 3)}***` : "***";
    return url.toString();
  } catch {
    return value.length > 20 ? `${value.slice(0, 14)}...${value.slice(-6)}` : value;
  }
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
}

export default function AdminPostgresConnectionsPage() {
  const toast = useToast();
  const [connections, setConnections] = useState<PostgresConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", databaseUrl: "" });
  const [editConnection, setEditConnection] = useState<PostgresConnection | null>(null);
  const [editForm, setEditForm] = useState({ name: "", databaseUrl: "" });
  const [deleteConnection, setDeleteConnection] = useState<PostgresConnection | null>(null);

  const stats = useMemo(() => {
    const attached = connections.filter((connection) => connection.tenant).length;
    return [
      ["Connections", String(connections.length)],
      ["Available", String(connections.length - attached)],
      ["Attached", String(attached)]
    ];
  }, [connections]);

  async function loadConnections() {
    setLoading(true);
    try {
      const data = await authFetch<{ connections: PostgresConnection[] }>("/platform-admin/postgres-connections");
      setConnections(data.connections);
    } catch (error) {
      toast.error("Could not load Postgres DBs", error instanceof Error ? error.message : "Please check API and admin login.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConnections();
  }, []);

  async function createConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await authFetch("/platform-admin/postgres-connections", {
        method: "POST",
        body: JSON.stringify(form)
      });
      toast.success("Postgres DB saved", `${form.name} is available for bakery onboarding.`);
      setForm({ name: "", databaseUrl: "" });
      await loadConnections();
    } catch (error) {
      toast.error("Save failed", error instanceof Error ? error.message : "Could not create Postgres connection.");
    } finally {
      setSaving(false);
    }
  }

  function openEdit(connection: PostgresConnection) {
    setEditConnection(connection);
    setEditForm({ name: connection.name, databaseUrl: connection.databaseUrl });
  }

  async function updateConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editConnection) return;
    setSaving(true);
    try {
      await authFetch(`/platform-admin/postgres-connections/${editConnection.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm)
      });
      toast.success("Postgres DB updated", `${editForm.name} was saved.`);
      setEditConnection(null);
      await loadConnections();
    } catch (error) {
      toast.error("Update failed", error instanceof Error ? error.message : "Could not update Postgres connection.");
    } finally {
      setSaving(false);
    }
  }

  async function removeConnection() {
    if (!deleteConnection) return;
    setSaving(true);
    try {
      await authFetch(`/platform-admin/postgres-connections/${deleteConnection.id}`, { method: "DELETE" });
      toast.success("Postgres DB deleted", `${deleteConnection.name} was removed.`);
      setDeleteConnection(null);
      await loadConnections();
    } catch (error) {
      toast.error("Delete failed", error instanceof Error ? error.message : "Detach the DB from its bakery before deleting it.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell title="Platform Admin" subtitle="Postgres database registry and bakery assignments" surface="admin">
      <div className="grid gap-6">
        <section className="rounded-lg border border-line bg-panel shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Database className="text-mint" size={20} />
                <h1 className="text-xl font-semibold">Postgres DBs</h1>
              </div>
              <p className="mt-1 text-sm text-muted">Create database connections and attach one connection to one bakery.</p>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted">
              {stats.map(([label, value]) => (
                <span key={label}>{label}: <span className="font-semibold text-ink">{value}</span></span>
              ))}
            </div>
            <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-4 py-2 text-sm font-semibold" onClick={loadConnections}>
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>

          <div className="grid min-w-0 gap-5 p-4 xl:grid-cols-[360px_minmax(0,1fr)]">
            <form className="grid content-start gap-3 rounded-lg border border-line bg-panel2 p-4" onSubmit={createConnection}>
              <h2 className="font-semibold">Create Postgres DB</h2>
              <label className="grid gap-1">
                <span className="text-sm font-medium">Name</span>
                <input
                  className="rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-mint"
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  placeholder="Star Bakery DB"
                  required
                  value={form.name}
                />
              </label>
              <label className="grid gap-1">
                <span className="text-sm font-medium">Postgres URL</span>
                <textarea
                  className="min-h-28 rounded-md border border-line bg-panel px-3 py-2 text-sm outline-none focus:border-mint"
                  onChange={(event) => setForm((current) => ({ ...current, databaseUrl: event.target.value.trim() }))}
                  placeholder="postgresql://user:password@host/db"
                  required
                  value={form.databaseUrl}
                />
              </label>
              <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">
                <Plus size={16} />
                {saving ? "Saving..." : "Save DB"}
              </button>
            </form>

            <div className="min-w-0 rounded-lg border border-line bg-panel2">
              {loading ? <LoadingSpinner label="Loading Postgres DBs" /> : null}
              {!loading && connections.length === 0 ? (
                <div className="p-6 text-sm text-muted">No Postgres DBs saved yet.</div>
              ) : null}
              <div className="grid min-w-0 gap-3 p-3">
                {connections.map((connection) => (
                  <article key={connection.id} className="grid min-w-0 gap-3 rounded-lg border border-line bg-panel p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{connection.name}</h2>
                        {connection.tenant ? (
                          <span className="rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-semibold text-mint">
                            {connection.tenant.name}
                          </span>
                        ) : (
                          <span className="rounded-full border border-saffron/30 bg-saffron/10 px-3 py-1 text-xs font-semibold text-saffron">
                            Available
                          </span>
                        )}
                      </div>
                      <p className="mt-2 max-w-full break-all rounded-md bg-panel2 px-3 py-2 text-xs leading-5 text-muted">
                        {maskDatabaseUrl(connection.databaseUrl)}
                      </p>
                      <p className="mt-2 text-xs text-muted">Created {formatDate(connection.createdAt)}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:flex">
                      <button className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold" onClick={() => openEdit(connection)} type="button">
                        <Edit3 size={16} />
                        Edit
                      </button>
                      <button
                        className="focus-ring inline-flex items-center justify-center gap-2 rounded-md border border-line bg-panel2 px-3 py-2 text-sm font-semibold text-berry disabled:cursor-not-allowed disabled:opacity-50"
                        disabled={Boolean(connection.tenant)}
                        onClick={() => setDeleteConnection(connection)}
                        title={connection.tenant ? "Detach this DB from its bakery before deleting" : "Delete DB"}
                        type="button"
                      >
                        <Trash2 size={16} />
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <Modal
          open={Boolean(editConnection)}
          title="Edit Postgres DB"
          description={editConnection?.tenant ? "This DB is attached. Restart the API after changing its URL so the cached client reconnects." : "Update this saved database connection."}
          onClose={() => setEditConnection(null)}
        >
          <form className="grid gap-3" onSubmit={updateConnection}>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Name</span>
              <input
                className="rounded-md border border-line bg-panel2 px-3 py-2 outline-none focus:border-mint"
                onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))}
                required
                value={editForm.name}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Postgres URL</span>
              <textarea
                className="min-h-28 rounded-md border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-mint"
                onChange={(event) => setEditForm((current) => ({ ...current, databaseUrl: event.target.value.trim() }))}
                required
                value={editForm.databaseUrl}
              />
            </label>
            <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button className="focus-ring rounded-md border border-line bg-panel2 px-4 py-2 font-semibold" onClick={() => setEditConnection(null)} type="button">
                Cancel
              </button>
              <button className="focus-ring rounded-md bg-mint px-4 py-2 font-semibold text-white" disabled={saving} type="submit">
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </form>
        </Modal>

        <ConfirmModal
          open={Boolean(deleteConnection)}
          title="Delete Postgres DB?"
          description={deleteConnection ? `${deleteConnection.name} will be removed from the registry.` : ""}
          confirmLabel="Delete DB"
          variant="danger"
          loading={saving}
          onClose={() => setDeleteConnection(null)}
          onConfirm={removeConnection}
        />
      </div>
    </AppShell>
  );
}

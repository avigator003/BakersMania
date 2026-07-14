import type { Prisma } from "@prisma/client";

export type OrderPipelineActor = "CUSTOMER" | "VEHICLE" | "BAKERY";

export type OrderPipelineStage = {
  key: string;
  label: string;
  actorType: OrderPipelineActor;
  order: number;
  enabled: boolean;
};

export const defaultOrderPipelineStages: OrderPipelineStage[] = [
  { key: "CUSTOMER_SUBMITTED", label: "Customer submitted", actorType: "CUSTOMER", order: 1, enabled: true },
  { key: "VEHICLE_REVIEW", label: "Vehicle review", actorType: "VEHICLE", order: 2, enabled: true },
  { key: "BAKERY_REVIEW", label: "Bakery review", actorType: "BAKERY", order: 3, enabled: true }
];

export function normalizePipelineStages(value: Prisma.JsonValue | null | undefined) {
  const byKey = new Map(defaultOrderPipelineStages.map((stage) => [stage.key, stage]));
  if (Array.isArray(value)) {
    for (const item of value) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const raw = item as Record<string, unknown>;
      const key = typeof raw.key === "string" ? raw.key : "";
      const base = byKey.get(key);
      if (!base) continue;
      byKey.set(key, {
        ...base,
        label: typeof raw.label === "string" && raw.label.trim() ? raw.label : base.label,
        order: typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : base.order,
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : base.enabled
      });
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.order - b.order);
}

export function enabledPipelineStages(value: Prisma.JsonValue | null | undefined, enabled = true) {
  if (!enabled) return [];
  return normalizePipelineStages(value).filter((stage) => stage.enabled);
}

export function nextStageAfterActor(stages: OrderPipelineStage[], actorType?: OrderPipelineActor) {
  const currentIndex = actorType ? stages.findIndex((stage) => stage.actorType === actorType) : -1;
  return stages.slice(Math.max(currentIndex + 1, 0)).find((stage) => stage.actorType !== "CUSTOMER") || null;
}

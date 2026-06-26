import { prisma } from "../../db/prisma.js";
import type { RouteInput, VehicleInput } from "./routes.schemas.js";

export const bakeryRoutesRepository = {
  listVehicles(tenantId: string) {
    return prisma.vehicle.findMany({
      where: { tenantId },
      orderBy: [{ active: "desc" }, { createdAt: "desc" }]
    });
  },

  findVehicle(tenantId: string, vehicleId: string) {
    return prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId }, select: { id: true } });
  },

  createVehicle(tenantId: string, input: VehicleInput) {
    return prisma.vehicle.create({ data: { ...input, tenantId } });
  },

  list(tenantId: string) {
    return prisma.route.findMany({
      where: { tenantId },
      include: { vehicle: true }
    });
  },

  create(tenantId: string, input: RouteInput) {
    return prisma.route.create({ data: { ...input, vehicleId: input.vehicleId || undefined, tenantId }, include: { vehicle: true } });
  }
};

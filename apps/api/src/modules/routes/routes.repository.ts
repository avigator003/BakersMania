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

  findRoute(tenantId: string, routeId: string) {
    return prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
  },

  async upsertVehicleUser(input: { email: string; phone: string; name: string; passwordHash: string }) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: input.email } });
    if (existingByEmail) {
      return prisma.user.update({
        where: { id: existingByEmail.id },
        data: { phone: input.phone, name: input.name, passwordHash: input.passwordHash }
      });
    }

    const reusableByPhone = await prisma.user.findFirst({
      where: {
        phone: input.phone,
        memberships: { none: {} },
        customers: { none: {} },
        vehicles: { none: {} }
      },
      orderBy: { createdAt: "desc" }
    });
    if (reusableByPhone) {
      return prisma.user.update({
        where: { id: reusableByPhone.id },
        data: { email: input.email, phone: input.phone, name: input.name, passwordHash: input.passwordHash }
      });
    }

    return prisma.user.create({ data: input });
  },

  createVehicle(tenantId: string, input: VehicleInput & { userId?: string }) {
    return prisma.vehicle.create({ data: { ...input, tenantId } });
  },

  updateVehicle(tenantId: string, vehicleId: string, input: VehicleInput & { userId?: string }) {
    return prisma.vehicle.update({
      where: { id: vehicleId },
      data: input
    });
  },

  list(tenantId: string) {
    return prisma.route.findMany({
      where: { tenantId },
      include: { vehicle: true }
    });
  },

  create(tenantId: string, input: RouteInput) {
    return prisma.route.create({ data: { ...input, vehicleId: input.vehicleId || undefined, tenantId }, include: { vehicle: true } });
  },

  update(tenantId: string, routeId: string, input: RouteInput) {
    return prisma.route.update({
      where: { id: routeId },
      data: { ...input, vehicleId: input.vehicleId || null },
      include: { vehicle: true }
    });
  }
};

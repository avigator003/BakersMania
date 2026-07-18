import { prisma } from "../../db/prisma.js";
import { pagination, paginationMeta, type PaginationInput } from "../../utils/pagination.js";
import type { RouteInput, VehicleInput } from "./routes.schemas.js";

export type RouteListFilters = PaginationInput & {
  search?: string;
};

export type VehicleListFilters = PaginationInput & {
  search?: string;
};

export const bakeryRoutesRepository = {
  async listVehicles(tenantId: string, filters: VehicleListFilters = {}) {
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const where = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { number: { contains: search, mode: "insensitive" as const } },
              { driverName: { contains: search, mode: "insensitive" as const } },
              { driverPhone: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {})
    };
    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        include: { routes: { select: { id: true, name: true }, orderBy: { updatedAt: "desc" } } },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
        skip,
        take: pageSize
      }),
      prisma.vehicle.count({ where })
    ]);
    return { vehicles, pagination: paginationMeta(total, page, pageSize) };
  },

  findVehicle(tenantId: string, vehicleId: string) {
    return prisma.vehicle.findFirst({ where: { id: vehicleId, tenantId }, select: { id: true, userId: true, name: true } });
  },

  findVehicleDetail(tenantId: string, vehicleId: string) {
    return prisma.vehicle.findFirst({
      where: { id: vehicleId, tenantId, active: true },
      include: { routes: { where: { active: true }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" } } }
    });
  },

  findRoute(tenantId: string, routeId: string) {
    return prisma.route.findFirst({ where: { id: routeId, tenantId }, select: { id: true } });
  },

  findRouteByVehicle(tenantId: string, vehicleId: string, excludeRouteId?: string) {
    return prisma.route.findFirst({
      where: {
        tenantId,
        vehicleId,
        ...(excludeRouteId ? { id: { not: excludeRouteId } } : {})
      },
      select: { id: true, name: true }
    });
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

  updateUserPassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
      select: { id: true }
    });
  },

  updateVehicleUser(userId: string, input: { email: string; phone: string; name: string }) {
    return prisma.user.update({
      where: { id: userId },
      data: input,
      select: { id: true }
    });
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

  async list(tenantId: string, filters: RouteListFilters = {}) {
    const { page, pageSize, skip } = pagination(filters);
    const search = filters.search?.trim();
    const where = {
      tenantId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { vehicle: { name: { contains: search, mode: "insensitive" as const } } },
              { vehicle: { number: { contains: search, mode: "insensitive" as const } } }
            ]
          }
        : {})
    };
    const [routes, total] = await Promise.all([
      prisma.route.findMany({
        where,
        include: { vehicle: true },
        orderBy: [{ active: "desc" }, { updatedAt: "desc" }, { name: "asc" }],
        skip,
        take: pageSize
      }),
      prisma.route.count({ where })
    ]);
    return { routes, pagination: paginationMeta(total, page, pageSize) };
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

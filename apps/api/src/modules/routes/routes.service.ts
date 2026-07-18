import bcrypt from "bcryptjs";
import { bakeryRoutesRepository } from "./routes.repository.js";
import type { RouteListFilters, VehicleListFilters } from "./routes.repository.js";
import type { PasswordUpdateInput, RouteInput, VehicleInput } from "./routes.schemas.js";
import { HttpError } from "../../utils/http.js";

function normalizePhone(value?: string | null) {
  return (value || "").replace(/[^\d+]/g, "");
}

function vehicleEmail(tenantId: string, phone: string) {
  return `vehicle-${tenantId}-${phone.replace(/[^\d]/g, "")}@bakersmania.local`;
}

export const bakeryRoutesService = {
  listVehicles(tenantId: string, filters: VehicleListFilters = {}) {
    return bakeryRoutesRepository.listVehicles(tenantId, filters);
  },

  async myVehicle(auth: Express.Request["auth"], tenantId: string) {
    if (auth?.actorType !== "vehicle" || !auth.vehicleId) {
      throw new HttpError(403, "Vehicle workspace access required");
    }
    const vehicle = await bakeryRoutesRepository.findVehicleDetail(tenantId, auth.vehicleId);
    if (!vehicle) {
      throw new HttpError(404, "Vehicle not found");
    }
    return vehicle;
  },

  async createVehicle(tenantId: string, input: VehicleInput) {
    const phone = normalizePhone(input.driverPhone);
    if (!phone) {
      throw new HttpError(422, "Driver phone number is required for vehicle portal credentials");
    }

    const passwordHash = await bcrypt.hash("123456", 12);
    const user = await bakeryRoutesRepository.upsertVehicleUser({
      email: vehicleEmail(tenantId, phone),
      phone,
      name: input.driverName || input.name,
      passwordHash
    });
    return bakeryRoutesRepository.createVehicle(tenantId, { ...input, driverPhone: phone, userId: user.id });
  },

  async updateVehicle(tenantId: string, vehicleId: string, input: VehicleInput) {
    const vehicle = await bakeryRoutesRepository.findVehicle(tenantId, vehicleId);
    if (!vehicle) {
      throw new HttpError(404, "Vehicle not found");
    }
    const phone = normalizePhone(input.driverPhone);
    if (!phone) {
      throw new HttpError(422, "Driver phone number is required for vehicle portal credentials");
    }
    const userInput = {
      email: vehicleEmail(tenantId, phone),
      phone,
      name: input.driverName || input.name
    };
    const user = vehicle.userId
      ? await bakeryRoutesRepository.updateVehicleUser(vehicle.userId, userInput)
      : await bakeryRoutesRepository.upsertVehicleUser({
          ...userInput,
          passwordHash: await bcrypt.hash("123456", 12)
        });
    return bakeryRoutesRepository.updateVehicle(tenantId, vehicleId, { ...input, driverPhone: phone, userId: user.id });
  },

  async resetVehiclePassword(auth: Express.Request["auth"], tenantId: string, vehicleId: string, input: PasswordUpdateInput) {
    if (auth?.actorType !== "bakery_user") {
      throw new HttpError(403, "Bakery access required");
    }
    const vehicle = await bakeryRoutesRepository.findVehicle(tenantId, vehicleId);
    if (!vehicle) {
      throw new HttpError(404, "Vehicle not found");
    }
    if (!vehicle.userId) {
      throw new HttpError(404, "Vehicle login account not found");
    }
    const passwordHash = await bcrypt.hash(input.password, 12);
    await bakeryRoutesRepository.updateUserPassword(vehicle.userId, passwordHash);
    return { vehicleId: vehicle.id, vehicleName: vehicle.name, password: input.password };
  },

  list(tenantId: string, filters: RouteListFilters = {}) {
    return bakeryRoutesRepository.list(tenantId, filters);
  },

  async create(tenantId: string, input: RouteInput) {
    if (input.vehicleId) {
      const vehicle = await bakeryRoutesRepository.findVehicle(tenantId, input.vehicleId);
      if (!vehicle) {
        throw new HttpError(400, "Selected vehicle does not belong to this bakery");
      }
      const existingRoute = await bakeryRoutesRepository.findRouteByVehicle(tenantId, input.vehicleId);
      if (existingRoute) {
        throw new HttpError(409, `Vehicle is already assigned to ${existingRoute.name}`);
      }
    }
    return bakeryRoutesRepository.create(tenantId, input);
  },

  async update(tenantId: string, routeId: string, input: RouteInput) {
    const route = await bakeryRoutesRepository.findRoute(tenantId, routeId);
    if (!route) {
      throw new HttpError(404, "Route not found");
    }
    if (input.vehicleId) {
      const vehicle = await bakeryRoutesRepository.findVehicle(tenantId, input.vehicleId);
      if (!vehicle) {
        throw new HttpError(400, "Selected vehicle does not belong to this bakery");
      }
      const existingRoute = await bakeryRoutesRepository.findRouteByVehicle(tenantId, input.vehicleId, routeId);
      if (existingRoute) {
        throw new HttpError(409, `Vehicle is already assigned to ${existingRoute.name}`);
      }
    }
    return bakeryRoutesRepository.update(tenantId, routeId, input);
  }
};

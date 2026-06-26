import { bakeryRoutesRepository } from "./routes.repository.js";
import type { RouteInput, VehicleInput } from "./routes.schemas.js";
import { HttpError } from "../../utils/http.js";

export const bakeryRoutesService = {
  listVehicles(tenantId: string) {
    return bakeryRoutesRepository.listVehicles(tenantId);
  },

  createVehicle(tenantId: string, input: VehicleInput) {
    return bakeryRoutesRepository.createVehicle(tenantId, input);
  },

  list(tenantId: string) {
    return bakeryRoutesRepository.list(tenantId);
  },

  async create(tenantId: string, input: RouteInput) {
    if (input.vehicleId) {
      const vehicle = await bakeryRoutesRepository.findVehicle(tenantId, input.vehicleId);
      if (!vehicle) {
        throw new HttpError(400, "Selected vehicle does not belong to this bakery");
      }
    }
    return bakeryRoutesRepository.create(tenantId, input);
  }
};

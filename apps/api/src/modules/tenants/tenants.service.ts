import { HttpError } from "../../utils/http.js";
import { tenantsRepository } from "./tenants.repository.js";

export const tenantsService = {
  async getPublicTenant(slug: string) {
    const tenant = await tenantsRepository.findPublicBySlug(slug);
    if (!tenant) {
      throw new HttpError(404, "Bakery not found");
    }
    return tenant;
  }
};

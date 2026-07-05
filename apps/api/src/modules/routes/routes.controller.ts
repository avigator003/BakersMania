import type { Request, Response } from "express";
import { numberQueryParam } from "../../utils/pagination.js";
import { bakeryRoutesService } from "./routes.service.js";

export const bakeryRoutesController = {
  async listVehicles(req: Request, res: Response) {
    const result = await bakeryRoutesService.listVehicles(req.tenant!.id, {
      page: numberQueryParam(req.query.page),
      pageSize: numberQueryParam(req.query.pageSize),
      search: req.query.search ? String(req.query.search) : undefined
    });
    res.json(result);
  },

  async createVehicle(req: Request, res: Response) {
    const vehicle = await bakeryRoutesService.createVehicle(req.tenant!.id, req.body);
    res.status(201).json({ vehicle });
  },

  async updateVehicle(req: Request, res: Response) {
    res.json({ vehicle: await bakeryRoutesService.updateVehicle(req.tenant!.id, req.params.vehicleId, req.body) });
  },

  async list(req: Request, res: Response) {
    const result = await bakeryRoutesService.list(req.tenant!.id, {
      page: numberQueryParam(req.query.page),
      pageSize: numberQueryParam(req.query.pageSize),
      search: req.query.search ? String(req.query.search) : undefined
    });
    res.json(result);
  },

  async create(req: Request, res: Response) {
    const route = await bakeryRoutesService.create(req.tenant!.id, req.body);
    res.status(201).json({ route });
  },

  async update(req: Request, res: Response) {
    res.json({ route: await bakeryRoutesService.update(req.tenant!.id, req.params.routeId, req.body) });
  }
};

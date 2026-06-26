import type { Request, Response } from "express";
import { bakeryRoutesService } from "./routes.service.js";

export const bakeryRoutesController = {
  async listVehicles(req: Request, res: Response) {
    res.json({ vehicles: await bakeryRoutesService.listVehicles(req.tenant!.id) });
  },

  async createVehicle(req: Request, res: Response) {
    const vehicle = await bakeryRoutesService.createVehicle(req.tenant!.id, req.body);
    res.status(201).json({ vehicle });
  },

  async list(req: Request, res: Response) {
    res.json({ routes: await bakeryRoutesService.list(req.tenant!.id) });
  },

  async create(req: Request, res: Response) {
    const route = await bakeryRoutesService.create(req.tenant!.id, req.body);
    res.status(201).json({ route });
  }
};

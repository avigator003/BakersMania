import type { Request, Response } from "express";
import { reportsService } from "./reports.service.js";

export const reportsController = {
  async dashboard(req: Request, res: Response) {
    res.json(await reportsService.getDashboard(req.tenant!.id));
  }
};

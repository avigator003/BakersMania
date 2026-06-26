import type { Request, Response } from "express";
import { HttpError } from "../../utils/http.js";
import { staffService } from "./staff.service.js";

export const staffController = {
  async listLabourDashboard(req: Request, res: Response) {
    const attendanceDate = typeof req.query.date === "string" && req.query.date ? new Date(req.query.date) : undefined;
    res.json(await staffService.listLabourDashboard(req.tenant!.id, attendanceDate));
  },

  async createLabour(req: Request, res: Response) {
    const labour = await staffService.createLabour(req.tenant!.id, req.body);
    res.status(201).json({ labour });
  },

  async exportLabourYear(req: Request, res: Response) {
    res.json(await staffService.getLabourYearExport(req.tenant!, typeof req.query.year === "string" ? req.query.year : undefined));
  },

  async updateLabour(req: Request, res: Response) {
    const labour = await staffService.updateLabour(req.tenant!.id, req.params.labourId, req.body);
    if (!labour) {
      throw new HttpError(404, "Labour not found");
    }
    res.json({ labour });
  },

  async getLabourDetail(req: Request, res: Response) {
    const detail = await staffService.getLabourDetail(
      req.tenant!.id,
      req.params.labourId,
      typeof req.query.month === "string" ? req.query.month : undefined
    );
    if (!detail) {
      throw new HttpError(404, "Labour not found");
    }
    res.json(detail);
  },

  async createAttendance(req: Request, res: Response) {
    const attendance = await staffService.createAttendance(req.tenant!.id, req.body);
    res.status(201).json({ attendance });
  },

  async createSalaryPayment(req: Request, res: Response) {
    const salaryPayment = await staffService.createSalaryPayment(req.tenant!.id, req.body);
    res.status(201).json({ salaryPayment });
  }
};

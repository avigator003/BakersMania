import type { Request, Response } from "express";
import { invoicesService } from "./invoices.service.js";

export const invoicesController = {
  async createFromOrder(req: Request, res: Response) {
    const invoice = await invoicesService.createFromOrder(req.tenant!.id, req.params.orderId);
    res.status(201).json({ invoice });
  },

  async list(req: Request, res: Response) {
    res.json({ invoices: await invoicesService.listInvoices(req.tenant!.id) });
  }
};

import type { Request, Response } from "express";
import { suppliersService } from "./suppliers.service.js";

export const suppliersController = {
  async list(req: Request, res: Response) {
    res.json({ suppliers: await suppliersService.list(req.tenant!.id) });
  },

  async create(req: Request, res: Response) {
    const supplier = await suppliersService.create(req.tenant!.id, req.body);
    res.status(201).json({ supplier });
  },

  async listPurchases(req: Request, res: Response) {
    res.json({
      purchases: await suppliersService.listPurchases(req.tenant!.id, {
        month: req.query.month ? String(req.query.month) : undefined,
        status: req.query.status ? String(req.query.status) : undefined,
        supplierId: req.query.supplierId ? String(req.query.supplierId) : undefined
      })
    });
  },

  async createPurchase(req: Request, res: Response) {
    const purchase = await suppliersService.createPurchase(req.tenant!.id, req.body);
    res.status(201).json({ purchase });
  },

  async addPayment(req: Request, res: Response) {
    const result = await suppliersService.addPayment(req.tenant!.id, req.params.purchaseId, req.body);
    res.status(201).json(result);
  }
};

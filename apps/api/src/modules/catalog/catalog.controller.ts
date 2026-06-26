import type { Request, Response } from "express";
import { catalogService } from "./catalog.service.js";

export const catalogController = {
  async listCategories(req: Request, res: Response) {
    res.json({ categories: await catalogService.listCategories(req.tenant!.id) });
  },

  async createCategory(req: Request, res: Response) {
    const category = await catalogService.createCategory(req.tenant!.id, req.body);
    res.status(201).json({ category });
  },

  async listProducts(req: Request, res: Response) {
    res.json({ products: await catalogService.listProducts(req.tenant!.id, req.auth?.actorType === "bakery_user") });
  },

  async getProduct(req: Request, res: Response) {
    res.json({ product: await catalogService.getProduct(req.tenant!.id, req.params.productId) });
  },

  async listPriceHistory(req: Request, res: Response) {
    res.json({ history: await catalogService.listPriceHistory(req.tenant!.id, req.params.productId) });
  },

  async createProduct(req: Request, res: Response) {
    const product = await catalogService.createProduct(req.tenant!.id, req.body);
    res.status(201).json({ product });
  },

  async updateProduct(req: Request, res: Response) {
    const product = await catalogService.updateProduct(req.tenant!.id, req.params.productId, req.body);
    res.json({ product });
  },

  async upsertCustomerPrice(req: Request, res: Response) {
    const customerPrice = await catalogService.upsertCustomerPrice(req.tenant!.id, req.body);
    res.status(201).json({ customerPrice });
  }
};

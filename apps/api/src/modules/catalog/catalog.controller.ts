import type { Request, Response } from "express";
import { numberQueryParam } from "../../utils/pagination.js";
import { catalogService } from "./catalog.service.js";

export const catalogController = {
  async listCategories(req: Request, res: Response) {
    res.json({ categories: await catalogService.listCategories(req.tenant!.id) });
  },

  async createCategory(req: Request, res: Response) {
    const category = await catalogService.createCategory(req.tenant!.id, req.body);
    res.status(201).json({ category });
  },

  async updateCategory(req: Request, res: Response) {
    const category = await catalogService.updateCategory(req.tenant!.id, req.params.categoryId, req.body);
    res.json({ category });
  },

  async listProducts(req: Request, res: Response) {
    const result = await catalogService.listProducts(req.tenant!.id, {
      includeInactive: req.auth?.actorType === "bakery_user",
      page: numberQueryParam(req.query.page),
      pageSize: numberQueryParam(req.query.pageSize),
      search: req.query.search ? String(req.query.search) : undefined,
      categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined
    });
    res.json(result);
  },

  async getProduct(req: Request, res: Response) {
    res.json({ product: await catalogService.getProduct(req.tenant!.id, req.params.productId) });
  },

  async listPriceHistory(req: Request, res: Response) {
    res.json(await catalogService.listPriceHistory(req.tenant!.id, req.params.productId, {
      page: numberQueryParam(req.query.page),
      pageSize: numberQueryParam(req.query.pageSize)
    }));
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

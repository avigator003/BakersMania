import type { Request, Response } from "express";
import { numberQueryParam } from "../../utils/pagination.js";
import { inventoryService } from "./inventory.service.js";

export const inventoryController = {
  async listItems(req: Request, res: Response) {
    res.json(await inventoryService.listItems(req.tenant!.id, {
      page: numberQueryParam(req.query.page),
      pageSize: numberQueryParam(req.query.pageSize),
      search: req.query.search ? String(req.query.search) : undefined,
      category: req.query.category ? String(req.query.category) : undefined
    }));
  },

  async createItem(req: Request, res: Response) {
    const item = await inventoryService.createItem(req.tenant!.id, req.body);
    res.status(201).json({ item });
  },

  async listItemLedger(req: Request, res: Response) {
    res.json({ ledger: await inventoryService.listItemLedger(req.tenant!.id, req.params.itemId) });
  },

  async adjustItem(req: Request, res: Response) {
    const result = await inventoryService.adjustItem(req.tenant!.id, req.body);
    res.status(201).json(result);
  },

  async productStock(req: Request, res: Response) {
    res.json(await inventoryService.listProductStock(req.tenant!.id, {
      categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined,
      date: req.query.date ? String(req.query.date) : undefined,
      month: req.query.month ? String(req.query.month) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      page: numberQueryParam(req.query.page),
      pageSize: numberQueryParam(req.query.pageSize)
    }));
  },

  async adjustProductStock(req: Request, res: Response) {
    const product = await inventoryService.adjustProductStock(req.tenant!.id, req.body);
    res.json({ product });
  }
};

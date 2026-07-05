import type { Request, Response } from "express";
import { numberQueryParam } from "../../utils/pagination.js";
import { financeService } from "./finance.service.js";

export const financeController = {
  async listExpenses(req: Request, res: Response) {
    const result = await financeService.listExpenses(req.tenant!.id, {
      month: req.query.month ? String(req.query.month) : undefined,
      type: req.query.type ? String(req.query.type) : undefined,
      status: req.query.status ? String(req.query.status) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      page: numberQueryParam(req.query.page),
      pageSize: numberQueryParam(req.query.pageSize)
    });
    res.json(result);
  },

  async createExpense(req: Request, res: Response) {
    const expense = await financeService.createExpense(req.tenant!.id, req.body);
    res.status(201).json({ expense });
  },

  async updateExpenseStatus(req: Request, res: Response) {
    const expense = await financeService.updateExpenseStatus(req.tenant!.id, req.params.expenseId, req.body);
    res.json({ expense });
  }
};

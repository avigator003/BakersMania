import type { Request, Response } from "express";
import { numberQueryParam } from "../../utils/pagination.js";
import { customersService } from "./customers.service.js";

export const customersController = {
  async list(req: Request, res: Response) {
    const result = await customersService.listCustomers(req.auth, req.tenant!.id, {
      page: numberQueryParam(req.query.page),
      pageSize: numberQueryParam(req.query.pageSize),
      search: req.query.search ? String(req.query.search) : undefined,
      passwordScope: req.query.passwordScope === "all" ? "all" : undefined
    });
    res.json(result);
  },

  async create(req: Request, res: Response) {
    const customer = await customersService.createCustomer(req.auth?.actorType, req.tenant!.id, req.body);
    res.status(201).json({ customer });
  },

  async me(req: Request, res: Response) {
    res.json({ profile: await customersService.getMyProfile(req.auth, req.tenant!.id) });
  },

  async updateMe(req: Request, res: Response) {
    res.json({ customer: await customersService.updateMyProfile(req.auth, req.tenant!.id, req.body) });
  },

  async updateMyPassword(req: Request, res: Response) {
    res.json({ result: await customersService.updateMyPassword(req.auth, req.tenant!.id, req.body) });
  },

  async resetPassword(req: Request, res: Response) {
    res.json({ result: await customersService.resetCustomerPassword(req.auth, req.tenant!.id, req.params.customerId, req.body) });
  },

  async update(req: Request, res: Response) {
    const customer = await customersService.updateCustomer(req.auth?.actorType, req.tenant!.id, req.params.customerId, req.body);
    res.json({ customer });
  },

  async ledger(req: Request, res: Response) {
    res.json({ ledger: await customersService.getLedger(req.tenant!.id, req.params.customerId) });
  }
};

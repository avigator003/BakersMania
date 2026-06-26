import type { Request, Response } from "express";
import { ordersService } from "./orders.service.js";

export const ordersController = {
  async list(req: Request, res: Response) {
    res.json({
      orders: await ordersService.listOrders(req.tenant!.id, req.auth, {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
        customerId: req.query.customerId ? String(req.query.customerId) : undefined,
        routeId: req.query.routeId ? String(req.query.routeId) : undefined
      })
    });
  },

  async create(req: Request, res: Response) {
    const order = await ordersService.createOrder(req.tenant!.id, req.auth, req.body);
    res.status(201).json({ order });
  },

  async update(req: Request, res: Response) {
    const order = await ordersService.updateOrder(req.tenant!.id, req.auth, req.params.orderId, req.body);
    res.json({ order });
  },

  async updateStatus(req: Request, res: Response) {
    const order = await ordersService.updateOrderStatus(req.tenant!.id, req.auth, req.params.orderId, req.body);
    res.json({ order });
  },

  async repeat(req: Request, res: Response) {
    res.status(201).json({ result: await ordersService.repeatOrders(req.tenant!.id, req.auth, req.body) });
  },

  async routeStatement(req: Request, res: Response) {
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      statement: await ordersService.routeStatement(req.tenant!.id, {
        startDate: req.query.startDate ? String(req.query.startDate) : today,
        endDate: req.query.endDate ? String(req.query.endDate) : today,
        routeId: req.query.routeId ? String(req.query.routeId) : undefined
      })
    });
  },

  async truckLoading(req: Request, res: Response) {
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      truckLoading: await ordersService.truckLoading(req.tenant!.id, {
        date: req.query.date ? String(req.query.date) : today,
        categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined
      })
    });
  }
};

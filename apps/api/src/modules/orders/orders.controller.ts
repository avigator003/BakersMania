import type { Request, Response } from "express";
import { ordersService } from "./orders.service.js";

function listParam(value: unknown) {
  if (!value) return undefined;
  return String(value).split(",").map((item) => item.trim()).filter((item) => item && item !== "all");
}

function numberParam(value: unknown) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function orderStatusParam(value: unknown) {
  if (value === "accepted" || value === "pending") return value;
  return undefined;
}

export const ordersController = {
  async list(req: Request, res: Response) {
    const result = await ordersService.listOrders(req.tenant!.id, req.auth, {
      startDate: req.query.startDate ? String(req.query.startDate) : undefined,
      endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      customerId: req.query.customerId ? String(req.query.customerId) : undefined,
      routeId: req.query.routeId ? String(req.query.routeId) : undefined,
      customerIds: listParam(req.query.customerIds),
      routeIds: listParam(req.query.routeIds),
      search: req.query.search ? String(req.query.search) : undefined,
      orderStatus: orderStatusParam(req.query.orderStatus),
      page: numberParam(req.query.page),
      pageSize: numberParam(req.query.pageSize)
    });
    res.json({
      orders: result.items,
      statusCounts: result.statusCounts,
      pagination: {
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        pageCount: result.pageCount
      }
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

  async createVehicleBakeryOrder(req: Request, res: Response) {
    const order = await ordersService.createVehicleBakeryOrder(req.tenant!.id, req.auth, req.body);
    res.status(201).json({ order });
  },

  async routeStatement(req: Request, res: Response) {
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      statement: await ordersService.routeStatement(req.tenant!.id, req.auth, {
        startDate: req.query.startDate ? String(req.query.startDate) : today,
        endDate: req.query.endDate ? String(req.query.endDate) : today,
        routeId: req.query.routeId ? String(req.query.routeId) : undefined,
        routeIds: listParam(req.query.routeIds)
      })
    });
  },

  async routeInvoices(req: Request, res: Response) {
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      routeInvoices: await ordersService.routeInvoiceSummary(req.tenant!.id, req.auth, req.query.date ? String(req.query.date) : today)
    });
  },

  async recordRouteInvoicePayment(req: Request, res: Response) {
    res.status(201).json({
      result: await ordersService.recordRouteInvoicePayment(req.tenant!.id, req.auth, req.params.routeId, req.body)
    });
  },

  async setRouteInvoiceLock(req: Request, res: Response) {
    res.json({
      lock: await ordersService.setRouteInvoiceLock(req.tenant!.id, req.auth, req.params.routeId, req.body)
    });
  },

  async recordCustomerPayment(req: Request, res: Response) {
    res.status(201).json({
      result: await ordersService.recordCustomerPayment(req.tenant!.id, req.auth, req.params.customerId, req.body)
    });
  },

  async customerDaySummary(req: Request, res: Response) {
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      summary: await ordersService.customerDaySummary(req.tenant!.id, req.auth, req.query.date ? String(req.query.date) : today)
    });
  },

  async truckLoading(req: Request, res: Response) {
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      truckLoading: await ordersService.truckLoading(req.tenant!.id, {
        date: req.query.date ? String(req.query.date) : today,
        categoryId: req.query.categoryId ? String(req.query.categoryId) : undefined,
        groupBy: req.query.groupBy ? String(req.query.groupBy) : undefined,
        orderStatus: req.query.orderStatus === "accepted" || req.query.orderStatus === "pending" ? req.query.orderStatus : undefined
      }, req.auth)
    });
  }
};

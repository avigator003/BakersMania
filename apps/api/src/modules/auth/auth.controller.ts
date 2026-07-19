import type { Request, Response } from "express";
import { authService } from "./auth.service.js";

export const authController = {
  async login(req: Request, res: Response) {
    res.json(await authService.login(req.body));
  },

  async signupCustomer(req: Request, res: Response) {
    res.status(201).json(await authService.signupCustomer(req.body));
  },

  async me(req: Request, res: Response) {
    res.json(await authService.getSession(req.auth!));
  },

  async updateMyPassword(req: Request, res: Response) {
    res.json({ result: await authService.updateMyPassword(req.auth!, req.body) });
  }
};

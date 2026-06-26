import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http.js";

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    res.status(422).json({
      error: "Validation failed",
      requestId: req.requestId,
      details: error.flatten()
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.message,
      requestId: req.requestId,
      details: error.details
    });
    return;
  }

  console.error({ requestId: req.requestId, error });
  res.status(500).json({
    error: "Internal server error",
    requestId: req.requestId
  });
};

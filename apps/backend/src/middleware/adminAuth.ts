import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../services/authService.js";

export interface AdminRequest extends Request {
  admin?: {
    id: string;
    email: string;
    role: "admin";
  };
}

export function requireAdmin(req: AdminRequest, res: Response, next: NextFunction): void {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";

  if (!token) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }

  try {
    const claims = verifyAccessToken(token);
    req.admin = { id: claims.sub, email: claims.email, role: "admin" };
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
}

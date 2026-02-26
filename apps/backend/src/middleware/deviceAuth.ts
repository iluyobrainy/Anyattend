import type { NextFunction, Request, Response } from "express";
import { resolveDeviceFromToken } from "../services/deviceAuthService.js";

export interface DeviceRequest extends Request {
  device?: {
    id: string;
    label: string;
  };
}

export async function requireDevice(req: DeviceRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.header("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";

  if (!token) {
    res.status(401).json({ error: "Missing device token" });
    return;
  }

  const device = await resolveDeviceFromToken(token);
  if (!device) {
    res.status(401).json({ error: "Invalid device token" });
    return;
  }

  req.device = device;
  next();
}

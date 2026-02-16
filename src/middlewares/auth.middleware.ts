import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model";

export interface JwtUserPayload {
  id: string;
  role: "admin" | "viewer";
  passwordMustChange: boolean;
}

export interface AuthRequest extends Request {
  user?: JwtUserPayload;
}

export const auth = (req: AuthRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;

  if (req.cookies?.access_token) {
    token = req.cookies.access_token;
  } else if (req.headers.authorization) {
    const [type, value] = req.headers.authorization.split(" ");
    if (type === "Bearer" && value) token = value;
  }

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtUserPayload;

    req.user = {
      id: decoded.id,
      role: decoded.role,
      passwordMustChange: decoded.passwordMustChange,
    };

    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};


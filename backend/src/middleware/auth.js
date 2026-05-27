import jwt from "jsonwebtoken";
import { config } from "../config.js";

export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!token) {
    return res.status(401).json({
      ok: false,
      message: "Sesión requerida."
    });
  }

  try {
    req.session = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({
      ok: false,
      message: "Sesión inválida o expirada."
    });
  }
}

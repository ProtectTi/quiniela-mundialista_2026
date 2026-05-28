import { config } from "../config.js";

const IDENTITY_TOOLKIT_URL = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${config.firebase.apiKey}`;

async function lookupFirebaseUser(idToken) {
  const response = await fetch(IDENTITY_TOOLKIT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ idToken })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error?.message || "No fue posible validar la sesion admin.");
  }

  return Array.isArray(data.users) ? data.users[0] || null : null;
}

export async function requireFirebaseAdmin(req, res, next) {
  try {
    const authHeader = String(req.headers.authorization || "");
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : "";

    if (!token) {
      res.status(401).json({
        ok: false,
        message: "Sesion admin requerida."
      });
      return;
    }

    const user = await lookupFirebaseUser(token);
    if (!user) {
      res.status(401).json({
        ok: false,
        message: "Sesion admin invalida."
      });
      return;
    }

    if (String(user.email || "").toLowerCase() !== String(config.adminEmail).toLowerCase()) {
      res.status(403).json({
        ok: false,
        message: "Usuario admin no autorizado."
      });
      return;
    }

    req.firebaseAdmin = user;
    next();
  } catch (error) {
    res.status(401).json({
      ok: false,
      message: error.message || "No fue posible validar la sesion admin."
    });
  }
}

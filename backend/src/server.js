import cors from "cors";
import express from "express";
import { config, validateConfig } from "./config.js";
import { requireFirebaseAdmin } from "./middleware/firebase-admin.js";
import { requireAuth } from "./middleware/auth.js";
import {
  getManualRegistrationProfile,
  loginWithIntranetCredentials
} from "./services/auth.service.js";
import { getTenantConfigForHostname, normalizeHostname } from "./services/tenant.service.js";
import { getWinnersReport } from "./services/winners.service.js";

validateConfig();

const app = express();

app.use(cors());
app.use(express.json());

function getRequestedHostname(req) {
  return normalizeHostname(
    req.body?.hostname ||
      req.query?.hostname ||
      req.headers["x-tenant-host"] ||
      req.headers["x-forwarded-host"] ||
      req.headers.host ||
      ""
  );
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "quiniela-backend"
  });
});

app.get("/api/public/tenant-config", (req, res) => {
  res.json({
    ok: true,
    ...getTenantConfigForHostname(getRequestedHostname(req))
  });
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    const result = await loginWithIntranetCredentials(
      username,
      password,
      getRequestedHostname(req)
    );

    res.json({
      ok: true,
      token: result.token,
      profile: result.profile
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/manual-registration-profile", async (req, res, next) => {
  try {
    const { idEmployee } = req.body || {};
    const profile = await getManualRegistrationProfile(idEmployee, getRequestedHostname(req));

    res.json({
      ok: true,
      profile
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({
    ok: true,
    session: req.session
  });
});

app.post("/api/auth/logout", requireAuth, (_req, res) => {
  res.json({
    ok: true,
    message: "Sesion cerrada en cliente."
  });
});

app.get("/api/admin/winners", requireFirebaseAdmin, async (req, res, next) => {
  try {
    const hostname = getRequestedHostname(req);
    const tenantConfig = getTenantConfigForHostname(hostname);

    const report = await getWinnersReport(req.query, {
      forceRefresh: req.query.refresh === "1",
      tenantFilter: tenantConfig?.tenant || null
    });

    res.json({
      ok: true,
      report
    });
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    ok: false,
    message: err.message || "Error interno del servidor.",
    code: err.code || "INTERNAL_ERROR",
    suggestedTenant: err.suggestedTenant || null
  });
});

app.listen(config.port, () => {
  console.log(`Quiniela backend escuchando en http://localhost:${config.port}`);
});

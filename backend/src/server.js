import cors from "cors";
import express from "express";
import { config, validateConfig } from "./config.js";
import { requireFirebaseAdmin } from "./middleware/firebase-admin.js";
import { requireAuth } from "./middleware/auth.js";
import {
  getManualRegistrationProfile,
  loginWithIntranetCredentials
} from "./services/auth.service.js";
import { getWinnersReport } from "./services/winners.service.js";

validateConfig();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    service: "quiniela-backend"
  });
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    const result = await loginWithIntranetCredentials(username, password);

    res.json({
      ok: true,
      token: result.token,
      profile: result.profile
    });
  } catch (error) {
    res.status(401).json({
      ok: false,
      message: error.message || "No fue posible iniciar sesion."
    });
  }
});

app.post("/api/auth/manual-registration-profile", async (req, res) => {
  try {
    const { idEmployee } = req.body || {};
    const profile = await getManualRegistrationProfile(idEmployee);

    res.json({
      ok: true,
      profile
    });
  } catch (error) {
    res.status(400).json({
      ok: false,
      message: error.message || "No fue posible validar el registro manual."
    });
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
    const report = await getWinnersReport(req.query, {
      forceRefresh: req.query.refresh === "1"
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
  res.status(500).json({
    ok: false,
    message: "Error interno del servidor."
  });
});

app.listen(config.port, () => {
  console.log(`Quiniela backend escuchando en http://localhost:${config.port}`);
});

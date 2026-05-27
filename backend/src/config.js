import dotenv from "dotenv";

dotenv.config();

const toBool = (value, fallback = false) => {
  if (value === undefined) return fallback;
  return String(value).toLowerCase() === "true";
};

export const config = {
  port: Number(process.env.PORT || 3100),
  jwtSecret: process.env.JWT_SECRET || "change-me",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "12h",
  adminEmail: process.env.ADMIN_EMAIL || "admin@quiniela.com",
  winnersCacheMs: Number(process.env.WINNERS_CACHE_MS || 30000),
  firebase: {
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyBkOqWfEpPNDun1jHJNV0g1creQAUCdgMo",
    projectId: process.env.FIREBASE_PROJECT_ID || "quiniela-mundialista-202-bff2f"
  },
  sql: {
    user: process.env.SQLSERVER_USER || "",
    password: process.env.SQLSERVER_PASSWORD || "",
    server: process.env.SQLSERVER_HOST || "",
    database: process.env.SQLSERVER_DATABASE || "",
    port: Number(process.env.SQLSERVER_PORT || 1433),
    options: {
      encrypt: toBool(process.env.SQLSERVER_ENCRYPT, false),
      trustServerCertificate: toBool(process.env.SQLSERVER_TRUST_CERT, true)
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    }
  }
};

export function validateConfig() {
  const missing = [];

  if (!config.jwtSecret || config.jwtSecret === "change-me") {
    missing.push("JWT_SECRET");
  }

  if (!config.sql.user) missing.push("SQLSERVER_USER");
  if (!config.sql.password) missing.push("SQLSERVER_PASSWORD");
  if (!config.sql.server) missing.push("SQLSERVER_HOST");
  if (!config.sql.database) missing.push("SQLSERVER_DATABASE");

  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(", ")}`);
  }
}

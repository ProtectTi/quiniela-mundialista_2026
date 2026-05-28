import { TENANT_SEED } from "../data/tenants.seed.js";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

function buildPublicUrl(hostname) {
  return `https://${hostname}`;
}

function normalizeString(value) {
  return String(value || "").trim();
}

export function normalizeHostname(value) {
  const raw = normalizeString(value).toLowerCase();
  if (!raw) return "";

  let normalized = raw
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");

  return normalized;
}

export function isLocalHostname(hostname) {
  return LOCAL_HOSTS.has(normalizeHostname(hostname));
}

function toPublicTenant(tenant) {
  if (!tenant) return null;

  const primaryHostname = tenant.hostnames[0] || "";

  return {
    tenantId: tenant.tenantId,
    active: tenant.active,
    mode: tenant.mode,
    countryId: tenant.countryId,
    countryCode: tenant.countryCode,
    countryName: tenant.countryName,
    businessUnitIds: [...tenant.businessUnitIds],
    brandName: tenant.brandName,
    loginTitle: tenant.loginTitle,
    loginSubtitle: tenant.loginSubtitle,
    logoUrl: tenant.logoUrl,
    hostnames: [...tenant.hostnames],
    primaryHostname,
    publicUrl: primaryHostname ? buildPublicUrl(primaryHostname) : ""
  };
}

function profileCountryId(profile) {
  return Number(profile?.country?.id || profile?.countryId || profile?.id_country || 0);
}

function profileBusinessUnitId(profile) {
  return Number(
    profile?.businessUnit?.id || profile?.businessUnitId || profile?.id_business_unit || 0
  );
}

function matchesTenant(profile, tenant) {
  if (!tenant?.active) return false;
  if (profileCountryId(profile) !== Number(tenant.countryId)) return false;

  if (tenant.mode === "country") {
    return true;
  }

  const businessUnitId = profileBusinessUnitId(profile);
  return tenant.businessUnitIds.includes(businessUnitId);
}

function buildMismatchMessage(suggestedTenant) {
  if (suggestedTenant?.publicUrl) {
    return `Tu usuario no pertenece a esta liga. Usa ${suggestedTenant.publicUrl}.`;
  }

  return "Tu usuario no pertenece a una liga habilitada para esta quiniela.";
}

export function listConfiguredTenants() {
  return TENANT_SEED.filter(tenant => tenant.active).map(toPublicTenant);
}

export function resolveTenantByHostname(hostname) {
  const normalizedHostname = normalizeHostname(hostname);
  if (!normalizedHostname) return null;

  const tenant = TENANT_SEED.find(item =>
    item.active &&
    item.hostnames.some(host => normalizeHostname(host) === normalizedHostname)
  );

  return tenant || null;
}

export function findSuggestedTenant(profile) {
  const matches = TENANT_SEED.filter(tenant => matchesTenant(profile, tenant));
  if (matches.length !== 1) {
    return null;
  }

  return toPublicTenant(matches[0]);
}

export function getTenantConfigForHostname(hostname) {
  const normalizedHostname = normalizeHostname(hostname);
  const tenant = resolveTenantByHostname(normalizedHostname);

  if (!tenant) {
    return {
      resolved: false,
      hostname: normalizedHostname,
      tenant: null
    };
  }

  return {
    resolved: true,
    hostname: normalizedHostname,
    tenant: toPublicTenant(tenant)
  };
}

export function validateProfileAgainstHostname(profile, hostname) {
  const normalizedHostname = normalizeHostname(hostname);

  if (!normalizedHostname || isLocalHostname(normalizedHostname)) {
    return {
      hostname: normalizedHostname,
      tenant: null,
      suggestedTenant: findSuggestedTenant(profile)
    };
  }

  const tenant = resolveTenantByHostname(normalizedHostname);
  if (!tenant) {
    const error = new Error("Esta liga no esta configurada.");
    error.statusCode = 400;
    error.code = "TENANT_NOT_FOUND";
    throw error;
  }

  if (!matchesTenant(profile, tenant)) {
    const suggestedTenant = findSuggestedTenant(profile);
    const error = new Error(buildMismatchMessage(suggestedTenant));
    error.statusCode = 403;
    error.code = "TENANT_MISMATCH";
    error.suggestedTenant = suggestedTenant;
    throw error;
  }

  return {
    hostname: normalizedHostname,
    tenant: toPublicTenant(tenant),
    suggestedTenant: null
  };
}

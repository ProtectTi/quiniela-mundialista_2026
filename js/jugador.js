import {
  collection,
  doc,
  query,
  where,
  getDocs,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.7.1/firebase-firestore.js";

import { db } from "./firebase/config.js";

const MAX_INTENTOS = 5;
const BLOQUEO_MS = 5 * 60 * 1000;

function resolveApiBaseUrl() {
  const override = localStorage.getItem("quiniela_api_url");
  if (override) {
    return String(override).replace(/\/+$/, "");
  }

  const hostname = window.location.hostname;
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1";

  if (isLocal) {
    return "http://localhost:3100/api";
  }

  return `${window.location.origin}/api`;
}

function resolveTenantHostname() {
  const override = localStorage.getItem("quiniela_tenant_host");
  if (override) {
    return String(override).trim().toLowerCase();
  }

  return String(window.location.hostname || "").trim().toLowerCase();
}

const API_BASE_URL = resolveApiBaseUrl();
const TENANT_HOSTNAME = resolveTenantHostname();

let registroProfileCache = null;
let registroProfileCacheKey = "";
let registroSuggestedUsername = "";
let tenantConfig = null;

function getIntentosData() {
  try {
    return JSON.parse(localStorage.getItem("login_intentos") || '{"count":0,"hasta":0}');
  } catch {
    return { count: 0, hasta: 0 };
  }
}

function registrarIntentoFallido() {
  const data = getIntentosData();
  data.count++;
  if (data.count >= MAX_INTENTOS) data.hasta = Date.now() + BLOQUEO_MS;
  localStorage.setItem("login_intentos", JSON.stringify(data));
}

function limpiarIntentos() {
  localStorage.removeItem("login_intentos");
}

function verificarBloqueo() {
  const data = getIntentosData();
  if (data.count >= MAX_INTENTOS) {
    const restante = data.hasta - Date.now();
    if (restante > 0) {
      const mins = Math.ceil(restante / 60000);
      return `Demasiados intentos fallidos. Espera ${mins} minuto${mins > 1 ? "s" : ""} e intenta de nuevo.`;
    }
    limpiarIntentos();
  }
  return null;
}

async function hashPassword(pass) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pass);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

function showAlert(msg, tipo) {
  const el = document.getElementById("alertMsg");
  el.textContent = msg;
  el.className = `alert-custom ${tipo} show`;
}

function hideAlert() {
  document.getElementById("alertMsg").className = "alert-custom";
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner-border spinner-border-sm me-2" role="status"></span>Cargando...'
    : btn.dataset.label;
}

function buildPlayerDocId(idEmployee) {
  return `emp-${idEmployee}`;
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeUsernamePart(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildUsernameBase(fullName, idEmployee) {
  const normalized = normalizeUsernamePart(fullName);
  if (!normalized) {
    return `jugador_${idEmployee}`;
  }
  return normalized.slice(0, 30);
}

function setRegistroPreview(profile) {
  const preview = document.getElementById("reg-nombre-preview");
  if (!preview) return;

  if (!profile) {
    preview.style.display = "none";
    preview.textContent = "";
    return;
  }

  preview.style.display = "block";
  preview.textContent = `Nombre detectado: ${normalizeName(profile.fullName)}`;
}

async function findAvailableUsername(baseUsername, idEmployee) {
  const cleanBase = normalizeUsernamePart(baseUsername) || `jugador_${idEmployee}`;
  const direct = cleanBase.slice(0, 30);

  const directSnap = await getDocs(
    query(collection(db, "jugadores"), where("usuario", "==", direct))
  );
  if (directSnap.empty) return direct;

  const suffix = `_${idEmployee}`;
  const prefixed = `${cleanBase.slice(0, Math.max(3, 30 - suffix.length))}${suffix}`.slice(0, 30);
  const prefixedSnap = await getDocs(
    query(collection(db, "jugadores"), where("usuario", "==", prefixed))
  );
  if (prefixedSnap.empty) return prefixed;

  for (let index = 2; index <= 20; index++) {
    const numberedSuffix = `_${index}`;
    const candidate = `${cleanBase.slice(0, Math.max(3, 30 - numberedSuffix.length))}${numberedSuffix}`.slice(0, 30);
    const snap = await getDocs(
      query(collection(db, "jugadores"), where("usuario", "==", candidate))
    );
    if (snap.empty) return candidate;
  }

  return prefixed;
}

function buildTenantAwareMessage(errorData) {
  const suggestedUrl = errorData?.suggestedTenant?.publicUrl;
  if (suggestedUrl) {
    return `${errorData.message || "Tu usuario no pertenece a esta liga."} Liga sugerida: ${suggestedUrl}`;
  }

  return errorData?.message || "Error de comunicacion con el servidor.";
}

async function fetchApi(path, body) {
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...(body || {}),
        hostname: TENANT_HOSTNAME
      })
    });
  } catch {
    throw new Error("No fue posible conectar con el servidor.");
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.ok) {
    throw new Error(buildTenantAwareMessage(data));
  }

  return data;
}

async function fetchTenantConfig() {
  const url = new URL(`${API_BASE_URL}/public/tenant-config`);
  url.searchParams.set("hostname", TENANT_HOSTNAME);

  const response = await fetch(url.toString());
  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.ok) {
    throw new Error(data.message || "No fue posible cargar la configuracion de la liga.");
  }

  return data;
}

function applyTenantBranding(tenant) {
  const titleEl = document.getElementById("tenant-title");
  const subtitleEl = document.getElementById("tenant-subtitle");
  const captionEl = document.getElementById("tenant-caption");
  const logoWrapEl = document.getElementById("tenant-logo-wrap");
  const logoEl = document.getElementById("tenant-logo");

  if (!tenant) {
    document.title = "Quiniela Mundialista 2026";
    if (titleEl) titleEl.textContent = "Quiniela Mundialista";
    if (subtitleEl) subtitleEl.textContent = "Copa Mundial de la FIFA 2026";
    if (captionEl) {
      captionEl.hidden = true;
      captionEl.textContent = "";
    }
    if (logoWrapEl) logoWrapEl.hidden = true;
    return;
  }

  tenantConfig = tenant;
  document.title = tenant.loginTitle || tenant.brandName || "Quiniela Mundialista 2026";
  if (titleEl) titleEl.textContent = tenant.loginTitle || tenant.brandName || "Quiniela Mundialista";
  if (subtitleEl) subtitleEl.textContent = tenant.loginSubtitle || "Ingresa con tu usuario de intranet";

  if (captionEl) {
    captionEl.hidden = false;
    captionEl.textContent = tenant.primaryHostname || TENANT_HOSTNAME;
  }

  if (logoWrapEl && logoEl && tenant.logoUrl) {
    logoWrapEl.hidden = false;
    logoEl.src = tenant.logoUrl;
    logoEl.alt = tenant.brandName ? `Logo ${tenant.brandName}` : "Logo de la liga";
  } else if (logoWrapEl) {
    logoWrapEl.hidden = true;
  }
}

async function initTenantBranding() {
  try {
    const data = await fetchTenantConfig();
    applyTenantBranding(data.tenant || null);
  } catch (error) {
    console.warn(error);
    applyTenantBranding(null);
  }
}

async function prefillRegistrationProfile(force = false) {
  const idEmployee = document.getElementById("reg-idemployee").value.trim();
  const usuarioInput = document.getElementById("reg-usuario");
  const previousCacheKey = registroProfileCacheKey;

  if (!idEmployee || !/^\d+$/.test(idEmployee)) {
    registroProfileCache = null;
    registroProfileCacheKey = "";
    registroSuggestedUsername = "";
    setRegistroPreview(null);
    if (usuarioInput) usuarioInput.value = "";
    return null;
  }

  if (!force && registroProfileCache && registroProfileCacheKey === idEmployee) {
    return registroProfileCache;
  }

  const response = await fetchApi("/auth/manual-registration-profile", {
    idEmployee: Number(idEmployee)
  });

  registroProfileCache = response.profile;
  registroProfileCacheKey = idEmployee;
  setRegistroPreview(response.profile);

  if (usuarioInput) {
    const currentValue = usuarioInput.value.trim();
    const generated = await findAvailableUsername(
      buildUsernameBase(response.profile.fullName, response.profile.idEmployee),
      response.profile.idEmployee
    );
    const shouldAutofill =
      !currentValue ||
      currentValue === registroSuggestedUsername ||
      previousCacheKey !== idEmployee;

    registroSuggestedUsername = generated;

    if (shouldAutofill) {
      usuarioInput.value = generated;
    }
  }

  return response.profile;
}

function buildPlayerPayload({ profile, usuario, passwordHash, authMode }) {
  const nombre = normalizeName(profile.fullName);

  return {
    nombre,
    nombreKey: nombre.toLowerCase(),
    usuario: String(usuario || "").trim().toLowerCase(),
    password: passwordHash,
    creadoEn: serverTimestamp(),
    authMode,
    idEmployee: profile.idEmployee,
    idPerson: profile.idPerson,
    idUser: profile.idUser || null,
    intranetUsername: profile.username || null,
    tenantId: profile.tenant?.tenantId ?? null,
    tenantHost: profile.tenant?.primaryHostname ?? null,
    tenantBrandName: profile.tenant?.brandName ?? null,
    employeeStatus: profile.employeeStatus ?? null,
    userStatus: profile.userStatus ?? null,
    countryId: profile.country?.id ?? null,
    countryName: profile.country?.name ?? null,
    countryCode: profile.country?.code ?? null,
    businessUnitId: profile.businessUnit?.id ?? null,
    businessUnitName: profile.businessUnit?.name ?? null,
    businessUnitCode: profile.businessUnit?.code ?? null,
    branchId: profile.branch?.id ?? null,
    branchBusinessName: profile.branch?.businessName ?? null,
    branchLegalName: profile.branch?.legalName ?? null,
    departmentId: profile.department?.id ?? null,
    departmentName: profile.department?.name ?? null,
    positionId: profile.position?.id ?? null,
    positionName: profile.position?.name ?? null
  };
}

async function ensureIntranetPlayer(profile, loginUsername) {
  const docId = buildPlayerDocId(profile.idEmployee);
  const docRef = doc(db, "jugadores", docId);
  const placeholderHash = await hashPassword(`intranet:${profile.idEmployee}:${profile.username || loginUsername}`);

  let nombre = normalizeName(profile.fullName);

  await runTransaction(db, async tx => {
    const snap = await tx.get(docRef);
    if (snap.exists()) {
      nombre = snap.data().nombre || nombre;
      tx.set(
        docRef,
        {
          authMode: "intranet",
          idEmployee: profile.idEmployee,
          idPerson: profile.idPerson,
          idUser: profile.idUser || null,
          intranetUsername: profile.username || loginUsername,
          tenantId: profile.tenant?.tenantId ?? null,
          tenantHost: profile.tenant?.primaryHostname ?? null,
          tenantBrandName: profile.tenant?.brandName ?? null,
          employeeStatus: profile.employeeStatus ?? null,
          userStatus: profile.userStatus ?? null,
          countryId: profile.country?.id ?? null,
          countryName: profile.country?.name ?? null,
          countryCode: profile.country?.code ?? null,
          businessUnitId: profile.businessUnit?.id ?? null,
          businessUnitName: profile.businessUnit?.name ?? null,
          businessUnitCode: profile.businessUnit?.code ?? null,
          branchId: profile.branch?.id ?? null,
          branchBusinessName: profile.branch?.businessName ?? null,
          branchLegalName: profile.branch?.legalName ?? null,
          departmentId: profile.department?.id ?? null,
          departmentName: profile.department?.name ?? null,
          positionId: profile.position?.id ?? null,
          positionName: profile.position?.name ?? null,
          ultimoAccesoIntranet: serverTimestamp()
        },
        { merge: true }
      );
      return;
    }

    tx.set(
      docRef,
      buildPlayerPayload({
        profile,
        usuario: profile.username || loginUsername,
        passwordHash: placeholderHash,
        authMode: "intranet"
      })
    );
  });

  return {
    id: docId,
    nombre
  };
}

async function registrarJugadorManual(profile, usuario, passHash) {
  const docId = buildPlayerDocId(profile.idEmployee);
  const docRef = doc(db, "jugadores", docId);
  const nombre = normalizeName(profile.fullName);

  await runTransaction(db, async tx => {
    const snapJugador = await tx.get(docRef);
    if (snapJugador.exists()) {
      throw { code: "empleado_ya_registrado" };
    }

    const snapUsuario = await getDocs(
      query(collection(db, "jugadores"), where("usuario", "==", usuario))
    );

    if (!snapUsuario.empty) {
      throw { code: "usuario_tomado" };
    }

    tx.set(
      docRef,
      buildPlayerPayload({
        profile,
        usuario,
        passwordHash: passHash,
        authMode: "manual"
      })
    );
  });

  return {
    id: docId,
    nombre
  };
}

async function loginManual(usuarioInput, passHash) {
  let snap = await getDocs(
    query(collection(db, "jugadores"), where("usuario", "==", usuarioInput))
  );

  let esMigracion = false;
  if (snap.empty) {
    snap = await getDocs(
      query(collection(db, "jugadores"), where("nombreKey", "==", usuarioInput))
    );
    if (!snap.empty) esMigracion = true;
  }

  if (snap.empty) {
    return { ok: false, reason: "not-found" };
  }

  const docJugador = snap.docs[0];
  const jugador = docJugador.data();

  if (jugador.password !== passHash) {
    return { ok: false, reason: "bad-password" };
  }

  if (esMigracion || !jugador.usuario) {
    localStorage.setItem(
      "migracion_pendiente",
      JSON.stringify({
        id: docJugador.id,
        nombre: jugador.nombre
      })
    );

    return { ok: false, reason: "migration" };
  }

  return {
    ok: true,
    jugador: {
      id: docJugador.id,
      nombre: jugador.nombre
    }
  };
}

window.switchTab = function (tab) {
  hideAlert();
  const isRegister = tab === "register";
  document.getElementById("form-register").style.display = isRegister ? "block" : "none";
  document.getElementById("form-login").style.display = isRegister ? "none" : "block";
  document.getElementById("tab-register").classList.toggle("active", isRegister);
  document.getElementById("tab-login").classList.toggle("active", !isRegister);
};

window.prefillRegistroDesdeEmpleado = async function () {
  hideAlert();

  try {
    await prefillRegistrationProfile(true);
  } catch (e) {
    console.error(e);
    registroProfileCache = null;
    registroProfileCacheKey = "";
    registroSuggestedUsername = "";
    setRegistroPreview(null);
    document.getElementById("reg-usuario").value = "";
    if (String(e.message || "").includes("usuario de intranet activo")) {
      showAlert("Ya tienes acceso con intranet. Usa la pestaña 'Iniciar sesión'.", "error");
    } else {
      showAlert(e.message || "No fue posible validar el ID de empleado.", "error");
    }
  }
};

window.registrar = async function () {
  const idEmployee = document.getElementById("reg-idemployee").value.trim();
  const usuario = document.getElementById("reg-usuario").value.trim().toLowerCase();
  const pass = document.getElementById("reg-pass").value;
  const pass2 = document.getElementById("reg-pass2").value;

  if (!idEmployee) {
    return showAlert("Por favor ingresa tu ID de empleado.", "error");
  }
  if (!/^\d+$/.test(idEmployee)) {
    return showAlert("El ID de empleado solo puede contener números.", "error");
  }
  if (!usuario) {
    return showAlert("Primero valida el ID de empleado para autocompletar el usuario.", "error");
  }
  if (pass.length < 4) {
    return showAlert("La contraseña debe tener al menos 4 caracteres.", "error");
  }
  if (pass !== pass2) {
    return showAlert("Las contraseñas no coinciden.", "error");
  }

  setLoading("btn-register", true);
  hideAlert();

  try {
    const profile = await prefillRegistrationProfile(true);
    if (!profile) {
      throw new Error("No fue posible validar el ID de empleado.");
    }

    const passHash = await hashPassword(pass);
    const jugador = await registrarJugadorManual(profile, usuario, passHash);

    localStorage.setItem("jugador", JSON.stringify(jugador));
    showAlert(`Bienvenido, ${jugador.nombre}. Redirigiendo...`, "success");
    setTimeout(() => {
      window.location.href = "predicciones.html";
    }, 1500);
  } catch (e) {
    console.error(e);
    if (e?.code === "empleado_ya_registrado") {
      showAlert("Ese ID de empleado ya tiene registro en la quiniela.", "error");
    } else if (e?.code === "usuario_tomado") {
      showAlert("Ese usuario ya está en uso. Elige otro e intenta de nuevo.", "error");
    } else {
      showAlert(e.message || "Error al registrar. Intenta de nuevo.", "error");
    }
    setLoading("btn-register", false);
  }
};

window.iniciarSesion = async function () {
  const usuarioInput = document.getElementById("login-usuario").value.trim().toLowerCase();
  const pass = document.getElementById("login-pass").value;

  const mensajeBloqueo = verificarBloqueo();
  if (mensajeBloqueo) return showAlert(mensajeBloqueo, "error");

  if (!usuarioInput) {
    return showAlert("Por favor ingresa tu usuario.", "error");
  }
  if (!pass) {
    return showAlert("Por favor ingresa tu contraseña.", "error");
  }

  setLoading("btn-login", true);
  hideAlert();

  try {
    try {
      const intranet = await fetchApi("/auth/login", {
        username: usuarioInput,
        password: pass
      });

      const jugador = await ensureIntranetPlayer(intranet.profile, usuarioInput);
      limpiarIntentos();
      localStorage.setItem("jugador", JSON.stringify(jugador));
      localStorage.setItem("quiniela_token", intranet.token);
      localStorage.setItem("quiniela_profile", JSON.stringify(intranet.profile));
      if (intranet.profile?.tenant) {
        localStorage.setItem("quiniela_tenant", JSON.stringify(intranet.profile.tenant));
      }
      showAlert(`Hola, ${jugador.nombre}. Redirigiendo...`, "success");
      setTimeout(() => {
        window.location.href = "predicciones.html";
      }, 1500);
      return;
    } catch (intranetError) {
      const passHash = await hashPassword(pass);
      const manual = await loginManual(usuarioInput, passHash);

      if (manual.ok) {
        limpiarIntentos();
        localStorage.removeItem("quiniela_token");
        localStorage.removeItem("quiniela_profile");
        localStorage.setItem("jugador", JSON.stringify(manual.jugador));
        showAlert(`Hola de nuevo, ${manual.jugador.nombre}. Redirigiendo...`, "success");
        setTimeout(() => {
          window.location.href = "predicciones.html";
        }, 1500);
        return;
      }

      if (manual.reason === "migration") {
        showAlert("Necesitas elegir un usuario. Redirigiendo...", "success");
        setTimeout(() => {
          window.location.href = "elegir-usuario.html";
        }, 1500);
        return;
      }

      throw intranetError;
    }
  } catch (e) {
    console.error(e);
    registrarIntentoFallido();
    const data = getIntentosData();
    const restantes = Math.max(0, MAX_INTENTOS - data.count);
    const msgExtra =
      restantes > 0
        ? ` (${restantes} intento${restantes !== 1 ? "s" : ""} restante${restantes !== 1 ? "s" : ""})`
        : " - Bloqueado por 5 min";

    if (String(e.message || "").includes("conectar con el servidor")) {
      showAlert(
        "No fue posible validar el acceso con intranet y tampoco se encontró un registro manual." + msgExtra,
        "error"
      );
    } else {
      showAlert((e.message || "Usuario o contraseña incorrectos.") + msgExtra, "error");
    }

    setLoading("btn-login", false);
  }
};

document.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;
  const loginVisible = document.getElementById("form-login").style.display !== "none";
  loginVisible ? window.iniciarSesion() : window.registrar();
});

document.getElementById("btn-register").dataset.label = "Crear cuenta";
document.getElementById("btn-login").dataset.label = "Entrar";

document.getElementById("reg-idemployee")?.addEventListener("blur", () => {
  if (document.getElementById("form-register").style.display === "none") return;
  window.prefillRegistroDesdeEmpleado();
});

initTenantBranding();

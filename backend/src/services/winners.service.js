import { config } from "../config.js";
import { fetchCollectionDocs } from "./firestore.service.js";

const TOTAL_PARTIDOS_MUNDIAL = 104;

const winnersCache = {
  expiresAt: 0,
  generatedAt: null,
  universe: [],
  totalResultados: 0
};

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeId(value) {
  return value === null || value === undefined || value === "" ? "" : String(value);
}

function normalizeFilters(filters = {}) {
  return {
    nombre: normalizeText(filters.nombre).toLowerCase(),
    idEmployee: normalizeText(filters.idEmployee),
    countryId: normalizeId(filters.countryId),
    businessUnitId: normalizeId(filters.businessUnitId),
    branchId: normalizeId(filters.branchId)
  };
}

function isEligiblePlayer(data = {}) {
  const idEmployee = Number(data.idEmployee);
  if (!Number.isFinite(idEmployee) || idEmployee <= 0) return false;
  if (Number(data.employeeStatus ?? 0) !== 1) return false;

  if (data.authMode === "manual") return true;
  if (data.authMode === "intranet") return Number(data.userStatus ?? 0) === 1;

  if (data.userStatus === null || data.userStatus === undefined || data.userStatus === "") {
    return true;
  }

  return Number(data.userStatus) === 1;
}

function buildOptions(rows, idKey, labelKey) {
  const items = new Map();

  rows.forEach(row => {
    const value = normalizeId(row[idKey]);
    const label = normalizeText(row[labelKey]);
    if (!value || !label) return;
    if (!items.has(value)) {
      items.set(value, label);
    }
  });

  return Array.from(items.entries())
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, "es", { sensitivity: "base" }));
}

function hasOption(items, value) {
  if (!value) return true;
  return items.some(item => item.value === value);
}

function applyFilters(rows, filters) {
  return rows.filter(row => {
    if (filters.countryId && normalizeId(row.countryId) !== filters.countryId) return false;
    if (filters.businessUnitId && normalizeId(row.businessUnitId) !== filters.businessUnitId) return false;
    if (filters.branchId && normalizeId(row.branchId) !== filters.branchId) return false;
    if (filters.idEmployee && normalizeId(row.idEmployee) !== filters.idEmployee) return false;

    if (filters.nombre) {
      const nombre = normalizeText(row.nombre).toLowerCase();
      if (!nombre.includes(filters.nombre)) return false;
    }

    return true;
  });
}

function buildUniverse(jugadoresDocs, prediccionesDocs, resultadosDocs, eliminatoriasDocs) {
  const jugadoresMap = new Map();
  const resultadosGrupoMap = new Map();
  const resultadosElimMap = new Map();

  jugadoresDocs.forEach(({ id, data }) => {
    if (!isEligiblePlayer(data)) return;

    jugadoresMap.set(id, {
      id,
      nombre: normalizeText(data.nombre) || "Sin nombre",
      idEmployee: data.idEmployee ?? null,
      countryId: data.countryId ?? null,
      countryName: normalizeText(data.countryName) || "Sin pais",
      businessUnitId: data.businessUnitId ?? null,
      businessUnitName: normalizeText(data.businessUnitName) || "Sin unidad",
      branchId: data.branchId ?? null,
      branchBusinessName: normalizeText(data.branchBusinessName) || "Sin sucursal",
      aciertos: 0,
      aciertosGrupo: 0,
      aciertosElim: 0,
      picks: 0
    });
  });

  resultadosDocs.forEach(({ data }) => {
    const partidoId = normalizeText(data.partidoId).toLowerCase();
    if (!partidoId || !data.lev) return;
    resultadosGrupoMap.set(partidoId, data.lev);
  });

  eliminatoriasDocs.forEach(({ id, data }) => {
    if (data.ganador) {
      resultadosElimMap.set(id, data.ganador);
    }
  });

  prediccionesDocs.forEach(({ data }) => {
    const jugador = jugadoresMap.get(data.jugadorId);
    if (!jugador) return;

    jugador.picks += 1;

    const resultadoGrupo = resultadosGrupoMap.get(normalizeText(data.partidoId).toLowerCase());
    const resultadoElim = resultadosElimMap.get(normalizeText(data.partidoId));
    const resultadoReal = resultadoGrupo || resultadoElim;

    if (resultadoReal && resultadoReal === data.pick) {
      jugador.aciertos += 1;
      if (resultadoGrupo) jugador.aciertosGrupo += 1;
      if (resultadoElim) jugador.aciertosElim += 1;
    }
  });

  const universe = Array.from(jugadoresMap.values()).sort((a, b) => {
    if (b.aciertos !== a.aciertos) return b.aciertos - a.aciertos;
    if (b.picks !== a.picks) return b.picks - a.picks;
    return a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" });
  });

  return {
    universe,
    totalResultados: resultadosDocs.length + resultadosElimMap.size
  };
}

async function refreshUniverse() {
  const [jugadoresDocs, prediccionesDocs, resultadosDocs, eliminatoriasDocs] = await Promise.all([
    fetchCollectionDocs("jugadores"),
    fetchCollectionDocs("predicciones"),
    fetchCollectionDocs("resultados"),
    fetchCollectionDocs("eliminatorias")
  ]);

  const ranking = buildUniverse(
    jugadoresDocs,
    prediccionesDocs,
    resultadosDocs,
    eliminatoriasDocs
  );

  winnersCache.expiresAt = Date.now() + config.winnersCacheMs;
  winnersCache.generatedAt = new Date().toISOString();
  winnersCache.universe = ranking.universe;
  winnersCache.totalResultados = ranking.totalResultados;

  return {
    ...ranking,
    generatedAt: winnersCache.generatedAt,
    fromCache: false
  };
}

async function getCachedUniverse(forceRefresh = false) {
  if (
    !forceRefresh &&
    winnersCache.generatedAt &&
    Date.now() < winnersCache.expiresAt
  ) {
    return {
      universe: winnersCache.universe,
      totalResultados: winnersCache.totalResultados,
      generatedAt: winnersCache.generatedAt,
      fromCache: true
    };
  }

  return refreshUniverse();
}

function buildContext(filters, labels) {
  const parts = [];

  if (filters.countryId && labels.country) parts.push(`Pais: ${labels.country}`);
  if (filters.businessUnitId && labels.businessUnit) parts.push(`Unidad: ${labels.businessUnit}`);
  if (filters.branchId && labels.branch) parts.push(`Sucursal: ${labels.branch}`);
  if (filters.idEmployee) parts.push(`ID: ${filters.idEmployee}`);
  if (filters.nombre) parts.push(`Nombre: ${filters.nombre}`);

  return parts.length ? parts.join(" · ") : "Universo completo de colaboradores activos";
}

export async function getWinnersReport(rawFilters = {}, options = {}) {
  const { forceRefresh = false } = options;
  const cached = await getCachedUniverse(forceRefresh);
  const initialFilters = normalizeFilters(rawFilters);
  const universe = cached.universe;

  const countryOptions = buildOptions(universe, "countryId", "countryName");
  const appliedFilters = { ...initialFilters };
  if (!hasOption(countryOptions, appliedFilters.countryId)) {
    appliedFilters.countryId = "";
  }

  const universeByCountry = appliedFilters.countryId
    ? universe.filter(row => normalizeId(row.countryId) === appliedFilters.countryId)
    : universe;

  const businessUnitOptions = buildOptions(
    universeByCountry,
    "businessUnitId",
    "businessUnitName"
  );
  if (!hasOption(businessUnitOptions, appliedFilters.businessUnitId)) {
    appliedFilters.businessUnitId = "";
  }

  const universeByBusinessUnit = appliedFilters.businessUnitId
    ? universeByCountry.filter(
        row => normalizeId(row.businessUnitId) === appliedFilters.businessUnitId
      )
    : universeByCountry;

  const branchOptions = buildOptions(
    universeByBusinessUnit,
    "branchId",
    "branchBusinessName"
  );
  if (!hasOption(branchOptions, appliedFilters.branchId)) {
    appliedFilters.branchId = "";
  }

  const filtered = applyFilters(universe, appliedFilters);
  const candidates = filtered.filter(row => row.picks > 0);
  const maxAciertos =
    cached.totalResultados > 0 && candidates.length
      ? Math.max(...candidates.map(row => row.aciertos))
      : 0;
  const coWinners =
    cached.totalResultados > 0 && candidates.length
      ? candidates.filter(row => row.aciertos === maxAciertos)
      : [];

  const selectedLabels = {
    country:
      countryOptions.find(item => item.value === appliedFilters.countryId)?.label || "",
    businessUnit:
      businessUnitOptions.find(item => item.value === appliedFilters.businessUnitId)?.label || "",
    branch:
      branchOptions.find(item => item.value === appliedFilters.branchId)?.label || ""
  };

  return {
    meta: {
      generatedAt: cached.generatedAt,
      fromCache: cached.fromCache,
      totalResultados: cached.totalResultados,
      totalPartidosMundial: TOTAL_PARTIDOS_MUNDIAL,
      isFinalCut: cached.totalResultados >= TOTAL_PARTIDOS_MUNDIAL
    },
    filters: appliedFilters,
    options: {
      countries: countryOptions,
      businessUnits: businessUnitOptions,
      branches: branchOptions
    },
    stats: {
      elegibles: filtered.length,
      conPicks: candidates.length,
      resultados: cached.totalResultados,
      coGanadores: coWinners.length,
      maxAciertos
    },
    labels: {
      contexto: buildContext(appliedFilters, selectedLabels),
      maximo:
        cached.totalResultados > 0
          ? `Maximo de aciertos: ${maxAciertos}`
          : "Aun no hay resultados capturados",
      ranking:
        candidates.length > 0
          ? `Mostrando ${filtered.length} colaboradores · ${candidates.length} con picks`
          : `Mostrando ${filtered.length} colaboradores · sin picks validos`
    },
    coWinners,
    ranking: filtered
  };
}

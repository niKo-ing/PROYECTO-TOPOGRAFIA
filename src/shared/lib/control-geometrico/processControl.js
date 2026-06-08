import { parseStringPromise } from "xml2js";

export async function processControlFiles({ landXmlText, terrainCsvText }) {
  const xml = await parseStringPromise(landXmlText, {
    explicitArray: false,
    trim: true,
    mergeAttrs: true,
  });

  const alignment = extractAlignment(xml);
  const profile = extractProfile(xml);
  const terrainPoints = parseTerrainCsv(terrainCsvText);
  const warnings = [];

  if (alignment.points.length < 2) {
    throw new Error("El LandXML no contiene un eje horizontal utilizable.");
  }
  if (terrainPoints.length === 0) {
    throw new Error("El CSV/TXT no contiene puntos de terreno validos.");
  }

  const hasVerticalProfile = profile.length >= 2;
  if (!hasVerticalProfile) {
    warnings.push(
      "Alineamiento cargado (solo geometria horizontal). No se detecto perfil de elevacion, por lo que el calculo de Delta H no estara disponible",
    );
  }

  const results = terrainPoints.map((point) => {
    const projection = projectPointOnAlignment(point, alignment.points, alignment.stationStart);
    const zDiseno = hasVerticalProfile ? interpolateProfileElevation(profile, projection.pk) : null;
    const deltaH = hasVerticalProfile ? point.z_real - zDiseno : null;

    return {
      id: point.id,
      x: round(point.x, 4),
      y: round(point.y, 4),
      z_real: round(point.z_real, 4),
      pk: round(projection.pk, 4),
      offset: round(projection.offset, 4),
      z_diseno: zDiseno === null ? null : round(zDiseno, 4),
      delta_h: deltaH === null ? null : round(deltaH, 4),
    };
  });

  return { results, warnings, hasVerticalProfile };
}

function extractAlignment(xml) {
  const alignmentNode = firstDefined([
    xml?.LandXML?.Alignments?.Alignment,
    xml?.Alignments?.Alignment,
    findFirstByKey(xml, "Alignment"),
  ]);

  const alignment = Array.isArray(alignmentNode) ? alignmentNode[0] : alignmentNode;
  if (!alignment) {
    throw new Error("No se encontro Alignment en el LandXML.");
  }

  const stationStart = toNumber(
    alignment.staStart ?? alignment.startStation ?? alignment.stationStart ?? alignment.station,
    0,
  );

  const coordGeom = alignment.CoordGeom ?? findFirstByKey(alignment, "CoordGeom");
  const points = dedupePoints([
    ...readPntList2DPoints(coordGeom?.PntList2D),
    ...readLineAndCurvePoints(coordGeom),
  ]);

  return { stationStart, points };
}

function extractProfile(xml) {
  const profilesRoot = firstDefined([
    xml?.LandXML?.Profiles,
    xml?.Profiles,
    findFirstByKey(xml, "Profiles"),
  ]);
  const profileNode = firstDefined([
    profilesRoot?.Profile,
    xml?.LandXML?.Profile,
    xml?.Profile,
    findFirstByKey(xml, "Profile"),
  ]);

  const profile = Array.isArray(profileNode) ? profileNode[0] : profileNode;
  if (!profile) {
    return [];
  }

  const pviPoints = asArray(profile.PVI)
    .map((entry) => {
      const values = parseNumberList(typeof entry === "string" ? entry : entry?._ ?? entry?.value ?? "");
      if (values.length >= 2) {
        return { pk: values[0], z: values[1] };
      }
      return null;
    })
    .filter(Boolean);

  if (pviPoints.length >= 2) {
    return sortProfile(pviPoints);
  }

  const pntList2D = asArray(profile.PntList2D);
  const points = pntList2D
    .flatMap((entry) => {
      const nums = parseNumberList(typeof entry === "string" ? entry : entry?._ ?? "");
      const pairs = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        pairs.push({ pk: nums[i], z: nums[i + 1] });
      }
      return pairs;
    })
    .filter((pt) => Number.isFinite(pt.pk) && Number.isFinite(pt.z));

  return sortProfile(points);
}

function parseTerrainCsv(text) {
  const normalized = String(text ?? "").replace(/\r/g, "").trim();
  if (!normalized) return [];

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const firstCells = splitRow(lines[0], delimiter);
  const hasHeader = firstCells.some((cell) => /[a-zA-Z]/.test(cell));
  const headerMap = hasHeader ? buildHeaderMap(firstCells) : null;

  return lines
    .slice(hasHeader ? 1 : 0)
    .map((line, index) => {
      const cells = splitRow(line, delimiter);
      const id = getCell(cells, headerMap, ["id", "punto", "name", "nombre"], 0) || `P${index + 1}`;
      const x = toNumber(getCell(cells, headerMap, ["x", "este", "easting"], 1));
      const y = toNumber(getCell(cells, headerMap, ["y", "norte", "northing"], 2));
      const z = toNumber(getCell(cells, headerMap, ["z", "cota", "elev", "elevacion"], 3));
      if (![x, y, z].every(Number.isFinite)) return null;
      return { id: String(id).trim(), x, y, z_real: z };
    })
    .filter(Boolean);
}

function readPntList2DPoints(pntList2D) {
  return asArray(pntList2D).flatMap((entry) => {
    const nums = parseNumberList(typeof entry === "string" ? entry : entry?._ ?? "");
    const points = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      points.push({ x: nums[i], y: nums[i + 1] });
    }
    return points;
  });
}

function readLineAndCurvePoints(coordGeom) {
  if (!coordGeom) return [];

  const lines = asArray(coordGeom.Line).flatMap((line) => {
    const start = parseCoordNode(line?.Start);
    const end = parseCoordNode(line?.End);
    return [start, end].filter(Boolean);
  });

  const curves = asArray(coordGeom.Curve).flatMap((curve) => approximateCurve(curve));
  return [...lines, ...curves];
}

function approximateCurve(curve) {
  const start = parseCoordNode(curve?.Start);
  const end = parseCoordNode(curve?.End);
  const center = parseCoordNode(curve?.Center);
  if (!start || !end) return [];
  if (!center) return [start, end];

  const radius = distance2d(start, center);
  if (!Number.isFinite(radius) || radius === 0) return [start, end];

  const startAngle = Math.atan2(start.y - center.y, start.x - center.x);
  let endAngle = Math.atan2(end.y - center.y, end.x - center.x);
  const rot = String(curve.rot ?? curve.dir ?? "").toLowerCase();

  if (rot.includes("cw")) {
    while (endAngle >= startAngle) endAngle -= Math.PI * 2;
  } else {
    while (endAngle <= startAngle) endAngle += Math.PI * 2;
  }

  const sweep = endAngle - startAngle;
  const steps = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 18)));
  const points = [];

  for (let i = 0; i <= steps; i += 1) {
    const angle = startAngle + (sweep * i) / steps;
    points.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }

  return points;
}

function projectPointOnAlignment(point, alignmentPoints, stationStart) {
  let best = null;
  let cumulative = 0;

  for (let i = 0; i < alignmentPoints.length - 1; i += 1) {
    const a = alignmentPoints[i];
    const b = alignmentPoints[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy);
    if (length === 0) continue;

    const ux = dx / length;
    const uy = dy / length;
    const apx = point.x - a.x;
    const apy = point.y - a.y;
    const tRaw = apx * ux + apy * uy;
    const t = clamp(tRaw, 0, length);
    const qx = a.x + ux * t;
    const qy = a.y + uy * t;
    const vx = point.x - qx;
    const vy = point.y - qy;
    const dist = Math.hypot(vx, vy);
    const cross = dx * (point.y - a.y) - dy * (point.x - a.x);
    const offset = Math.sign(cross || 1) * dist;
    const pk = stationStart + cumulative + t;

    if (!best || dist < best.dist) {
      best = { dist, offset, pk };
    }

    cumulative += length;
  }

  if (!best) {
    throw new Error("No se pudo proyectar el punto sobre el eje.");
  }

  return best;
}

function interpolateProfileElevation(profile, pk) {
  if (pk <= profile[0].pk) return profile[0].z;
  if (pk >= profile[profile.length - 1].pk) return profile[profile.length - 1].z;

  for (let i = 0; i < profile.length - 1; i += 1) {
    const a = profile[i];
    const b = profile[i + 1];
    if (pk < a.pk || pk > b.pk) continue;
    const span = b.pk - a.pk;
    if (span === 0) return a.z;
    const factor = (pk - a.pk) / span;
    return a.z + (b.z - a.z) * factor;
  }

  return profile[profile.length - 1].z;
}

function parseCoordNode(node) {
  const raw = typeof node === "string" ? node : node?._ ?? "";
  const nums = parseNumberList(raw);
  if (nums.length < 2) return null;
  return { x: nums[0], y: nums[1] };
}

function parseNumberList(value) {
  return String(value ?? "")
    .trim()
    .split(/[\s,;]+/)
    .map((item) => Number(item))
    .filter(Number.isFinite);
}

function detectDelimiter(line) {
  const candidates = [",", ";", "\t", "|"];
  let winner = ",";
  let bestScore = -1;

  for (const candidate of candidates) {
    const score = line.split(candidate).length;
    if (score > bestScore) {
      bestScore = score;
      winner = candidate;
    }
  }

  return winner;
}

function splitRow(line, delimiter) {
  return String(line ?? "")
    .split(delimiter)
    .map((cell) => cell.trim());
}

function buildHeaderMap(cells) {
  return cells.reduce((acc, cell, index) => {
    acc[normalizeHeader(cell)] = index;
    return acc;
  }, {});
}

function getCell(cells, headerMap, aliases, fallbackIndex) {
  if (headerMap) {
    for (const alias of aliases) {
      const idx = headerMap[normalizeHeader(alias)];
      if (Number.isInteger(idx) && idx >= 0 && idx < cells.length) {
        return cells[idx];
      }
    }
  }
  return cells[fallbackIndex];
}

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function sortProfile(points) {
  return [...points]
    .filter((pt) => Number.isFinite(pt.pk) && Number.isFinite(pt.z))
    .sort((a, b) => a.pk - b.pk);
}

function dedupePoints(points) {
  const unique = [];
  for (const pt of points) {
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) continue;
    const last = unique[unique.length - 1];
    if (last && almostEqual(last.x, pt.x) && almostEqual(last.y, pt.y)) continue;
    unique.push(pt);
  }
  return unique;
}

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function findFirstByKey(value, key) {
  if (!value || typeof value !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(value, key)) {
    return value[key];
  }
  for (const child of Object.values(value)) {
    if (!child || typeof child !== "object") continue;
    const result = findFirstByKey(child, key);
    if (result) return result;
  }
  return null;
}

function firstDefined(values) {
  return values.find((value) => value !== undefined && value !== null);
}

function distance2d(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toNumber(value, fallback = Number.NaN) {
  const num = Number(String(value ?? "").replace(",", "."));
  return Number.isFinite(num) ? num : fallback;
}

function almostEqual(a, b) {
  return Math.abs(a - b) < 1e-9;
}

function round(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

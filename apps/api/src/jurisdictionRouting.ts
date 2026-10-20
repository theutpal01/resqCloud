export type Position = [number, number];
export type PolygonGeometry = {
  type: "Polygon";
  coordinates: Position[][];
};
export type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: Position[][][];
};
export type BoundaryGeometry = PolygonGeometry | MultiPolygonGeometry;
export type BoundaryCandidate = {
  jurisdictionCode: string;
  geometry: BoundaryGeometry;
};
export type JurisdictionSuggestion = {
  status: "suggested" | "ambiguous" | "outside" | "unavailable";
  jurisdictionCode: string | null;
  candidates: string[];
};

type RingRelation = "inside" | "boundary" | "outside";
const EPSILON = 1e-10;

function ringRelation(point: Position, ring: Position[]): RingRelation {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index++
  ) {
    const [x1, y1] = ring[previous]!;
    const [x2, y2] = ring[index]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const cross = (point[0] - x1) * dy - (point[1] - y1) * dx;
    const within =
      point[0] >= Math.min(x1, x2) - EPSILON &&
      point[0] <= Math.max(x1, x2) + EPSILON &&
      point[1] >= Math.min(y1, y2) - EPSILON &&
      point[1] <= Math.max(y1, y2) + EPSILON;
    if (within && Math.abs(cross) <= EPSILON) return "boundary";
    if (y1 > point[1] !== y2 > point[1]) {
      const crossingX = x1 + ((point[1] - y1) * dx) / dy;
      if (point[0] < crossingX) inside = !inside;
    }
  }
  return inside ? "inside" : "outside";
}

function polygonRelation(point: Position, rings: Position[][]): RingRelation {
  if (!rings.length) return "outside";
  const outer = ringRelation(point, rings[0]!);
  if (outer !== "inside") return outer;
  for (const hole of rings.slice(1)) {
    const relation = ringRelation(point, hole);
    if (relation === "boundary") return "boundary";
    if (relation === "inside") return "outside";
  }
  return "inside";
}

function geometryRelation(
  point: Position,
  geometry: BoundaryGeometry,
): RingRelation {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  let contained = false;
  for (const polygon of polygons) {
    const relation = polygonRelation(point, polygon);
    if (relation === "boundary") return "boundary";
    if (relation === "inside") contained = true;
  }
  return contained ? "inside" : "outside";
}

/** Returns only an advisory hint. A border point or overlapping polygons stay unresolved. */
export function suggestJurisdiction(
  latitude: number,
  longitude: number,
  boundaries: BoundaryCandidate[],
): JurisdictionSuggestion {
  if (!boundaries.length)
    return { status: "unavailable", jurisdictionCode: null, candidates: [] };
  const point: Position = [longitude, latitude];
  const matches: string[] = [];
  const boundaryMatches: string[] = [];
  for (const candidate of boundaries) {
    const relation = geometryRelation(point, candidate.geometry);
    if (relation === "inside") matches.push(candidate.jurisdictionCode);
    if (relation === "boundary")
      boundaryMatches.push(candidate.jurisdictionCode);
  }
  matches.sort();
  boundaryMatches.sort();
  if (boundaryMatches.length || matches.length > 1)
    return {
      status: "ambiguous",
      jurisdictionCode: null,
      candidates: [...new Set([...matches, ...boundaryMatches])],
    };
  if (matches.length === 1)
    return {
      status: "suggested",
      jurisdictionCode: matches[0]!,
      candidates: matches,
    };
  return { status: "outside", jurisdictionCode: null, candidates: [] };
}

export function isBoundaryGeometry(value: unknown): value is BoundaryGeometry {
  if (!value || typeof value !== "object") return false;
  const geometry = value as { type?: unknown; coordinates?: unknown };
  if (geometry.type !== "Polygon" && geometry.type !== "MultiPolygon")
    return false;
  const isPosition = (item: unknown): item is Position =>
    Array.isArray(item) &&
    item.length >= 2 &&
    typeof item[0] === "number" &&
    typeof item[1] === "number" &&
    Number.isFinite(item[0]) &&
    Number.isFinite(item[1]) &&
    item[0] >= -180 &&
    item[0] <= 180 &&
    item[1] >= -90 &&
    item[1] <= 90;
  const isRing = (item: unknown): item is Position[] =>
    Array.isArray(item) &&
    item.length >= 4 &&
    item.every(isPosition) &&
    item[0]?.[0] === item.at(-1)?.[0] &&
    item[0]?.[1] === item.at(-1)?.[1];
  const coordinates = geometry.coordinates;
  if (!Array.isArray(coordinates)) return false;
  const polygons = geometry.type === "Polygon" ? [coordinates] : coordinates;
  return (
    polygons.length > 0 &&
    polygons.every(
      (polygon) =>
        Array.isArray(polygon) && polygon.length > 0 && polygon.every(isRing),
    )
  );
}

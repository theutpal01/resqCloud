import { describe, expect, it } from "vitest";
import {
  isBoundaryGeometry,
  suggestJurisdiction,
  type BoundaryCandidate,
} from "../apps/api/src/jurisdictionRouting.js";

const west: BoundaryCandidate = {
  jurisdictionCode: "IN-TN01",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0],
      ],
    ],
  },
};
const east: BoundaryCandidate = {
  jurisdictionCode: "IN-TN02",
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [1, 0],
        [2, 0],
        [2, 1],
        [1, 1],
        [1, 0],
      ],
    ],
  },
};

describe("advisory jurisdiction routing", () => {
  it("suggests a single containing district", () => {
    expect(suggestJurisdiction(0.5, 0.5, [west, east])).toEqual({
      status: "suggested",
      jurisdictionCode: "IN-TN01",
      candidates: ["IN-TN01"],
    });
  });

  it("returns ambiguous on a shared district boundary", () => {
    expect(suggestJurisdiction(0.5, 1, [west, east])).toEqual({
      status: "ambiguous",
      jurisdictionCode: null,
      candidates: ["IN-TN01", "IN-TN02"],
    });
  });

  it("returns outside when no imported district contains the point", () => {
    expect(suggestJurisdiction(3, 3, [west, east])).toEqual({
      status: "outside",
      jurisdictionCode: null,
      candidates: [],
    });
  });

  it("treats overlapping interiors as ambiguous", () => {
    expect(
      suggestJurisdiction(0.5, 0.5, [
        west,
        { ...west, jurisdictionCode: "IN-TN02" },
      ]),
    ).toEqual({
      status: "ambiguous",
      jurisdictionCode: null,
      candidates: ["IN-TN01", "IN-TN02"],
    });
  });

  it("excludes polygon holes and rejects malformed geometry", () => {
    const withHole: BoundaryCandidate = {
      jurisdictionCode: "IN-TN01",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [0, 0],
            [4, 0],
            [4, 4],
            [0, 4],
            [0, 0],
          ],
          [
            [1, 1],
            [3, 1],
            [3, 3],
            [1, 3],
            [1, 1],
          ],
        ],
      },
    };
    expect(suggestJurisdiction(2, 2, [withHole]).status).toBe("outside");
    expect(isBoundaryGeometry({ type: "Polygon", coordinates: [] })).toBe(
      false,
    );
  });
});

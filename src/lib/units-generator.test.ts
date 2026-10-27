import { describe, expect, it } from "vitest";
import {
  autoDetectFloor,
  generateFromRule,
  parseUnitList,
} from "./units-generator";

describe("generateFromRule", () => {
  it("expands a simple prefix range", () => {
    expect(generateFromRule("A", 1, 3)).toEqual([
      { unit_number: "A1", floor: null },
      { unit_number: "A2", floor: null },
      { unit_number: "A3", floor: null },
    ]);
  });

  it("zero-pads numbers and appends a suffix", () => {
    expect(generateFromRule("B", 1, 2, { pad: 2, suffix: "E" })).toEqual([
      { unit_number: "B01E", floor: null },
      { unit_number: "B02E", floor: null },
    ]);
  });

  it("returns nothing for a reversed or invalid range", () => {
    expect(generateFromRule("A", 5, 1)).toEqual([]);
    expect(generateFromRule("A", NaN, 3)).toEqual([]);
  });
});

describe("parseUnitList", () => {
  it("parses names on newlines, commas and semicolons", () => {
    expect(parseUnitList("G1, G2\n3A;3B,,").map((u) => u.unit_number)).toEqual([
      "G1",
      "G2",
      "3A",
      "3B",
    ]);
  });

  it("drops blank entries and de-duplicates case-insensitively", () => {
    expect(parseUnitList("A1\na1\n\n  \nA2").map((u) => u.unit_number)).toEqual([
      "A1",
      "A2",
    ]);
  });

  it("detects ground and numbered floors from the unit name", () => {
    const parsed = parseUnitList("G1, GF2, 2A, B3");
    expect(parsed.map((u) => u.floor)).toEqual(["Ground", "Ground", "2", null]);
  });
});

describe("autoDetectFloor", () => {
  it("maps G and GF names to Ground", () => {
    expect(autoDetectFloor("G1")).toBe("Ground");
    expect(autoDetectFloor("GF2")).toBe("Ground");
  });

  it("uses leading digits as the floor and leaves others blank", () => {
    expect(autoDetectFloor("2A")).toBe("2");
    expect(autoDetectFloor("101")).toBe("101");
    expect(autoDetectFloor("B3")).toBeNull();
  });
});

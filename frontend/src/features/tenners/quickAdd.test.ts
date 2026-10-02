import { describe, expect, it } from "vitest";
import { tenner } from "../../tests/fixtures";
import { findSimilarTenner, normalizeTitle, suggestCategory } from "./quickAdd";

describe("suggestCategory", () => {
  it.each([
    ["Long Zwift Ride", "FITNESS"],
    ["Mobility Session", "FITNESS"],
    ["Clean Exterior Windows", "HOUSEHOLD"],
    ["Büro saugen", "HOUSEHOLD"],
    ["Date night planen", "FAMILY"],
    ["Mit Henry Fußball", "FAMILY"],
    ["Steuererklärung vorbereiten", "FINANCE"],
    ["Rasen mähen", "HOME"],
    ["Zahnarzttermin machen", "PERSONAL"],
  ])("%s → %s", (title, category) => {
    expect(suggestCategory(title)).toBe(category);
  });

  it("returns undefined without a keyword match", () => {
    expect(suggestCategory("Irgendwas Neues")).toBeUndefined();
  });

  it("does not match short keywords inside other words", () => {
    expect(suggestCategory("Radiergummi kaufen")).toBeUndefined();
  });
});

describe("findSimilarTenner", () => {
  const existing = [tenner({ tennerId: "a", title: "Vacuum Office" }), tenner({ tennerId: "b", title: "Wash Car" })];

  it("finds equal titles ignoring case and spaces", () => {
    expect(findSimilarTenner("  vacuum   office ", existing)?.tennerId).toBe("a");
  });

  it("finds titles that contain each other", () => {
    expect(findSimilarTenner("Vacuum Office upstairs", existing)?.tennerId).toBe("a");
    expect(findSimilarTenner("vacuum", existing)?.tennerId).toBe("a");
  });

  it("ignores very short or unrelated titles", () => {
    expect(findSimilarTenner("Car", existing)).toBeUndefined();
    expect(findSimilarTenner("Lawn", existing)).toBeUndefined();
    expect(findSimilarTenner("   ", existing)).toBeUndefined();
  });

  it("normalizes titles", () => {
    expect(normalizeTitle("  Büro   SAUGEN ")).toBe("büro saugen");
  });
});

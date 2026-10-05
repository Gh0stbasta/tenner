import { describe, expect, it } from "vitest";
import { matchScore, matchTenner, normalizeTokens, type MatchCandidate } from "../src/matcher.js";

const tenner = (tennerId: string, title: string, due = false): MatchCandidate => ({ tennerId, title, due });
const HOUSEHOLD = [
  tenner("mob", "Mobility"),
  tenner("buero-s", "Büro saugen", true),
  tenner("buero-a", "Büro aufräumen"),
  tenner("pfl", "Pflanzen gießen", true),
  tenner("glas", "Altglas wegbringen"),
  tenner("tuer", "Haustür putzen"),
];

describe("normalizeTokens", () => {
  it("lowercases, spells out umlauts and drops articles and punctuation", () => {
    expect(normalizeTokens("Die Pflanzen gießen!")).toEqual(["pflanzen", "giessen"]);
    expect(normalizeTokens("das Büro")).toEqual(["buero"]);
  });
});

describe("matchTenner", () => {
  it("matches an exact title clearly (Exact Match Completes)", () => {
    expect(matchTenner("mobility", HOUSEHOLD)).toMatchObject({ kind: "clear", tenner: { tennerId: "mob" } });
  });

  it("matches despite umlaut spelling, articles and plural (Fuzzy Match)", () => {
    expect(matchTenner("die pflanzen giessen", HOUSEHOLD)).toMatchObject({ kind: "clear", tenner: { tennerId: "pfl" } });
    expect(matchTenner("haustüre putzen", HOUSEHOLD)).toMatchObject({ kind: "clear", tenner: { tennerId: "tuer" } });
    expect(matchTenner("das altglas", HOUSEHOLD)).toMatchObject({ kind: "clear", tenner: { tennerId: "glas" } });
  });

  it("asks between close candidates (Ambiguous Match Asks)", () => {
    const result = matchTenner("büro", HOUSEHOLD);
    expect(result.kind).toBe("ambiguous");
    expect(result.kind === "ambiguous" && result.options.map((option) => option.tennerId)).toEqual(["buero-s", "buero-a"]);
  });

  it("asks back for a single uncertain candidate instead of acting", () => {
    expect(matchTenner("pflanzen düngen", HOUSEHOLD)).toMatchObject({ kind: "ambiguous", options: [{ tennerId: "pfl" }] });
  });

  it("finds nothing for unrelated speech (No Match Asks)", () => {
    expect(matchTenner("steuererklärung", HOUSEHOLD)).toMatchObject({ kind: "none" });
    expect(matchTenner("", HOUSEHOLD)).toMatchObject({ kind: "none", score: 0 });
    expect(matchTenner("mobility", [])).toEqual({ kind: "none", score: 0 });
  });

  it("limits the options to three", () => {
    const many = ["Fenster putzen Küche", "Fenster putzen Bad", "Fenster putzen Flur", "Fenster putzen Büro"].map((title, index) => tenner(`f${index}`, title));
    const result = matchTenner("fenster putzen", many);
    expect(result.kind === "ambiguous" && result.options).toHaveLength(3);
  });

  it("scores identical text as 1 and unrelated text near 0", () => {
    expect(matchScore("Mobility", "mobility")).toBe(1);
    expect(matchScore("auto", "pflanzen giessen")).toBeLessThan(0.3);
    expect(matchScore("der", "die")).toBe(0);
  });
});

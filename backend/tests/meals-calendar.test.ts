/** FOOD-015: ICS feed of the meal plan and its token. */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildMealCalendar, createMealServices, DEFAULT_HOUSEHOLD_FOOD_RULES, escapeText, foldLine, foodProfileSchema, type PlanSlotResponse } from "../src/meals/index.js";
import { SEED_MEMBERS } from "../src/models/index.js";
import { validate } from "../src/validators/index.js";
import { inMemoryMeals } from "./mocks/meals.js";
import { TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-14T08:00:00Z");

const slot = (slotId: string, dish: Partial<NonNullable<PlanSlotResponse["dish"]>> | null, status: PlanSlotResponse["status"] = "PLANNED"): PlanSlotResponse =>
  ({
    slotId,
    date: slotId.slice(0, 10),
    weekday: "WED",
    slot: slotId.endsWith("LUNCH") ? "LUNCH" : "DINNER",
    dishId: dish ? "d" : null,
    locked: false,
    source: "AUTO",
    status,
    cost: null,
    dish: dish && { dishId: "d", name: "X", category: "PASTA", lightness: "LIGHT", temperature: "WARM", activeMinutes: 15, totalMinutes: 15, isVegetarian: true, favorite: false, archived: false, ...dish },
  }) as PlanSlotResponse;

function setup() {
  const meals = inMemoryMeals();
  let next = 0;
  const services = createMealServices({
    client: meals.sender,
    tableName: "tenner-meals",
    membersOf: async () => SEED_MEMBERS,
    settingsOf: async () => ({ timezone: "Europe/Berlin", weekStartsOn: "MONDAY" }),
    clock: () => NOW,
    ids: () => `00000000-0000-4000-8000-${String(++next).padStart(12, "0")}`,
  });
  return { meals, services };
}

describe("ICS building", () => {
  it("escapes text and folds long lines at 75 octets without splitting characters", () => {
    expect(escapeText("Nudeln, Soße; mit \\ und\nZeile")).toBe("Nudeln\\, Soße\\; mit \\\\ und\\nZeile");
    const folded = foldLine(`SUMMARY:${"ä".repeat(60)}`);
    const lines = folded.split("\r\n");
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    expect(lines.slice(1).every((line) => line.startsWith(" "))).toBe(true);
    expect(lines.map((line, index) => (index === 0 ? line : line.slice(1))).join("")).toBe(`SUMMARY:${"ä".repeat(60)}`);
  });

  it("creates one 30-minute event per planned meal at the household's times in UTC with stable UIDs", () => {
    const ics = buildMealCalendar({
      slots: [
        slot("2026-10-14#LUNCH", { name: "Onigiri" }),
        slot("2026-10-14#DINNER", { name: "Burger, groß", isVegetarian: false, vegetarianVariant: "mit Veggie-Patty", activeMinutes: 20 }),
        slot("2026-10-15#LUNCH", null),
        slot("2026-10-15#DINNER", { name: "Ausgefallen" }, "SKIPPED"),
        slot("2026-10-26#LUNCH", { name: "Nach der Zeitumstellung" }),
      ],
      mealTimes: { lunch: "12:00", dinner: "18:30" },
      timeZone: "Europe/Berlin",
      now: NOW,
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("REFRESH-INTERVAL;VALUE=DURATION:PT6H\r\nX-PUBLISHED-TTL:PT6H");
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("UID:2026-10-14-LUNCH@meals.zentrale\r\nDTSTAMP:20261014T080000Z\r\nDTSTART:20261014T100000Z\r\nDTEND:20261014T103000Z\r\nSUMMARY:🍽️ Mittag: Onigiri");
    expect(ics).toContain("DTSTART:20261014T163000Z");
    expect(ics).toContain("SUMMARY:🍽️ Abend: Burger\\, groß\r\nDESCRIPTION:20 Min. aktive Kochzeit · vegetarisch: mit Veggie-Patty");
    expect(ics).toContain("DTSTART:20261026T110000Z");
    expect(ics).not.toContain("Ausgefallen");
  });
});

describe("CalendarFeedService", () => {
  async function ready(services: ReturnType<typeof setup>["services"]) {
    await services.catalog.importCatalog(TEST_IDENTITY, false);
    await services.profiles.updateProfile(
      TEST_IDENTITY,
      validate(foodProfileSchema, {
        eaters: [{ eaterId: "a1", name: "Erwachsener 1", type: "ADULT", allergies: ["NUTS"], dislikeTags: ["TOFU"] }],
        household: DEFAULT_HOUSEHOLD_FOOD_RULES,
      }),
    );
  }

  it("creates a token, stores only its hash and serves the feed for it", async () => {
    const { services, meals } = setup();
    await ready(services);
    expect(await services.calendar.status("default")).toEqual({ active: false, createdAt: null });
    const { token } = await services.calendar.createToken(TEST_IDENTITY);
    expect(token).toMatch(/^default\.[A-Za-z0-9_-]{43}$/);
    const secret = token.split(".")[1] ?? "";
    const stored = meals.items.get("default|CALENDAR");
    expect(stored?.tokenHash).toBe(createHash("sha256").update(secret).digest("hex"));
    expect(JSON.stringify(stored)).not.toContain(secret);
    expect(await services.calendar.status("default")).toEqual({ active: true, createdAt: "2026-10-14T08:00:00Z" });
    const ics = await services.calendar.feed(token);
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(28);
    // No profile data: allergies, dislikes, eater names.
    expect(ics).not.toMatch(/NUTS|Nüsse|TOFU|Erwachsener|Allergie/);
  });

  it("keeps UIDs stable when the plan changes", async () => {
    const { services } = setup();
    await ready(services);
    const { token } = await services.calendar.createToken(TEST_IDENTITY);
    const uids = (ics: string) => ics.match(/^UID:.*$/gm);
    const before = await services.calendar.feed(token);
    await services.plans.regenerateWeek(TEST_IDENTITY, "current", {});
    expect(uids(await services.calendar.feed(token))).toEqual(uids(before));
  });

  it("answers 404 for unknown, malformed, other-tenant, replaced and revoked tokens", async () => {
    const { services } = setup();
    await ready(services);
    const first = (await services.calendar.createToken(TEST_IDENTITY)).token;
    const second = (await services.calendar.createToken(TEST_IDENTITY)).token;
    await expect(services.calendar.feed(first)).rejects.toMatchObject({ statusCode: 404 });
    await expect(services.calendar.feed(second)).resolves.toContain("BEGIN:VCALENDAR");
    await expect(services.calendar.feed("nonsense")).rejects.toMatchObject({ statusCode: 404 });
    await expect(services.calendar.feed(second.replace("default.", "other."))).rejects.toMatchObject({ statusCode: 404 });
    await services.calendar.revoke(TEST_IDENTITY);
    await expect(services.calendar.feed(second)).rejects.toMatchObject({ statusCode: 404 });
    expect(await services.calendar.status("default")).toEqual({ active: false, createdAt: null });
    await expect(setup().services.calendar.revoke(TEST_IDENTITY)).resolves.toBeUndefined();
  });
});

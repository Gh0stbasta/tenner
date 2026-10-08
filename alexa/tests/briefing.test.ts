import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_BRIEFING_WORDS, buildBriefing, greetingFor, wordCount, type BriefingDashboard } from "../src/briefing.js";
import { createSkill } from "../src/skill.js";
import { KITCHEN_DAY, dashboard, dashboardTenner } from "./dashboardFixtures.js";
import { PERSON_ID, SKILL_ID, intentRequest } from "./envelopes.js";
import { API_BASE, CONTEXT, fakeApi } from "./fakeApi.js";
import { ssml } from "./ssml.js";

const STEFAN = { userId: "STEFAN", displayName: "Stefan" };
const JULIA = { userId: "JULIA", displayName: "Julia" };
const MORNING = new Date("2026-10-05T05:30:00Z"); // 07:30 in Berlin
const brief = (overrides: Partial<Parameters<typeof buildBriefing>[0]> = {}) =>
  buildBriefing({ dashboard: KITCHEN_DAY as BriefingDashboard, members: [STEFAN, JULIA], speaker: STEFAN, now: MORNING, timeZone: "Europe/Berlin", ...overrides });

describe("buildBriefing", () => {
  it("follows the fixed order for a known speaker (Full Briefing Order)", () => {
    expect(brief().text).toBe(
      "Guten Morgen, Stefan. Heute stehen drei Aufgaben an, zusammen etwa 45 Minuten: Auto waschen, Altglas und Spülmaschine ausräumen. " +
        "Im Haushalt sind heute insgesamt 6 offen; Julia hat 4. Soll ich dir die erste Aufgabe nennen?",
    );
    expect(brief().suggestion?.title).toBe("Altglas");
  });

  it("is household-wide without a speaker, e.g. from a routine (Known vs Unknown Speaker)", () => {
    const text = brief({ speaker: undefined }).text;
    expect(text).toMatch(/^Guten Morgen\. Heute stehen vier Aufgaben an, zusammen etwa 55 Minuten: Auto waschen, Altglas, Pflanzen gießen und eine weitere\./);
    expect(text).toContain("Zwei sind überfällig, am längsten Haustür putzen seit 4 Tagen.");
    expect(text).toContain("Im Haushalt sind heute insgesamt 6 offen; Stefan hat 3 und Julia hat 4.");
    expect(brief({ speaker: undefined }).suggestion?.title).toBe("Haustür putzen");
  });

  it("names a single overdue Tenner", () => {
    const one = dashboard({ overdue: [dashboardTenner({ title: "Fenster putzen", overdueDays: 5 })] }) as BriefingDashboard;
    expect(brief({ dashboard: one }).text).toContain("Eine Aufgabe ist überfällig: Fenster putzen, seit 5 Tagen.");
  });

  it("handles an empty day without a closing question (Empty Day)", () => {
    const empty = dashboard({ dueToday: [] }) as BriefingDashboard;
    expect(brief({ dashboard: empty })).toEqual({ text: "Guten Morgen, Stefan. Heute ist für dich nichts fällig.", suggestion: undefined });
    expect(brief({ dashboard: empty, speaker: undefined }).text).toBe("Guten Morgen. Heute ist nichts fällig.");
  });

  it("leaves out the household sentence in a one-member household (Single-Member Household)", () => {
    expect(brief({ members: [STEFAN] }).text).not.toContain("Im Haushalt");
  });

  it("mentions the household vacation (Vacation Notice)", () => {
    const vacation = dashboard({
      paused: [{ ...dashboardTenner({ title: "Rasen" }), pauseReason: "VACATION", pausedUntil: "2026-10-24" }],
    } as Partial<BriefingDashboard>) as BriefingDashboard;
    expect(brief({ dashboard: vacation }).text).toContain("Urlaubsmodus bis 24. Oktober.");
    const paused = dashboard({ paused: [{ ...dashboardTenner(), pauseReason: "PAUSE", pausedUntil: null }] } as Partial<BriefingDashboard>) as BriefingDashboard;
    expect(brief({ dashboard: paused }).text).not.toContain("Urlaub");
  });

  it("stays within about 40 seconds (Length Limit)", () => {
    const long = "Sehr langer Titel mit vielen Wörtern für die Küche und den Keller";
    const busy = dashboard({
      dueToday: Array.from({ length: 12 }, (_, index) => dashboardTenner({ tennerId: `t${index}`, title: `${long} ${index}`, assignedTo: index % 2 ? "JULIA" : "STEFAN" })),
      overdue: [dashboardTenner({ title: long, overdueDays: 9 }), dashboardTenner({ title: long, overdueDays: 3 })],
      byUser: { STEFAN: { count: 7, estimatedMinutes: 70 }, JULIA: { count: 7, estimatedMinutes: 70 } },
    }) as BriefingDashboard;
    const many = Array.from({ length: 8 }, (_, index) => ({ userId: `M${index}`, displayName: `Mitglied Nummer ${index}` }));
    for (const input of [{ dashboard: busy, speaker: undefined }, { dashboard: busy, members: many, speaker: undefined }]) {
      expect(wordCount(brief(input).text)).toBeLessThanOrEqual(MAX_BRIEFING_WORDS);
    }
  });

  it("greets by time of day in the household timezone (Time-Of-Day Greeting)", () => {
    expect(greetingFor(new Date("2026-10-05T08:30:00Z"), "Europe/Berlin")).toBe("Guten Morgen"); // 10:30
    expect(greetingFor(new Date("2026-10-05T09:30:00Z"), "Europe/Berlin")).toBe("Hallo"); // 11:30
    expect(greetingFor(new Date("2026-10-05T16:00:00Z"), "Europe/Berlin")).toBe("Guten Abend"); // 18:00
    expect(greetingFor(new Date("2026-10-05T16:00:00Z"), "America/New_York")).toBe("Hallo"); // 12:00
  });
});

describe("BriefingIntent", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(MORNING);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const api = fakeApi({ "GET /household/alexa": { data: { ...CONTEXT, speakers: [{ personId: PERSON_ID, userId: "STEFAN" }] } }, "GET /dashboard": { data: KITCHEN_DAY } });
    return { skill: createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch), api };
  }

  it("speaks the briefing with one household-wide dashboard call and offers the first Tenner", async () => {
    const { skill, api } = setup();
    const response = await skill.invoke(intentRequest("BriefingIntent", {}, { person: { personId: PERSON_ID } }));
    expect(ssml(response)).toMatch(/^<speak>Guten Morgen, Stefan\. Heute stehen drei Aufgaben an/);
    expect(api.calls.filter(([url]) => url.includes("/dashboard")).map(([url]) => url)).toEqual([`${API_BASE}/dashboard`]);
    expect(response.response.shouldEndSession).toBe(false);

    const yes = intentRequest("AMAZON.YesIntent", {}, { session: response.sessionAttributes ?? {} });
    (yes.session as { new: boolean }).new = false;
    const first = await skill.invoke(yes);
    expect(ssml(first)).toBe("<speak>Wie wäre es mit Altglas? Das dauert 5 Minuten.</speak>");
    expect(first.sessionAttributes).toMatchObject({ suggestedTennerId: "b" });
    expect(first.sessionAttributes?.briefingSuggestion).toBeUndefined();
  });

  it("ends politely on „nein“", async () => {
    const { skill } = setup();
    const no = intentRequest("AMAZON.NoIntent", {}, { session: { briefingSuggestion: KITCHEN_DAY.dueToday[1] } });
    (no.session as { new: boolean }).new = false;
    expect(ssml(await skill.invoke(no))).toBe("<speak>Alles klar. Einen schönen Tag!</speak>");
  });
});

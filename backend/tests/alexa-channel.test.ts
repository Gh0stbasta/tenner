/** ALEXA-008: Alexa notifications and reminders. */

import { describe, expect, it, vi } from "vitest";
import { AlexaChannel, createProactiveEventsClient, createSkillMessagingClient, reminderText, type AlexaApiOutcome } from "../src/alexa/index.js";
import { DEFAULT_NOTIFICATION_PREFERENCES } from "../src/models/index.js";
import type { NotificationMessage, Recipient } from "../src/notifications/index.js";
import { createNotifierRuntime } from "../src/notifier.js";
import { NotificationPreferencesService } from "../src/services/index.js";
import { householdSettings, testConfig, TEST_IDENTITY } from "./mocks/index.js";

const NOW = new Date("2026-10-06T15:00:00Z");
const RECIPIENT: Recipient = { tenantId: "default", userId: "STEFAN", displayName: "Stefan", timezone: "Europe/Berlin" };
const ACCOUNT = "amzn1.ask.account.HOUSEHOLD";
const json = (status: number) => new Response("{}", { status });
const OVERDUE: NotificationMessage = { type: "OVERDUE_ALERT", userId: "STEFAN", subject: "Überfällig: 2 Aufgaben", textBody: "…", facts: { overdue: 2, oldestDays: 5 } };
const DIGEST: NotificationMessage = { type: "DAILY_DIGEST", userId: "STEFAN", subject: "Heute", textBody: "…", facts: { dueToday: 4, overdue: 1, minutes: 40 } };

function channel(outcome: AlexaApiOutcome = { ok: true }, users = [ACCOUNT]) {
  const deps = {
    alexaUsers: vi.fn(async () => users),
    removeAlexaUser: vi.fn(async () => undefined),
    lwa: { token: vi.fn(async (scope: string) => `token-${scope}`) },
    proactiveEvents: { messageAlert: vi.fn(async () => outcome) },
    skillMessaging: { send: vi.fn(async () => outcome) },
    now: () => NOW,
  };
  return { channel: new AlexaChannel(deps), deps };
}

describe("AlexaChannel", () => {
  it("sends overdue alerts as a MessageAlert with the count only (Overdue Alert Mapped To Allowed Schema)", async () => {
    const { channel: alexa, deps } = channel();
    expect(await alexa.send(OVERDUE, RECIPIENT)).toEqual({ status: "SENT" });
    expect(deps.lwa.token).toHaveBeenCalledWith("alexa::proactive_events");
    expect(deps.proactiveEvents.messageAlert).toHaveBeenCalledWith("token-alexa::proactive_events", ACCOUNT, { referenceId: expect.stringMatching(/^default-STEFAN-/), count: 2 }, NOW);
  });

  it("turns the daily digest into a reminder through skill messaging (Briefing Reminder Created)", async () => {
    const { channel: alexa, deps } = channel();
    expect(await alexa.send(DIGEST, RECIPIENT)).toEqual({ status: "SENT" });
    expect(deps.skillMessaging.send).toHaveBeenCalledWith("token-alexa:skill_messaging", ACCOUNT, {
      type: "REMINDER",
      text: "Zentrale: Heute 4 Aufgaben, 40 Minuten, 1 überfällig. Sag: Alexa, sag Familien Zentrale, starte meinen Tag, für Details.",
    });
  });

  it("turns today's meals into a reminder (FOOD-016)", async () => {
    const { channel: alexa, deps } = channel();
    const meals: NotificationMessage = { type: "MEAL_TODAY", userId: "STEFAN", subject: "🍽️ Heute", textBody: "…", facts: { dinner: "Linseneintopf" } };
    expect(await alexa.send(meals, RECIPIENT)).toEqual({ status: "SENT" });
    expect(deps.skillMessaging.send).toHaveBeenCalledWith("token-alexa:skill_messaging", ACCOUNT, { type: "REMINDER", text: "Zentrale: Heute gibt es abends Linseneintopf." });
  });

  it("skips other types and households without an Alexa account", async () => {
    expect(await channel().channel.send({ ...DIGEST, type: "WEEKLY_SUMMARY" }, RECIPIENT)).toEqual({ status: "SKIPPED", errorCode: "UNSUPPORTED_TYPE" });
    expect(await channel({ ok: true }, []).channel.send(OVERDUE, RECIPIENT)).toEqual({ status: "SKIPPED", errorCode: "NO_ALEXA_ACCOUNT" });
  });

  it("reports API errors with the status and removes gone accounts (API Errors Logged With Delivery Status)", async () => {
    expect(await channel({ ok: false, status: 403, userGone: false }).channel.send(OVERDUE, RECIPIENT)).toEqual({ status: "FAILED", errorCode: "ALEXA_HTTP_403" });
    expect(await channel({ ok: false, status: undefined, userGone: false }).channel.send(DIGEST, RECIPIENT)).toEqual({ status: "FAILED", errorCode: "ALEXA_UNREACHABLE" });
    const gone = channel({ ok: false, status: 404, userGone: true });
    await gone.channel.send(OVERDUE, RECIPIENT);
    expect(gone.deps.removeAlexaUser).toHaveBeenCalledWith("default", ACCOUNT);
  });

  it("words the reminder without overdue part when there is none", () => {
    expect(reminderText({ ...DIGEST, facts: { dueToday: 2, overdue: 0, minutes: 15 } })).toBe("Zentrale: Heute 2 Aufgaben, 15 Minuten. Sag: Alexa, sag Familien Zentrale, starte meinen Tag, für Details.");
  });
});

describe("Alexa API clients", () => {
  it("posts the MessageAlert event to the development stage with a unicast audience", async () => {
    const fetchMock = vi.fn(async () => json(202));
    const outcome = await createProactiveEventsClient("https://api.eu.amazonalexa.com", "development", fetchMock as unknown as typeof fetch).messageAlert("tok", ACCOUNT, { referenceId: "r1", count: 2 }, NOW);
    expect(outcome).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.eu.amazonalexa.com/v1/proactiveEvents/stages/development");
    expect(JSON.parse(String(init.body))).toEqual({
      timestamp: "2026-10-06T15:00:00.000Z",
      referenceId: "r1",
      expiryTime: "2026-10-07T14:00:00.000Z",
      event: { name: "AMAZON.MessageAlert.Activated", payload: { state: { status: "UNREAD", freshness: "NEW" }, messageGroup: { creator: { name: "Zentrale" }, count: 2, urgency: "URGENT" } } },
      relevantAudience: { type: "Unicast", payload: { user: ACCOUNT } },
    });
    const live = vi.fn(async () => json(202));
    await createProactiveEventsClient("https://x", "live", live as unknown as typeof fetch).messageAlert("t", "u", { referenceId: "r", count: 1 }, NOW);
    expect((live.mock.calls[0] as unknown as [string])[0]).toBe("https://x/v1/proactiveEvents");
  });

  it("posts skill messages per user and maps errors", async () => {
    const fetchMock = vi.fn(async () => json(202));
    await createSkillMessagingClient("https://x", fetchMock as unknown as typeof fetch).send("tok", ACCOUNT, { type: "REMINDER", text: "t" });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://x/v1/skillmessages/users/${encodeURIComponent(ACCOUNT)}`);
    expect(JSON.parse(String(init.body))).toEqual({ data: { type: "REMINDER", text: "t" }, expiresAfterSeconds: 3600 });
    expect(await createSkillMessagingClient("https://x", (async () => json(410)) as unknown as typeof fetch).send("t", "u", { type: "REMINDER", text: "t" })).toEqual({ ok: false, status: 410, userGone: true });
    expect(await createSkillMessagingClient("https://x", (async () => Promise.reject(new Error("x"))) as unknown as typeof fetch).send("t", "u", { type: "REMINDER", text: "t" })).toEqual({ ok: false, status: undefined, userGone: false });
  });
});

describe("Alexa as a selectable channel", () => {
  it("is offered once the household has an Alexa account", async () => {
    const households = { get: vi.fn(async () => householdSettings({ alexaUsers: [{ alexaUserId: ACCOUNT, linkedBy: "STEFAN", createdAt: "t" }] })), saveNotificationPreferences: vi.fn() };
    const connected = async () => ((await households.get()).alexaUsers.length > 0 ? (["ALEXA"] as const) : []);
    const service = new NotificationPreferencesService(households, () => NOW, async () => "Europe/Berlin", async () => [...(await connected())]);
    expect((await service.get(TEST_IDENTITY, "STEFAN")).channels.find((entry) => entry.type === "ALEXA")?.connected).toBe(true);
    expect(DEFAULT_NOTIFICATION_PREFERENCES.overdueAlerts.channels).toEqual([]);
  });

  it("adds the Alexa channel to the notifier with Alexa API configuration", () => {
    const alexaApi = { endpoint: "https://api.eu.amazonalexa.com", clientIdParameter: "/a", clientSecretParameter: "/b", skillStage: "development" as const };
    expect(createNotifierRuntime(testConfig({ notificationsTable: "n", alexaApi })).notifier.channels.map((entry) => entry.type)).toEqual(["LOG", "ALEXA"]);
    expect(createNotifierRuntime(testConfig({ notificationsTable: "n" })).notifier.channels.map((entry) => entry.type)).toEqual(["LOG"]);
  });
});

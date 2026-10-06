/** ALEXA-007: widget APL package and the tap handler. */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { RequestEnvelope } from "ask-sdk-model";
import { createSkill } from "../src/skill.js";
import { SKILL_ID, envelope } from "./envelopes.js";
import { API_BASE, fakeApi } from "./fakeApi.js";
import { KITCHEN_DAY } from "./dashboardFixtures.js";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../widgets/tenner-status/${name}`, import.meta.url), "utf8")) as Record<string, unknown>;

describe("widget package", () => {
  const document = read("document.json");
  const manifest = read("manifest.json");
  const sample = read("sample-data.json") as { status: Record<string, unknown> };

  it("binds the Data Store object the notifier pushes", () => {
    expect(document).toMatchObject({
      type: "APL",
      extensions: [{ name: "DataStore", uri: "alexaext:datastore:10" }],
      settings: { DataStore: { dataBindings: [{ namespace: "tenner", key: "status", dataBindingName: "status" }] } },
    });
    expect(manifest).toMatchObject({ dataStore: { namespace: "tenner", key: "status" }, sizes: ["small", "medium"] });
  });

  it("uses the same fields as the backend's WidgetSummary (Widget Document Renders With Sample Data)", () => {
    expect(Object.keys(sample.status).sort()).toEqual(["date", "dueToday", "members", "next", "openMinutes", "overdue", "updatedAt"]);
    const text = JSON.stringify(document);
    for (const field of ["status.dueToday", "status.openMinutes", "status.overdue", "status.next", "data.title", "data.minutes", "data.member"]) expect(text).toContain(field);
  });

  it("opens the dashboard on tap", () => {
    expect(JSON.stringify(document)).toContain('"arguments":["openDashboard"]');
  });
});

describe("OpenDashboardHandler", () => {
  it("answers a widget tap like a launch with the dashboard", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const api = fakeApi({ "GET /dashboard": { data: KITCHEN_DAY }, "GET /tenners": { data: [] } });
    const skill = createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch);
    const request: RequestEnvelope = envelope(
      { type: "Alexa.Presentation.APL.UserEvent", arguments: ["openDashboard"] },
      { supportedInterfaces: { "Alexa.Presentation.APL": { runtime: { maxVersion: "2023.2" } } } },
    );
    const response = await skill.invoke(request);
    expect(response.response.directives?.some((directive) => directive.type === "Alexa.Presentation.APL.RenderDocument")).toBe(true);
    vi.restoreAllMocks();
  });
});

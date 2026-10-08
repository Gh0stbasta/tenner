/** ALEXA-007, MAINT-002: widget APL package in Amazon's format and the install lifecycle. */
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createSkill } from "../src/skill.js";
import { SKILL_ID, envelope } from "./envelopes.js";
import { API_BASE, fakeApi } from "./fakeApi.js";

const PACKAGE = "../skill-package/dataStorePackages/tenner-status/";
const read = (name: string) => JSON.parse(readFileSync(new URL(`${PACKAGE}${name}`, import.meta.url), "utf8")) as Record<string, unknown>;
const skillManifest = JSON.parse(readFileSync(new URL("../skill-package/skill.json", import.meta.url), "utf8")) as {
  manifest: { apis: { custom: { interfaces: { type: string; packages?: { id: string }[]; requestedExtensions?: { uri: string }[] }[] } } };
};

describe("widget package", () => {
  const document = read("documents/document.json");
  const manifest = read("manifest.json") as {
    manifest: { id: string; installStateChanges: string; presentationDefinitions: { url: string }[] };
    packageType: string;
    publishingInformation: { locales: Record<string, { targetViewport: string; metadata: { name: string } }[]> };
  };
  const sample = JSON.parse(readFileSync(new URL("./widgetSample.json", import.meta.url), "utf8")) as { status: Record<string, unknown> };

  it("binds the Data Store object the notifier pushes", () => {
    expect(document).toMatchObject({
      type: "APL",
      extensions: [{ name: "DataStore", uri: "alexaext:datastore:10" }],
      settings: { DataStore: { dataBindings: [{ namespace: "tenner", key: "status", dataBindingName: "status" }] } },
    });
  });

  it("is an APL package in Amazon's layout, declared in the skill manifest (MAINT-002)", () => {
    expect(manifest.packageType).toBe("APL_PACKAGE");
    expect(manifest.manifest).toMatchObject({ id: "tenner-status", installStateChanges: "INFORM" });
    expect(manifest.publishingInformation.locales["de-DE"]?.[0]).toMatchObject({
      targetViewport: "WIDGET_M",
      // Required by Amazon (MAINT-003); the deploy replaces the placeholder with the web app URL.
      metadata: { name: "Zentrale", iconUri: "${WEB_APP_URL}/icons/icon-512.png", previews: ["${WEB_APP_URL}/alexa/widget-preview.png"] },
    });
    const presentation = read(manifest.manifest.presentationDefinitions[0]?.url ?? "") as { type: string; documentUrl: string; datasourceUrl: string };
    expect(presentation.type).toBe("APL_PRESENTATION");
    expect(read(presentation.documentUrl)).toMatchObject({ type: "APL" });
    expect(Object.keys(read(presentation.datasourceUrl))).toEqual((document.mainTemplate as { parameters: string[] }).parameters);
    const interfaces = skillManifest.manifest.apis.custom.interfaces;
    expect(interfaces.find((entry) => entry.type === "ALEXA_DATASTORE_PACKAGEMANAGER")?.packages).toEqual([{ id: "tenner-status" }, { id: "meal-today" }]);
    expect(interfaces.some((entry) => entry.type === "ALEXA_DATA_STORE")).toBe(true);
    expect(interfaces.find((entry) => entry.type === "ALEXA_EXTENSION")?.requestedExtensions).toEqual([{ uri: "alexaext:datastore:10" }]);
  });

  it("uses the same fields as the backend's WidgetSummary (Widget Document Renders With Sample Data)", () => {
    expect(Object.keys(sample.status).sort()).toEqual(["date", "dueToday", "members", "next", "openMinutes", "overdue", "updatedAt"]);
    const text = JSON.stringify(document);
    for (const field of ["status.dueToday", "status.openMinutes", "status.overdue", "status.next", "data.title", "data.minutes", "data.member"]) expect(text).toContain(field);
  });

  it("has no tap action: the skill shows no views (MAINT-006)", () => {
    const text = JSON.stringify(document);
    expect(text).not.toContain("SendEvent");
    expect(text).not.toContain("TouchWrapper");
  });
});

describe("meal widget package (FOOD-018)", () => {
  const MEALS = "../skill-package/dataStorePackages/meal-today/";
  const readMeals = (name: string) => JSON.parse(readFileSync(new URL(`${MEALS}${name}`, import.meta.url), "utf8")) as Record<string, unknown>;
  const document = readMeals("documents/document.json");
  const sample = JSON.parse(readFileSync(new URL("./widgetSample.json", import.meta.url), "utf8")) as { meals: Record<string, unknown> };

  it("is an APL package bound to tenner/meals, without tap action", () => {
    expect(readMeals("manifest.json")).toMatchObject({ manifest: { id: "meal-today", installStateChanges: "INFORM" }, packageType: "APL_PACKAGE" });
    expect(document).toMatchObject({ type: "APL", settings: { DataStore: { dataBindings: [{ namespace: "tenner", key: "meals", dataBindingName: "meals" }] } } });
    expect(readMeals("presentations/default.tpl")).toMatchObject({ type: "APL_PRESENTATION", documentUrl: "documents/document.json" });
    expect(JSON.stringify(document)).not.toContain("SendEvent");
  });

  it("uses the same fields as the backend's MealWidget", () => {
    expect(Object.keys(sample.meals).sort()).toEqual(["date", "dinner", "lunch", "title", "updatedAt"]);
    const text = JSON.stringify(document);
    for (const field of ["meals.title", "meals.lunch", "meals.dinner"]) expect(text).toContain(field);
  });
});

describe("widget install lifecycle (MAINT-002)", () => {
  const packageRequest = (type: string, extra: Record<string, unknown> = {}) =>
    envelope({ type: `Alexa.DataStore.PackageManager.${type}`, packageId: "tenner-status", packageVersion: "1.0.0", ...extra });

  it("registers the Alexa account when the widget is installed, without speech", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const api = fakeApi({ "PUT /household/alexa-users/amzn1.ask.account.TEST": { data: {} } });
    const skill = createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch);
    // Widget requests come without a session.
    const request = packageRequest("UsagesInstalled", { payload: { usages: [{ instanceId: "w-1" }] } });
    delete (request as { session?: unknown }).session;
    const response = await skill.invoke(request);
    expect(response.response.outputSpeech).toBeUndefined();
    expect(api.calls.map(([url, init]) => `${init.method} ${new URL(url).pathname}`)).toContain("PUT /prod/household/alexa-users/amzn1.ask.account.TEST");
    expect(info.mock.calls.flat().join(" ")).not.toContain("amzn1.ask.account.TEST");
    vi.restoreAllMocks();
  });

  it("answers quietly when the account is not linked or the API fails", async () => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
    const api = fakeApi({ "PUT /household/alexa-users/amzn1.ask.account.TEST": "network-error" });
    const skill = createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, api.fetch);
    expect((await skill.invoke(packageRequest("UsagesInstalled"))).response.outputSpeech).toBeUndefined();
    const unlinked = envelope({ type: "Alexa.DataStore.PackageManager.UsagesInstalled" }, { accessToken: null });
    expect((await skill.invoke(unlinked)).response.outputSpeech).toBeUndefined();
    vi.restoreAllMocks();
  });

  it("logs removal, updates and installation errors", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const skill = createSkill({ tennerApiBaseUrl: API_BASE, skillId: SKILL_ID, apiTimeoutMs: 200 }, fakeApi().fetch);
    for (const type of ["UsagesRemoved", "UpdateRequest"]) expect((await skill.invoke(packageRequest(type))).response.outputSpeech).toBeUndefined();
    await skill.invoke(packageRequest("InstallationError", { error: { type: "INVALID_PACKAGE" } }));
    expect(info.mock.calls.flat().join(" ")).toContain("widget_lifecycle");
    expect(error.mock.calls.flat().join(" ")).toContain("INVALID_PACKAGE");
    vi.restoreAllMocks();
  });
});

import { describe, expect, it } from "vitest";
import dashboardDocument from "../apl/dashboard.json" with { type: "json" };
import listDocument from "../apl/list.json" with { type: "json" };
import { MEMBER_COLORS, dashboardView, headerDate, overdueListView, summaryLine, supportsApl } from "../src/apl.js";
import { KITCHEN_DAY, dashboard, dashboardTenner } from "./dashboardFixtures.js";
import { launchRequest } from "./envelopes.js";

const MEMBERS = [
  { userId: "STEFAN", displayName: "Stefan" },
  { userId: "JULIA", displayName: "Julia" },
];

describe("supportsApl (APL Only On Screen Devices)", () => {
  it("is true only with the APL interface", () => {
    expect(supportsApl(launchRequest({ supportedInterfaces: { "Alexa.Presentation.APL": { runtime: { maxVersion: "2023.2" } } } }))).toBe(true);
    expect(supportsApl(launchRequest())).toBe(false);
  });
});

describe("dashboardView (Datasource Mapping)", () => {
  const view = dashboardView(KITCHEN_DAY, MEMBERS);

  it("builds header, summary and per-member columns plus „Alle“", () => {
    expect(view.date).toBe("Montag, 5. Oktober");
    expect(view.summary).toBe("Heute: vier Tenner · 85 Minuten offen · 2 überfällig");
    expect(view.columns.map((column) => [column.name, column.rows.map((row) => row.label)])).toEqual([
      ["Stefan", ["Auto waschen (30 Min.)", "Altglas (5 Min.)"]],
      ["Julia", ["Pflanzen gießen (10 Min.)"]],
      ["Alle", ["Spülmaschine ausräumen (10 Min.)"]],
    ]);
    expect(view.columns[0]?.color).toBe(MEMBER_COLORS[0]);
    expect(view.columns[0]?.rows[0]).toMatchObject({ tennerId: "a", title: "Auto waschen", accessibilityLabel: "Auto waschen, 30 Minuten. Antippen zum Erledigen." });
  });

  it("puts overdue Tenners in a band with icon text, longest first", () => {
    expect(view.overdue.map((row) => [row.title, row.detail])).toEqual([
      ["Haustür putzen", "⚠ seit 4 Tagen · Julia"],
      ["Fenster putzen", "⚠ seit gestern · Julia"],
    ]);
    expect(view.next.map((row) => row.title)).toEqual(["Haustür putzen", "Fenster putzen", "Auto waschen"]);
    expect(view.empty).toBe("");
    expect(JSON.stringify(view)).not.toContain("Pool");
  });

  it("shows three member columns and names the rest (More Than 3 Members → weitere)", () => {
    const members = ["A", "B", "C", "D", "E"].map((id) => ({ userId: id, displayName: `M${id}` }));
    const busy = dashboard({ dueToday: members.map((member, index) => dashboardTenner({ tennerId: member.userId, assignedTo: member.userId, title: `T${index}` })) });
    const result = dashboardView(busy, members);
    expect(result.columns.map((column) => column.name)).toEqual(["MA", "MB", "MC"]);
    expect(result.moreMembers).toBe("Weitere: MD (1), ME (1)");
  });

  it("truncates long columns with „+ n weitere“", () => {
    const many = dashboard({ dueToday: Array.from({ length: 6 }, (_, index) => dashboardTenner({ tennerId: `t${index}`, title: `T${index}` })) });
    const column = dashboardView(many, MEMBERS).columns[0];
    expect(column?.rows).toHaveLength(4);
    expect(column?.more).toBe("+ 2 weitere");
  });

  it("shows the empty day with the next Tenner (Empty Day View)", () => {
    const quiet = dashboardView(dashboard({ dueToday: [], upcoming: [dashboardTenner({ title: "Rasen mähen", daysUntilDue: 1 })] }), MEMBERS);
    expect(quiet.empty).toBe("Heute ist nichts fällig. Als Nächstes: Rasen mähen, morgen.");
    expect(quiet.columns).toEqual([]);
    expect(quiet.summary).toBe("Heute: nichts fällig");
  });

  it("carries the confirmation banner", () => {
    expect(dashboardView(KITCHEN_DAY, MEMBERS, "✓ Erledigt: Altglas").banner).toBe("✓ Erledigt: Altglas");
  });

  it("formats dates and summaries", () => {
    expect(headerDate("2026-12-24")).toBe("Donnerstag, 24. Dezember");
    expect(summaryLine(dashboard())).toBe("Heute: ein Tenner · 10 Minuten offen");
  });
});

describe("overdueListView", () => {
  it("lists all overdue Tenners or praises", () => {
    expect(overdueListView(KITCHEN_DAY, MEMBERS).rows).toHaveLength(2);
    expect(overdueListView(dashboard(), MEMBERS)).toEqual({ title: "Überfällig", rows: [], empty: "Nichts ist überfällig. Gut gemacht!" });
  });
});

describe("APL documents", () => {
  it.each([
    ["dashboard", dashboardDocument],
    ["list", listDocument],
  ])("%s is an APL document with a payload template", (_name, document) => {
    expect(document).toMatchObject({ type: "APL", version: "2023.2", mainTemplate: { parameters: ["payload"] } });
  });

  it("stays far below the size limit with a full datasource (Document Size Limit)", () => {
    const busy = dashboard({ dueToday: Array.from({ length: 60 }, (_, index) => dashboardTenner({ tennerId: `t${index}`, title: `Ein ziemlich langer Tenner-Titel Nummer ${index}` })) });
    const size = JSON.stringify({ document: dashboardDocument, datasources: { payload: { view: dashboardView(busy, MEMBERS) } } }).length;
    expect(size).toBeLessThan(100 * 1024);
  });

  it("sends the Tenner ID and title on touch and has 48 dp+ touch targets", () => {
    const row = JSON.stringify(dashboardDocument.layouts.TennerRow);
    expect(row).toContain('"arguments":["complete","${row.tennerId}","${row.title}"]');
    expect(dashboardDocument.resources[0]?.dimensions?.rowMinHeight).toBe("64dp");
  });

  it("uses at least 32 dp body text, 40 dp on Echo Show 15", () => {
    expect(dashboardDocument.resources[0]?.dimensions?.bodySize).toBe("32dp");
    expect(dashboardDocument.resources[1]).toMatchObject({ when: "${viewport.width >= 1600}", dimensions: { bodySize: "40dp" } });
  });
});

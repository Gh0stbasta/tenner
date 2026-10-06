import { describe, expect, it } from "vitest";
import { continueListing, dueIn, minutes, overdueAnswer, suggestion, suggestionAnswer, tennerCount, todayAnswer, workLeftAnswer, type Audience } from "../src/answers.js";
import { KITCHEN_DAY, dashboard, dashboardTenner } from "./dashboardFixtures.js";

const STEFAN = { userId: "STEFAN", displayName: "Stefan" };
const JULIA = { userId: "JULIA", displayName: "Julia" };
const household: Audience = { kind: "household" };
const speaker: Audience = { kind: "speaker", member: STEFAN };

describe("number wording", () => {
  it("uses words for small counts and the right minute form", () => {
    expect(tennerCount(1)).toBe("ein Tenner");
    expect(tennerCount(3)).toBe("drei Tenner");
    expect(tennerCount(15)).toBe("15 Tenner");
    expect(minutes(1)).toBe("eine Minute");
    expect(minutes(25)).toBe("25 Minuten");
    expect([dueIn(1), dueIn(2), dueIn(5)]).toEqual(["morgen", "übermorgen", "in 5 Tagen"]);
  });
});

describe("todayAnswer", () => {
  it("starts with the number, lists three and offers the rest (Today For Known Speaker)", () => {
    const answer = todayAnswer(KITCHEN_DAY, speaker);
    expect(answer.text).toBe(
      "Vier Tenner für dich heute, zusammen 55 Minuten: Auto waschen (30 Minuten), Altglas (5 Minuten) und Pflanzen gießen (10 Minuten). Soll ich den letzten auch vorlesen?",
    );
    expect(answer.remaining).toEqual(["Spülmaschine ausräumen (10 Minuten)"]);
  });

  it("speaks household-wide and mentions overdue Tenners when everything fits (Today For Unknown Speaker)", () => {
    const answer = todayAnswer(dashboard({ overdue: [dashboardTenner({ overdueDays: 2 })] }), household);
    expect(answer.text).toBe("Ein Tenner heute, zusammen 10 Minuten: Büro saugen (10 Minuten). Außerdem ist ein Tenner überfällig.");
    expect(answer.remaining).toEqual([]);
  });

  it("names another member", () => {
    expect(todayAnswer(dashboard(), { kind: "member", member: JULIA }).text).toMatch(/^Ein Tenner für Julia heute/);
  });

  it("says nothing is due and names the next Tenner (Nothing Due)", () => {
    const answer = todayAnswer(dashboard({ dueToday: [], upcoming: [dashboardTenner({ title: "Rasen mähen", daysUntilDue: 2 })] }), speaker);
    expect(answer.text).toBe("Heute ist für dich nichts fällig. Als Nächstes: Rasen mähen, übermorgen.");
  });

  it("never reads paused Tenners (Paused Tenners Not Read)", () => {
    expect(todayAnswer(KITCHEN_DAY, household).text + continueListing(todayAnswer(KITCHEN_DAY, household).remaining).text).not.toContain("Pool");
  });
});

describe("overdueAnswer", () => {
  it("orders by days overdue and says since when (Overdue Ordering And Wording)", () => {
    expect(overdueAnswer(KITCHEN_DAY, household).text).toBe("Zwei Tenner sind überfällig: Haustür putzen (seit 4 Tagen) und Fenster putzen (seit gestern).");
  });

  it("praises an empty list", () => {
    expect(overdueAnswer(dashboard(), speaker).text).toBe("Nichts ist für dich überfällig. Gut gemacht!");
  });

  it("continues long lists page by page", () => {
    const many = dashboard({ overdue: Array.from({ length: 7 }, (_, index) => dashboardTenner({ tennerId: `o${index}`, title: `T${index}`, overdueDays: 10 - index })) });
    const first = overdueAnswer(many, household);
    expect(first.text).toMatch(/Soll ich die restlichen vier vorlesen\?$/);
    const second = continueListing(first.remaining);
    expect(second.text).toBe("Weiter: T3 (seit 7 Tagen), T4 (seit 6 Tagen) und T5 (seit 5 Tagen). Soll ich den letzten auch vorlesen?");
    expect(continueListing(second.remaining)).toEqual({ text: "Weiter: T6 (seit 4 Tagen).", remaining: [] });
  });
});

describe("suggestion (Suggestion Rule)", () => {
  it("prefers overdue, then the shortest", () => {
    expect(suggestion(KITCHEN_DAY)?.title).toBe("Haustür putzen");
    expect(suggestion(dashboard({ dueToday: KITCHEN_DAY.dueToday }))?.title).toBe("Altglas");
  });

  it("breaks ties by days overdue, then title", () => {
    const tie = dashboard({ overdue: [dashboardTenner({ title: "B", overdueDays: 1 }), dashboardTenner({ title: "C", overdueDays: 3 }), dashboardTenner({ title: "A", overdueDays: 3 })] });
    expect(suggestion(tie)?.title).toBe("A");
  });

  it("words the suggestion", () => {
    expect(suggestionAnswer(KITCHEN_DAY.overdue[1])).toBe("Wie wäre es mit Haustür putzen? Das dauert 10 Minuten. Das ist seit 4 Tagen überfällig.");
    expect(suggestionAnswer(KITCHEN_DAY.dueToday[1])).toBe("Wie wäre es mit Altglas? Das dauert 5 Minuten.");
    expect(suggestionAnswer(undefined)).toBe("Gerade ist nichts zu tun. Genieß die freie Zeit!");
  });
});

describe("workLeftAnswer", () => {
  it("splits per member when nobody is recognized (Work Left Split Per Member)", () => {
    expect(workLeftAnswer(KITCHEN_DAY, household, [STEFAN, JULIA])).toBe(
      "Noch 85 Minuten: 55 Minuten für heute und 30 Minuten überfällig. Davon Stefan 40 Minuten und Julia 45 Minuten.",
    );
  });

  it("answers personally for a known speaker", () => {
    expect(workLeftAnswer(dashboard(), speaker, [STEFAN, JULIA])).toBe("Noch 10 Minuten für dich: 10 Minuten für heute.");
  });

  it("says when nothing is left", () => {
    expect(workLeftAnswer(dashboard({ dueToday: [] }), household, [STEFAN])).toBe("Heute ist nichts mehr zu tun.");
  });

  it("omits members without work", () => {
    expect(workLeftAnswer(dashboard({ byUser: { STEFAN: { count: 1, estimatedMinutes: 10 } } }), household, [STEFAN, JULIA])).toBe(
      "Noch 10 Minuten: 10 Minuten für heute. Davon Stefan 10 Minuten.",
    );
  });
});

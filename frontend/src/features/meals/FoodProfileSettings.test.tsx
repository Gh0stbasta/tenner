import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DEFAULT_FOOD_PROFILE, DEFAULT_FOOD_RULES, fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { FoodProfileSettings } from "./FoodProfileSettings";

const ADULT_1 = {
  eaterId: "a1",
  name: "Erwachsener 1",
  type: "ADULT",
  portionFactor: 1,
  diet: "OMNIVORE",
  vegetarianExceptions: [],
  allergies: ["NUTS", "APPLE"],
  dislikeTags: [],
  dislikeIngredients: [],
  likeIngredients: [],
  likeGroups: [],
};
const ADULT_2 = {
  ...ADULT_1,
  eaterId: "a2",
  name: "Erwachsener 2",
  diet: "VEGETARIAN",
  vegetarianExceptions: ["MINCE", "SAUSAGE"],
  allergies: [],
};
const CHILD = { ...ADULT_1, eaterId: "k1", name: "Kind 1", type: "CHILD", portionFactor: 0.5, allergies: [] };
const FAMILY = { eaters: [ADULT_1, ADULT_2, CHILD], household: DEFAULT_FOOD_RULES, updatedAt: "2026-10-07T10:00:00Z" };

const section = () => within(screen.getByRole("region", { name: "Essen: Familienprofil" }));

/** PUT /meals/profile echoes the body like the backend. */
const echo = ({ init }: { init: RequestInit | undefined }) =>
  ok({ ...JSON.parse(String(init?.body)), updatedAt: "2026-10-07T11:00:00Z" });

describe("FoodProfileSettings (FOOD-004)", () => {
  it("shows the empty profile with the owner's default rules", async () => {
    mockFetch({});
    renderWithProviders(<FoodProfileSettings />);
    expect(await section().findByText("Noch niemand eingetragen.")).toBeInTheDocument();
    const rules = section().getByRole("list", { name: "Planungsregeln" });
    expect(
      within(rules).getByText("Höchstens 20 Min. aktive Kochzeit · mittags unter der Woche leicht"),
    ).toBeInTheDocument();
    expect(
      within(rules).getByText(
        "Hühnchen höchstens 1× (Mo Abend, Di Abend) · Burger höchstens 1× · Salat mittags höchstens 2×",
      ),
    ).toBeInTheDocument();
    expect(within(rules).getByText("Nie im Plan: Tofu, Quinoa, Schimmelkäse")).toBeInTheDocument();
  });

  it("lists eaters with diet and allergies, and who eats when", async () => {
    mockFetch({ "GET /meals/profile": ok(FAMILY) });
    renderWithProviders(<FoodProfileSettings />);
    expect(await section().findByText("Erwachsen · ⚠ Allergie: Nüsse, Äpfel")).toBeInTheDocument();
    expect(section().getByText("Erwachsen · vegetarisch (isst Hackfleisch, Würstchen)")).toBeInTheDocument();
    expect(section().getByText("Kind")).toBeInTheDocument();
    expect(
      section().getByText("Mittags Mo – Fr: Erwachsener 1, Erwachsener 2 · Mittags am Wochenende: alle · Abends: alle"),
    ).toBeInTheDocument();
  });

  it("adds a person with an allergy", async () => {
    const fetchMock = mockFetch({ "PUT /meals/profile": echo });
    renderWithProviders(<FoodProfileSettings />);
    await userEvent.click(await section().findByRole("button", { name: "Person hinzufügen" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Person hinzufügen" }));
    await userEvent.type(dialog.getByLabelText(/^Name/), "Erwachsener 1");
    await userEvent.click(dialog.getByLabelText("⚠ Allergien"));
    await userEvent.click(await screen.findByRole("option", { name: "Nüsse" }));
    await userEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("„Erwachsener 1“ gespeichert.")).toBeInTheDocument();
    const put = fetchMock.calls().find((call) => call.key === "PUT /meals/profile");
    expect(put?.body).toMatchObject({
      eaters: [{ name: "Erwachsener 1", type: "ADULT", portionFactor: 1, diet: "OMNIVORE", allergies: ["NUTS"] }],
      household: DEFAULT_FOOD_RULES,
    });
  });

  it("sets a child's default portion and validates the portion", async () => {
    mockFetch({});
    renderWithProviders(<FoodProfileSettings />);
    await userEvent.click(await section().findByRole("button", { name: "Person hinzufügen" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Person hinzufügen" }));
    await userEvent.click(dialog.getByLabelText("Alter"));
    await userEvent.click(await screen.findByRole("option", { name: "Kind" }));
    expect(dialog.getByLabelText("Portion")).toHaveValue("0.5");
    await userEvent.clear(dialog.getByLabelText("Portion"));
    await userEvent.type(dialog.getByLabelText("Portion"), "3");
    expect(dialog.getByText("Zwischen 0,1 und 2.")).toBeInTheDocument();
  });

  it("edits who eats weekday lunch in the rules dialog", async () => {
    const fetchMock = mockFetch({ "GET /meals/profile": ok(FAMILY), "PUT /meals/profile": echo });
    renderWithProviders(<FoodProfileSettings />);
    await userEvent.click(await section().findByRole("button", { name: "Regeln bearbeiten" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Planungsregeln" }));
    const weekdayLunch = within(dialog.getByRole("group", { name: "Wer isst mit? Mittags Mo – Fr" }));
    expect(weekdayLunch.getByRole("checkbox", { name: "Kind 1" })).not.toBeChecked();
    await userEvent.click(weekdayLunch.getByRole("checkbox", { name: "Erwachsener 2" }));
    await userEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Planungsregeln gespeichert.")).toBeInTheDocument();
    const put = fetchMock.calls().find((call) => call.key === "PUT /meals/profile");
    expect(put?.body).toMatchObject({
      household: { attendance: { weekdayLunch: ["a1"], weekendLunch: null, dinner: null } },
    });
  });

  it("removes a person also from the attendance lists", async () => {
    const profile = {
      ...FAMILY,
      household: {
        ...DEFAULT_FOOD_RULES,
        attendance: { weekdayLunch: ["a1", "a2"], weekendLunch: null, dinner: null },
      },
    };
    const fetchMock = mockFetch({ "GET /meals/profile": ok(profile), "PUT /meals/profile": echo });
    renderWithProviders(<FoodProfileSettings />);
    await userEvent.click(await section().findByRole("button", { name: "Erwachsener 2 entfernen" }));
    expect(await screen.findByText("„Erwachsener 2“ entfernt.")).toBeInTheDocument();
    const put = fetchMock.calls().find((call) => call.key === "PUT /meals/profile");
    expect(put?.body).toMatchObject({ household: { attendance: { weekdayLunch: ["a1"] } } });
    expect((put?.body as { eaters: unknown[] }).eaters).toHaveLength(2);
  });

  it("shows save errors in the dialog", async () => {
    mockFetch({ "GET /meals/profile": ok(DEFAULT_FOOD_PROFILE), "PUT /meals/profile": fail(400, "VALIDATION_ERROR") });
    renderWithProviders(<FoodProfileSettings />);
    await userEvent.click(await section().findByRole("button", { name: "Regeln bearbeiten" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Planungsregeln" }));
    await userEvent.click(dialog.getByRole("button", { name: "Speichern" }));
    expect(
      await dialog.findByText("Speichern fehlgeschlagen. Bitte prüfe die markierten Eingaben."),
    ).toBeInTheDocument();
  });
});

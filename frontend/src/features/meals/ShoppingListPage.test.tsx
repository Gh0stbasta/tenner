import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import type { ShoppingItem, ShoppingList, ShoppingOperation } from "./api";
import { applyShoppingOperations } from "./shopping";
import { ShoppingListPage } from "./ShoppingListPage";

const item = (key: string, name: string, overrides: Partial<ShoppingItem> = {}): ShoppingItem => ({
  key,
  ingredientId: key,
  name,
  quantity: 500,
  unit: "g",
  section: "TROCKENWAREN",
  pantry: false,
  checked: false,
  manual: false,
  usedFor: ["2026-10-14#DINNER"],
  ...overrides,
});

const LIST: ShoppingList = {
  weekStart: "2026-10-12",
  range: "REST",
  generatedAt: "2026-10-14T08:00:00Z",
  stale: false,
  items: [
    item("pasta", "Nudeln"),
    item("carrot", "Karotten", { quantity: 300, section: "GEMUESE_OBST" }),
    item("milk", "Milch", { quantity: 1000, unit: "ml", section: "KUEHLREGAL" }),
    item("salt", "Salz", { quantity: 10, pantry: true, section: "GEWUERZE" }),
  ],
};

/** A small server: applies the changes like the backend does. */
function server(initial: ShoppingList = LIST, extra: Parameters<typeof mockFetch>[0] = {}) {
  let list = initial;
  const fetchMock = mockFetch({
    "GET /meals/plans/current/shopping-list": () => ok(list),
    "POST /meals/plans/2026-10-12/shopping-list/changes": ({ init }) => {
      const { operations } = JSON.parse(String(init?.body)) as { operations: ShoppingOperation[] };
      list = { ...list, items: applyShoppingOperations(list.items, operations) };
      return ok(list);
    },
    ...extra,
  });
  return {
    fetchMock,
    changes: () =>
      fetchMock
        .calls()
        .filter((call) => call.key.endsWith("/changes"))
        .map((call) => call.body),
  };
}

function setOnline(value: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? "online" : "offline"));
  });
}

const openList = () => screen.findByRole("list", { name: "Einkaufen" });

describe("ShoppingListPage (FOOD-014)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the items in the list's order with quantities and meals, pantry items collapsed", async () => {
    server();
    renderWithProviders(<ShoppingListPage />);
    const open = within(await openList());
    expect(open.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"))).toEqual([
      "Nudeln",
      "Karotten",
      "Milch",
    ]);
    expect(open.getByText("1 l Milch")).toBeInTheDocument();
    expect(open.getAllByText("für Mi Abend")).toHaveLength(3);
    expect(open.getByRole("button", { name: "Verschieben: Nudeln" })).toBeInTheDocument();
    expect(screen.getByText("Vorrat prüfen (1)")).toBeInTheDocument();
  });

  it("strikes ticked items through and moves them to the end; unticking brings them back", async () => {
    const { changes } = server();
    renderWithProviders(<ShoppingListPage />);
    await userEvent.click(within(await openList()).getByRole("checkbox", { name: "Nudeln" }));
    const done = within(await screen.findByRole("list", { name: "Erledigt" }));
    expect(done.getByText("500 g Nudeln").closest(".MuiListItemText-root")).toHaveStyle({
      textDecoration: "line-through",
    });
    expect(within(await openList()).queryByText("500 g Nudeln")).not.toBeInTheDocument();
    await vi.waitFor(() =>
      expect(changes()).toEqual([{ operations: [{ type: "check", key: "pasta", checked: true }] }]),
    );
    await userEvent.click(done.getByRole("checkbox", { name: "Nudeln" }));
    expect(await within(await openList()).findByText("500 g Nudeln")).toBeInTheDocument();
  });

  it("adds and removes own items", async () => {
    const { changes } = server();
    renderWithProviders(<ShoppingListPage />);
    await openList();
    await userEvent.type(screen.getByLabelText("Eigener Eintrag"), "Klopapier{Enter}");
    const open = within(await openList());
    expect(await open.findByText("Klopapier")).toBeInTheDocument();
    await userEvent.click(open.getByRole("button", { name: "Entfernen: Klopapier" }));
    await vi.waitFor(() => expect(open.queryByText("Klopapier")).not.toBeInTheDocument());
    await vi.waitFor(() => expect(changes().length).toBeGreaterThanOrEqual(2));
    const operations = changes().flatMap((body) => (body as { operations: ShoppingOperation[] }).operations);
    expect(operations[0]).toMatchObject({ type: "add", name: "Klopapier", key: expect.stringMatching(/^manual-/) });
    expect(operations.at(-1)).toMatchObject({ type: "remove" });
  });

  it("works offline: ticks are kept on the device and sent when the connection returns", async () => {
    const { changes } = server();
    renderWithProviders(<ShoppingListPage />);
    await openList();
    setOnline(false);
    await userEvent.click(within(await openList()).getByRole("checkbox", { name: "Milch" }));
    expect(
      await screen.findByText("Offline: Änderungen werden übertragen, sobald du wieder online bist."),
    ).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Erledigt" })).getByText("1 l Milch")).toBeInTheDocument();
    expect(changes()).toEqual([]);
    setOnline(true);
    await vi.waitFor(() =>
      expect(changes()).toEqual([{ operations: [{ type: "check", key: "milk", checked: true }] }]),
    );
  });

  it("moves an item by keyboard drag and drop", async () => {
    // jsdom has no layout: give the rows of the open list stacked positions so dnd-kit can find neighbours.
    const original = Element.prototype.getBoundingClientRect;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      const row = this.closest("li");
      const list = row?.parentElement;
      if (!row || list?.getAttribute("aria-label") !== "Einkaufen") return original.call(this);
      const top = [...list.children].indexOf(row) * 50;
      return { x: 0, y: top, top, left: 0, right: 300, bottom: top + 48, width: 300, height: 48, toJSON: () => ({}) };
    });
    const { changes } = server();
    renderWithProviders(<ShoppingListPage />);
    const handle = within(await openList()).getByRole("button", { name: "Verschieben: Milch" });
    handle.focus();
    await userEvent.keyboard("[Space]");
    await userEvent.keyboard("[ArrowUp]");
    await userEvent.keyboard("[Space]");
    await vi.waitFor(() => expect(changes().length).toBe(1));
    expect((changes()[0] as { operations: ShoppingOperation[] }).operations[0]).toEqual({
      type: "move",
      key: "milk",
      afterKey: "pasta",
    });
  });

  it("offers a refresh when the plan changed and switches the range", async () => {
    const { fetchMock } = server(
      { ...LIST, stale: true },
      { "POST /meals/plans/current/shopping-list/refresh": ok({ ...LIST, range: "WEEK" }) },
    );
    renderWithProviders(<ShoppingListPage />);
    expect(await screen.findByText("Der Essensplan hat sich geändert.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Liste aktualisieren" }));
    await vi.waitFor(() => expect(screen.queryByText("Der Essensplan hat sich geändert.")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Ganze Woche" })).toHaveAttribute("aria-pressed", "true");
    const refreshes = fetchMock.calls().filter((call) => call.key.endsWith("/refresh"));
    expect(refreshes.map((call) => call.body)).toEqual([{}]);
  });

  it("copies the list as text when the device cannot share", async () => {
    server();
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    renderWithProviders(<ShoppingListPage />);
    await openList();
    await userEvent.click(screen.getByRole("button", { name: "Teilen" }));
    expect(await screen.findByText("Einkaufsliste kopiert.")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("- 500 g Nudeln\n- 300 g Karotten\n- 1 l Milch"));
  });

  it("points to the meal plan while the week has none", async () => {
    mockFetch({ "GET /meals/plans/current/shopping-list": fail(404, "NOT_FOUND") });
    renderWithProviders(<ShoppingListPage />);
    expect(await screen.findByText(/noch keinen Essensplan/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zum Essensplan" })).toHaveAttribute("href", "/essen");
  });
});

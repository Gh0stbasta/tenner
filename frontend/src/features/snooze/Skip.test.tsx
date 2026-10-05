/** SCHEDULING-004: skip one occurrence from the "Verschieben" menu. */

import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dashboard, tenner } from "../../tests/fixtures";
import { fail, mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { DashboardPage } from "../dashboard/DashboardPage";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-02T10:00:00Z"));
  vi.spyOn(console, "info").mockImplementation(() => undefined);
});

afterEach(() => vi.useRealTimers());

const skipped = {
  tenner: tenner({ nextDue: "2026-10-16" }),
  skip: {
    skipId: "k-1",
    skippedBy: "STEFAN",
    skippedAt: "2026-10-02T10:00:00Z",
    skippedDue: "2026-10-02",
    nextDue: "2026-10-16",
    reason: null,
  },
};

async function openSkipDialog() {
  await userEvent.click(await screen.findByRole("button", { name: "„Büro saugen“ verschieben" }));
  await userEvent.click(await screen.findByRole("menuitem", { name: "Diesmal überspringen …" }));
  return screen.findByRole("dialog", { name: "„Büro saugen“ diesmal überspringen?" });
}

describe("Skip this time", () => {
  it("skips without a reason and confirms the next due date", async () => {
    const fetchMock = mockFetch({ "GET /dashboard": ok(dashboard()), "POST /tenners/t-1/skip": ok(skipped) });
    renderWithProviders(<DashboardPage />);
    const dialog = await openSkipDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Überspringen" }));

    expect(
      await screen.findByText("⏭ „Büro saugen“ übersprungen. Nächste Fälligkeit: Fr., 16. Okt."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock.calls().find((call) => call.key === "POST /tenners/t-1/skip")?.body).toEqual({});
  });

  it("sends a trimmed reason", async () => {
    const fetchMock = mockFetch({ "GET /dashboard": ok(dashboard()), "POST /tenners/t-1/skip": ok(skipped) });
    renderWithProviders(<DashboardPage />);
    const dialog = await openSkipDialog();
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "Grund (optional)" }),
      "  Diese Woche nicht nötig ",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Überspringen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(fetchMock.calls().find((call) => call.key === "POST /tenners/t-1/skip")?.body).toEqual({
      reason: "Diese Woche nicht nötig",
    });
  });

  it("limits the reason to 200 characters", async () => {
    mockFetch({ "GET /dashboard": ok(dashboard()) });
    renderWithProviders(<DashboardPage />);
    const dialog = await openSkipDialog();
    const reason = within(dialog).getByRole("textbox", { name: "Grund (optional)" });
    await userEvent.click(reason);
    await userEvent.paste("x".repeat(201));
    expect(within(dialog).getByText("201/200")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Überspringen" })).toBeDisabled();
  });

  it("keeps the dialog open and shows the error when skipping fails", async () => {
    mockFetch({
      "GET /dashboard": ok(dashboard()),
      "POST /tenners/t-1/skip": fail(409, "TENNER_INACTIVE", "Inactive Tenners cannot be skipped."),
    });
    renderWithProviders(<DashboardPage />);
    const dialog = await openSkipDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Überspringen" }));
    expect(await within(dialog).findByText(/^Überspringen fehlgeschlagen\./)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});

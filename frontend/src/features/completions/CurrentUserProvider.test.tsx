import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../tests/render";
import { CURRENT_USER_STORAGE_KEY, useCurrentUser } from "./CurrentUserProvider";
import { CurrentUserSelect } from "./CurrentUserSelect";

function ShowUser() {
  return <p>Aktuell: {useCurrentUser()}</p>;
}

describe("CurrentUserProvider", () => {
  afterEach(() => window.localStorage.clear());

  it("defaults to Stefan", () => {
    renderWithProviders(<ShowUser />);
    expect(screen.getByText("Aktuell: STEFAN")).toBeInTheDocument();
  });

  it("reads a stored user and ignores invalid values", () => {
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, "JULIA");
    const { unmount } = renderWithProviders(<ShowUser />);
    expect(screen.getByText("Aktuell: JULIA")).toBeInTheDocument();
    unmount();
    window.localStorage.setItem(CURRENT_USER_STORAGE_KEY, "BOB");
    renderWithProviders(<ShowUser />);
    expect(screen.getByText("Aktuell: STEFAN")).toBeInTheDocument();
  });

  it("switches the user from the header and persists it", async () => {
    renderWithProviders(
      <>
        <CurrentUserSelect />
        <ShowUser />
      </>,
    );
    await userEvent.click(screen.getByRole("combobox", { name: "Ich bin" }));
    await userEvent.click(await screen.findByRole("option", { name: "Julia" }));
    expect(screen.getByText("Aktuell: JULIA")).toBeInTheDocument();
    expect(window.localStorage.getItem(CURRENT_USER_STORAGE_KEY)).toBe("JULIA");
  });

  it("works when storage is blocked", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderWithProviders(
      <>
        <CurrentUserSelect />
        <ShowUser />
      </>,
    );
    expect(screen.getByText("Aktuell: STEFAN")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("combobox", { name: "Ich bin" }));
    await userEvent.click(await screen.findByRole("option", { name: "Julia" }));
    expect(screen.getByText("Aktuell: JULIA")).toBeInTheDocument();
  });

  it("requires the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<ShowUser />)).toThrow("useCurrentUser must be used inside CurrentUserProvider.");
  });
});

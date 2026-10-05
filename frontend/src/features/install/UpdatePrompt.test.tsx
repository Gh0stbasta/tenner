/** MOBILE-002: update notification for a new service worker. */

import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../../tests/render";
import { UPDATE_CHECK_INTERVAL_MS, UpdatePrompt } from "./UpdatePrompt";

const state = vi.hoisted(() => ({
  needRefresh: false,
  setNeedRefresh: vi.fn(),
  updateServiceWorker: vi.fn(async () => undefined),
  onRegisteredSW: undefined as
    ((url: string, registration: { update: () => Promise<void> } | undefined) => void) | undefined,
}));

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: (options: { onRegisteredSW: typeof state.onRegisteredSW }) => {
    state.onRegisteredSW = options.onRegisteredSW;
    return {
      needRefresh: [state.needRefresh, state.setNeedRefresh],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: state.updateServiceWorker,
    };
  },
}));

describe("UpdatePrompt", () => {
  beforeEach(() => {
    state.needRefresh = false;
    vi.clearAllMocks();
  });

  it("stays hidden without a new version", () => {
    renderWithProviders(<UpdatePrompt />);
    expect(screen.queryByText("Neue Version verfügbar.")).not.toBeInTheDocument();
  });

  it("offers the new version and reloads into it", async () => {
    state.needRefresh = true;
    renderWithProviders(<UpdatePrompt />);
    expect(screen.getByText("Neue Version verfügbar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Neu laden" }));
    expect(state.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it("can be postponed", async () => {
    state.needRefresh = true;
    renderWithProviders(<UpdatePrompt />);
    await userEvent.click(screen.getByRole("button", { name: "Später" }));
    expect(state.setNeedRefresh).toHaveBeenCalledWith(false);
  });

  it("checks for updates every hour", () => {
    vi.useFakeTimers();
    renderWithProviders(<UpdatePrompt />);
    const registration = { update: vi.fn(async () => undefined) };
    state.onRegisteredSW?.("/sw.js", registration);
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(registration.update).toHaveBeenCalledOnce();
    state.onRegisteredSW?.("/sw.js", undefined);
    vi.useRealTimers();
  });
});

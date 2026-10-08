/** MOBILE-001: installable app. */

import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync, existsSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockFetch } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { QuickAddTenner } from "../tenners/QuickAddTenner";
import { InstallAppSettings } from "./InstallAppSettings";
import { initInstallPrompt, isIos, isStandalone } from "./installPrompt";

interface Manifest {
  name: string;
  short_name: string;
  start_url: string;
  scope: string;
  display: string;
  theme_color: string;
  background_color: string;
  icons: { src: string; sizes: string; type: string; purpose: string }[];
  shortcuts: { name: string; url: string }[];
}

const manifest = JSON.parse(readFileSync("public/manifest.json", "utf8")) as Manifest;
const indexHtml = readFileSync("index.html", "utf8");

describe("web app manifest", () => {
  it("has the fields browsers require for installation", () => {
    expect(manifest).toMatchObject({
      name: "Zentrale",
      short_name: "Zentrale",
      start_url: "/dashboard",
      scope: "/",
      display: "standalone",
    });
    expect(manifest.theme_color).toBe("#1976d2");
    expect(manifest.background_color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("references existing PNG icons of 192 and 512 px, including a maskable one", () => {
    for (const icon of manifest.icons) expect(existsSync(`public${icon.src}`)).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === "192x192" && i.purpose === "any")).toBe(true);
    expect(manifest.icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
    expect(manifest.icons.some((i) => i.purpose === "maskable")).toBe(true);
  });

  it("offers the shortcuts Quick Add and Today", () => {
    expect(manifest.shortcuts.map((s) => s.url)).toEqual(["/tenners?quickAdd=1", "/dashboard"]);
  });

  it("is linked from index.html together with the iOS tags", () => {
    expect(indexHtml).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(indexHtml).toContain('<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />');
    expect(indexHtml).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(existsSync("public/icons/apple-touch-icon.png")).toBe(true);
  });
});

describe("install entry in the settings", () => {
  let cleanup: () => void;
  const userAgent = navigator.userAgent;

  beforeEach(() => {
    mockFetch({});
    cleanup = initInstallPrompt(window);
  });

  afterEach(() => {
    cleanup();
    Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  });

  function firePrompt(outcome: "accepted" | "dismissed" = "accepted") {
    const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
      prompt: vi.fn(async () => undefined),
      userChoice: Promise.resolve({ outcome }),
    });
    act(() => {
      window.dispatchEvent(event);
    });
    return event;
  }

  it("is hidden where installing is not possible", () => {
    renderWithProviders(<InstallAppSettings />);
    expect(screen.queryByText("App installieren")).not.toBeInTheDocument();
  });

  it("offers the browser prompt once it is available and reports the installation", async () => {
    renderWithProviders(<InstallAppSettings />);
    const event = firePrompt();
    expect(event.defaultPrevented).toBe(true);
    await userEvent.click(screen.getByRole("button", { name: "App installieren" }));
    expect(event.prompt).toHaveBeenCalledOnce();
    // A prompt can be used only once.
    expect(screen.queryByRole("button", { name: "App installieren" })).not.toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event("appinstalled"));
    });
    expect(screen.getByText("Die Zentrale ist auf diesem Gerät als App installiert.")).toBeInTheDocument();
  });

  it("explains Add to Home Screen on iOS", () => {
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
      configurable: true,
    });
    renderWithProviders(<InstallAppSettings />);
    expect(screen.getByText("„Zum Home-Bildschirm“ wählen.")).toBeInTheDocument();
  });
});

describe("platform detection", () => {
  it("recognizes iPhone, iPad (as touch Mac) and others", () => {
    expect(isIos({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 })).toBe(
      true,
    );
    expect(isIos({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe(true);
    expect(isIos({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: "Mozilla/5.0 (Linux; Android 15)", maxTouchPoints: 5 })).toBe(false);
  });

  it("recognizes the standalone display mode", () => {
    const fake = (matches: boolean, standalone?: boolean) =>
      ({ matchMedia: () => ({ matches }), navigator: { standalone } }) as unknown as Window;
    expect(isStandalone(fake(true))).toBe(true);
    expect(isStandalone(fake(false, true))).toBe(true);
    expect(isStandalone(fake(false))).toBe(false);
  });
});

describe("Quick Add shortcut", () => {
  it("focuses the Quick Add input when opened with ?quickAdd=1", async () => {
    mockFetch({ "GET /household": { status: 200, body: { success: true, data: { timezone: "Europe/Berlin" } } } });
    renderWithProviders(<QuickAddTenner />, { route: "/tenners?quickAdd=1" });
    expect(await screen.findByRole("textbox", { name: "Was soll eine Aufgabe werden?" })).toHaveFocus();
  });

  it("does not grab the focus otherwise", async () => {
    mockFetch({});
    renderWithProviders(<QuickAddTenner />, { route: "/dashboard" });
    expect(await screen.findByRole("textbox", { name: "Was soll eine Aufgabe werden?" })).not.toHaveFocus();
  });
});

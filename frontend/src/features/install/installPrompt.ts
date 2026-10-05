/**
 * Install support (MOBILE-001). Chrome/Edge/Android fire `beforeinstallprompt` early, often before the settings page
 * is open, so it is captured once at startup and offered later from the settings ("Install app"). iOS has no prompt:
 * the settings show the "Share → Add to Home Screen" steps instead.
 */

import { useSyncExternalStore } from "react";

/** Chromium's install event (not in the TypeScript DOM library). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallStatus = "installed" | "available" | "ios" | "unsupported";

let deferred: BeforeInstallPromptEvent | null = null;
let installedNow = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Registers the listeners; call once before rendering. Returns a cleanup (for tests). */
export function initInstallPrompt(target: Window = window): () => void {
  const onPrompt = (event: Event) => {
    // Suppress the browser's own mini-infobar; the settings offer the install entry instead.
    event.preventDefault();
    deferred = event as BeforeInstallPromptEvent;
    notify();
  };
  const onInstalled = () => {
    deferred = null;
    installedNow = true;
    notify();
  };
  target.addEventListener("beforeinstallprompt", onPrompt);
  target.addEventListener("appinstalled", onInstalled);
  return () => {
    target.removeEventListener("beforeinstallprompt", onPrompt);
    target.removeEventListener("appinstalled", onInstalled);
    deferred = null;
    installedNow = false;
  };
}

/** Running as an installed app (standalone display mode, or iOS home-screen app). */
export function isStandalone(target: Window = window): boolean {
  return (
    target.matchMedia?.("(display-mode: standalone)").matches === true ||
    (target.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPhone, iPod or iPad (iPadOS reports itself as a Mac with touch). */
export function isIos(navigator: Pick<Navigator, "userAgent" | "maxTouchPoints">): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

function status(): InstallStatus {
  if (installedNow || isStandalone()) return "installed";
  if (deferred) return "available";
  return isIos(window.navigator) ? "ios" : "unsupported";
}

/** Shows the browser's install dialog; resolves with the user's choice (dismissed if unavailable). */
export async function promptInstall(): Promise<"accepted" | "dismissed"> {
  const event = deferred;
  if (!event) return "dismissed";
  await event.prompt();
  const { outcome } = await event.userChoice;
  // A prompt can be shown only once.
  deferred = null;
  notify();
  return outcome;
}

export function useInstallStatus(): InstallStatus {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    status,
    () => "unsupported",
  );
}

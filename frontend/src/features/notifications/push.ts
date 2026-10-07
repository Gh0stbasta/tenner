/**
 * Browser push on this device (NOTIFICATION-009): permission, PushManager subscription with the VAPID public key and
 * registration at PUT /users/{userId}/push-subscription. The service worker shows the messages (public/push-sw.js).
 */

import { apiClient } from "../../api/client";
import { config } from "../../config";
import { z } from "zod";

export type PushState = "unsupported" | "not-configured" | "denied" | "off" | "on";

const subscriptionResponseSchema = z.object({ devices: z.number() });

/** Push needs a service worker, PushManager and Notification (iPhone/iPad: only when Tenner is installed). */
export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** True on iPhone/iPad Safari that is not running as an installed app (push only works installed, iOS 16.4+). */
export function needsInstallForPush(): boolean {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
  return ios && !standalone;
}

async function registration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.ready;
}

export async function pushState(publicKey: string = config.webPushPublicKey): Promise<PushState> {
  if (!isPushSupported()) return "unsupported";
  if (!publicKey) return "not-configured";
  if (Notification.permission === "denied") return "denied";
  const subscription = await (await registration()).pushManager.getSubscription();
  return subscription ? "on" : "off";
}

/** "BASE64URL" → bytes for applicationServerKey. */
export function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

/** Ask for permission, subscribe this browser and register it for the member. */
export async function enablePush(userId: string, publicKey: string = config.webPushPublicKey): Promise<PushState> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const manager = (await registration()).pushManager;
  const subscription =
    (await manager.getSubscription()) ??
    (await manager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToBytes(publicKey) }));
  await apiClient.put(`/users/${encodeURIComponent(userId)}/push-subscription`, {
    schema: subscriptionResponseSchema,
    body: subscription.toJSON(),
  });
  return "on";
}

/** Unregister this browser for the member and unsubscribe it. */
export async function disablePush(userId: string): Promise<PushState> {
  const subscription = await (await registration()).pushManager.getSubscription();
  if (subscription) {
    await apiClient.delete(`/users/${encodeURIComponent(userId)}/push-subscription`, {
      schema: z.unknown(),
      body: { endpoint: subscription.endpoint },
    });
    await subscription.unsubscribe();
  }
  return "off";
}

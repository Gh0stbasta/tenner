/* Tenner push handling, imported by the generated service worker (vite.config.ts → importScripts).
 * NOTIFICATION-009: show the messages the notifier sends and open Tenner on tap.
 * NOTIFICATION-011: „✅ Erledigt“ / „⏰ Später“ buttons send their signed token to POST /push-actions without opening
 * the app (Android, desktop; iOS shows no buttons, a tap opens the Tenner).
 * Payload: { title, body, url, tag, tennerId?, actionUrl?, actions?: [{ action, title, token }] }. */

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Tenner", body: event.data ? event.data.text() : "" };
  }
  const actions = Array.isArray(payload.actions) ? payload.actions : [];
  const tokens = Object.fromEntries(actions.map((entry) => [entry.action, entry.token]));
  event.waitUntil(
    self.registration.showNotification(payload.title || "Tenner", {
      body: payload.body || "",
      tag: payload.tag || "tenner",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "de",
      actions: actions.map((entry) => ({ action: entry.action, title: entry.title })),
      data: { url: payload.url || "/", actionUrl: payload.actionUrl, tokens },
    }),
  );
});

/** Focus an open Tenner window (and navigate it), or open a new one. */
async function openTenner(url) {
  const target = new URL(url, self.location.origin).href;
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const client of windows) {
    if (new URL(client.url).origin === self.location.origin) {
      await client.focus();
      if ("navigate" in client) await client.navigate(target);
      return;
    }
  }
  await self.clients.openWindow(target);
}

/** Feedback after a button: a short notification that replaces the reminder. */
function confirm(tag, body) {
  return self.registration.showNotification("Tenner", {
    body,
    tag,
    icon: "/icons/icon-192.png",
    lang: "de",
    silent: true,
  });
}

/** Send a button's token; on any failure the Tenner opens, so nothing is lost. */
async function runAction(data, action, tag) {
  const token = data.tokens && data.tokens[action];
  if (!data.actionUrl || !token) return openTenner(data.url);
  try {
    const response = await fetch(data.actionUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (!response.ok) return openTenner(data.url);
    const result = (await response.json()).data || {};
    if (result.result === "COMPLETED") return confirm(tag, `✅ Erledigt${result.title ? `: ${result.title}` : ""}`);
    if (result.result === "ALREADY_DONE") return confirm(tag, "✅ War schon erledigt.");
    if (result.result === "SNOOZED") {
      const time = new Date(result.remindAt).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
      return confirm(tag, `⏰ Erinnere dich um ${time} Uhr wieder.`);
    }
    return openTenner(data.url);
  } catch {
    return openTenner(data.url);
  }
}

self.addEventListener("notificationclick", (event) => {
  const data = event.notification.data || {};
  const tag = event.notification.tag;
  event.notification.close();
  if (event.action === "done" || event.action === "snooze") {
    event.waitUntil(runAction(data, event.action, tag));
    return;
  }
  event.waitUntil(openTenner(data.url || "/"));
});

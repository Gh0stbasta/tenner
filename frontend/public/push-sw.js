/* Tenner push handling (NOTIFICATION-009), imported by the generated service worker (vite.config.ts → importScripts).
 * Shows the messages the notifier sends and opens Tenner on tap. Payload: { title, body, url, tag }. */

self.addEventListener("push", (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Tenner", body: event.data ? event.data.text() : "" };
  }
  const title = payload.title || "Tenner";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      tag: payload.tag || "tenner",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      lang: "de",
      data: { url: payload.url || "/" },
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

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(openTenner(event.notification.data?.url || "/"));
});

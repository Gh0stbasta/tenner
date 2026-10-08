import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readConfig } from "../../config";
import { mockFetch, ok } from "../../tests/fetchMock";
import { renderWithProviders } from "../../tests/render";
import { disablePush, enablePush, pushState, urlBase64ToBytes } from "./push";
import { PushDeviceSetting } from "./PushDeviceSetting";

const KEY = "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4";
const SUBSCRIPTION_JSON = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  expirationTime: null,
  keys: { p256dh: "p", auth: "a" },
};

function installPush({
  subscribed = false,
  permission = "default" as NotificationPermission,
  grant = "granted" as NotificationPermission,
} = {}) {
  let current: { endpoint: string; toJSON: () => unknown; unsubscribe: ReturnType<typeof vi.fn> } | null = null;
  const makeSubscription = () => ({
    endpoint: SUBSCRIPTION_JSON.endpoint,
    toJSON: () => SUBSCRIPTION_JSON,
    unsubscribe: vi.fn(async () => true),
  });
  if (subscribed) current = makeSubscription();
  const pushManager = {
    getSubscription: vi.fn(async () => current),
    subscribe: vi.fn(async () => (current = makeSubscription())),
  };
  vi.stubGlobal("PushManager", function PushManager() {});
  const notification = Object.assign(function Notification() {}, {
    permission,
    requestPermission: vi.fn(async () => grant),
  });
  vi.stubGlobal("Notification", notification);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) },
  });
  return { pushManager, notification, current: () => current };
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("push helpers (NOTIFICATION-009)", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));

  it("reads the VAPID key from the build configuration", () => {
    expect(readConfig({ VITE_WEB_PUSH_PUBLIC_KEY: ` ${KEY} ` }).webPushPublicKey).toBe(KEY);
    expect(readConfig({}).webPushPublicKey).toBe("");
  });

  it("decodes the base64url key to the 65-byte application server key", () => {
    const bytes = urlBase64ToBytes(KEY);
    expect(bytes).toHaveLength(65);
    expect(bytes[0]).toBe(4);
  });

  it("reports the state of this device", async () => {
    expect(await pushState(KEY)).toBe("unsupported");
    installPush();
    expect(await pushState("")).toBe("not-configured");
    expect(await pushState(KEY)).toBe("off");
    installPush({ subscribed: true });
    expect(await pushState(KEY)).toBe("on");
    installPush({ permission: "denied" });
    expect(await pushState(KEY)).toBe("denied");
  });

  it("subscribes with the VAPID key and registers the device; disabling removes it", async () => {
    const fetchMock = mockFetch({
      "PUT /users/STEFAN/push-subscription": ok({ devices: 1 }),
      "DELETE /users/STEFAN/push-subscription": ok({}),
    });
    const push = installPush();
    expect(await enablePush("STEFAN", KEY)).toBe("on");
    expect(push.pushManager.subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToBytes(KEY),
    });
    expect(fetchMock.calls().find((call) => call.key === "PUT /users/STEFAN/push-subscription")?.body).toEqual(
      SUBSCRIPTION_JSON,
    );
    const subscription = push.current();
    expect(await disablePush("STEFAN")).toBe("off");
    expect(fetchMock.calls().find((call) => call.key === "DELETE /users/STEFAN/push-subscription")?.body).toEqual({
      endpoint: SUBSCRIPTION_JSON.endpoint,
    });
    expect(subscription?.unsubscribe).toHaveBeenCalled();
  });

  it("does not subscribe when the permission is refused", async () => {
    const denied = installPush({ grant: "denied" });
    expect(await enablePush("STEFAN", KEY)).toBe("denied");
    expect(denied.pushManager.subscribe).not.toHaveBeenCalled();
    installPush({ grant: "default" });
    expect(await enablePush("STEFAN", KEY)).toBe("off");
  });
});

describe("PushDeviceSetting (NOTIFICATION-009)", () => {
  beforeEach(() => vi.spyOn(console, "info").mockImplementation(() => undefined));

  it("renders nothing while push is not configured", async () => {
    installPush();
    const { container } = renderWithProviders(<PushDeviceSetting userId="STEFAN" preferencesKey={["p"]} />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("explains unsupported browsers and the iPhone install requirement", async () => {
    vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
    renderWithProviders(<PushDeviceSetting userId="STEFAN" preferencesKey={["p"]} publicKey={KEY} />);
    expect(await screen.findByText(/nur, wenn die Zentrale als App installiert ist/)).toBeInTheDocument();
  });

  it("enables push on this device, refreshes the channels and can disable it again", async () => {
    mockFetch({
      "PUT /users/STEFAN/push-subscription": ok({ devices: 1 }),
      "DELETE /users/STEFAN/push-subscription": ok({}),
    });
    installPush();
    const { queryClient } = renderWithProviders(
      <PushDeviceSetting userId="STEFAN" preferencesKey={["notification-preferences", "STEFAN"]} publicKey={KEY} />,
    );
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await userEvent.click(await screen.findByRole("button", { name: "Push aktivieren" }));
    expect(await screen.findByText("Push auf diesem Gerät aktiviert.")).toBeInTheDocument();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["notification-preferences", "STEFAN"] });
    await userEvent.click(screen.getByRole("button", { name: "Deaktivieren" }));
    expect(await screen.findByText("Push auf diesem Gerät deaktiviert.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Push aktivieren" })).toBeInTheDocument();
  });

  it("explains a blocked permission", async () => {
    installPush({ permission: "denied" });
    renderWithProviders(<PushDeviceSetting userId="STEFAN" preferencesKey={["p"]} publicKey={KEY} />);
    expect(await screen.findByText(/Benachrichtigungen sind für die Zentrale blockiert/)).toBeInTheDocument();
  });

  it("reports a failed registration", async () => {
    mockFetch({});
    installPush();
    renderWithProviders(<PushDeviceSetting userId="STEFAN" preferencesKey={["p"]} publicKey={KEY} />);
    await userEvent.click(await screen.findByRole("button", { name: "Push aktivieren" }));
    expect(await screen.findByText(/^Push konnte nicht geändert werden\./)).toBeInTheDocument();
  });
});

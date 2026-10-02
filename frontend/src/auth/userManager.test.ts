import { beforeEach, describe, expect, it, vi } from "vitest";

const instances: {
  settings: Record<string, unknown>;
  getUser: ReturnType<typeof vi.fn>;
  signinSilent: ReturnType<typeof vi.fn>;
  signinRedirect: ReturnType<typeof vi.fn>;
}[] = [];

vi.mock("oidc-client-ts", () => ({
  WebStorageStateStore: class {
    constructor(readonly options: { store: Storage }) {}
  },
  UserManager: class {
    getUser = vi.fn();
    signinSilent = vi.fn();
    signinRedirect = vi.fn(async () => undefined);
    constructor(readonly settings: Record<string, unknown>) {
      instances.push(this as never);
    }
  },
}));

const { createApiAuth, createUserManager, redirectToLogin } = await import("./userManager");
const AUTH = {
  issuerUrl: "https://cognito-idp.eu-central-1.amazonaws.com/pool",
  clientId: "client",
  loginUrl: "https://login",
};

describe("createUserManager", () => {
  beforeEach(() => (instances.length = 0));

  it("configures the code flow, scopes, callback and localStorage", () => {
    createUserManager(AUTH, "https://app.example");
    const [instance] = instances;
    if (!instance) throw new Error("UserManager not created");
    const { settings } = instance;
    expect(settings).toMatchObject({
      authority: AUTH.issuerUrl,
      client_id: "client",
      redirect_uri: "https://app.example/auth/callback",
      post_logout_redirect_uri: "https://app.example/",
      response_type: "code",
      scope: "openid email",
      automaticSilentRenew: true,
      extraQueryParams: { lang: "de", identity_provider: "Google" },
    });
    expect((settings.userStore as { options: { store: Storage } }).options.store).toBe(window.localStorage);
  });
});

describe("createApiAuth", () => {
  beforeEach(() => (instances.length = 0));

  function setup() {
    const manager = createUserManager(AUTH, "https://app.example");
    const [instance] = instances;
    if (!instance) throw new Error("UserManager not created");
    return { manager, instance, apiAuth: createApiAuth(manager) };
  }

  it("returns the ID token of a valid session", async () => {
    const { instance, apiAuth } = setup();
    instance.getUser.mockResolvedValue({ expired: false, id_token: "id-1" });
    await expect(apiAuth.getToken()).resolves.toBe("id-1");
    expect(instance.signinSilent).not.toHaveBeenCalled();
  });

  it("refreshes an expired session", async () => {
    const { instance, apiAuth } = setup();
    instance.getUser.mockResolvedValue({ expired: true, id_token: "old" });
    instance.signinSilent.mockResolvedValue({ id_token: "new" });
    await expect(apiAuth.getToken()).resolves.toBe("new");
  });

  it("returns no token without a session or when the refresh fails", async () => {
    const { instance, apiAuth } = setup();
    instance.getUser.mockResolvedValue(null);
    await expect(apiAuth.getToken()).resolves.toBeUndefined();
    instance.signinSilent.mockRejectedValue(new Error("invalid_grant"));
    await expect(apiAuth.refreshToken()).resolves.toBeUndefined();
  });

  it("redirects to the login and returns to the current page", async () => {
    const { manager, instance, apiAuth } = setup();
    window.history.pushState({}, "", "/tenners?x=1");
    apiAuth.onUnauthorized();
    await redirectToLogin(manager);
    expect(instance.signinRedirect).toHaveBeenCalledWith({ state: { returnTo: "/tenners?x=1" } });
    window.history.pushState({}, "", "/");
  });
});

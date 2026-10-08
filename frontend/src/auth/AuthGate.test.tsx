import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCurrentUser } from "../features/completions/CurrentUserProvider";
import { mockFetch, ok } from "../tests/fetchMock";
import { renderWithProviders } from "../tests/render";
import { AuthCallbackPage } from "./AuthCallbackPage";
import { AuthConfigMissing } from "./AuthConfigMissing";
import { AuthGate } from "./AuthGate";
import { Route, Routes } from "react-router";

let authState: Record<string, unknown> = {};
vi.mock("react-oidc-context", () => ({ useAuth: () => authState }));

function setAuth(state: Record<string, unknown>) {
  authState = {
    isLoading: false,
    isAuthenticated: false,
    error: undefined,
    activeNavigator: undefined,
    user: undefined,
    signinRedirect: vi.fn(async () => undefined),
    ...state,
  };
}

function Protected() {
  return <p>Geschützt für {useCurrentUser()}</p>;
}

function renderGate(route = "/tenners?status=all", onLogout = vi.fn()) {
  renderWithProviders(
    <AuthGate onLogout={onLogout}>
      <Protected />
    </AuthGate>,
    { route, withoutSession: true },
  );
  return onLogout;
}

describe("AuthGate", () => {
  beforeEach(() => setAuth({}));

  it("redirects to the German login and remembers the page", () => {
    renderGate();
    expect(authState.signinRedirect).toHaveBeenCalledOnce();
    expect(authState.signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: "/tenners?status=all" },
      extraQueryParams: { lang: "de", identity_provider: "Google" },
    });
    expect(screen.getByRole("status", { name: "Anmeldung wird geprüft" })).toBeInTheDocument();
  });

  it("waits while the session loads or a navigator is active", () => {
    setAuth({ isLoading: true });
    renderGate();
    expect(authState.signinRedirect).not.toHaveBeenCalled();
    setAuth({ activeNavigator: "signinSilent" });
    renderGate();
    expect(authState.signinRedirect).not.toHaveBeenCalled();
  });

  it("provides the user from the token to the app", () => {
    setAuth({ isAuthenticated: true, user: { profile: { "cognito:groups": ["household:default:JULIA"] } } });
    renderGate();
    expect(screen.getByText("Geschützt für JULIA")).toBeInTheDocument();
  });

  it("offline with a stored but expired session: opens the app without a login redirect (MOBILE-003)", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    setAuth({
      isAuthenticated: false,
      error: new Error("silent renew failed"),
      user: { expired: true, profile: { "cognito:groups": ["household:default:JULIA"] } },
    });
    renderGate();
    expect(screen.getByText("Geschützt für JULIA")).toBeInTheDocument();
    expect(authState.signinRedirect).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("online with an expired stored session: renews silently before redirecting (MOBILE-003)", async () => {
    setAuth({
      user: { expired: true, profile: { "cognito:groups": ["household:default:JULIA"] } },
      signinSilent: vi.fn(async () => {
        throw new Error("refresh token expired");
      }),
    });
    renderGate();
    expect(authState.signinSilent).toHaveBeenCalledOnce();
    await vi.waitFor(() => expect(authState.signinRedirect).toHaveBeenCalledOnce());
  });

  it("offline without a stored session: still asks for the login", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    renderGate();
    expect(authState.signinRedirect).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  it("first login: shows the household assignment instead of the app", async () => {
    mockFetch({
      "GET /onboarding": ok({
        assignedTo: null,
        members: [{ userId: "STEFAN", displayName: "Stefan", available: true }],
      }),
    });
    setAuth({ isAuthenticated: true, user: { profile: {} } });
    const onLogout = renderGate();
    expect(await screen.findByRole("heading", { name: "Willkommen in der Zentrale" })).toBeInTheDocument();
    expect(screen.queryByText(/Geschützt/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Abmelden" }));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("after the assignment: refreshes the session and redirects to the dashboard", async () => {
    mockFetch({
      "GET /onboarding": ok({
        assignedTo: null,
        members: [{ userId: "JULIA", displayName: "Julia", available: true }],
      }),
      "POST /onboarding/assignment": ok({ userId: "JULIA" }, 201),
    });
    const signinSilent = vi.fn(async () => {
      setAuth({ isAuthenticated: true, user: { profile: { "cognito:groups": ["household:default:JULIA"] } } });
      return { profile: { "cognito:groups": ["household:default:JULIA"] } };
    });
    setAuth({ isAuthenticated: true, user: { profile: {} }, signinSilent });
    renderWithProviders(
      <Routes>
        <Route path="/dashboard" element={<p>Dashboard</p>} />
        <Route
          path="*"
          element={
            <AuthGate onLogout={vi.fn()}>
              <Protected />
            </AuthGate>
          }
        />
      </Routes>,
      { route: "/tenners", withoutSession: true },
    );
    await userEvent.click(await screen.findByRole("button", { name: "Ich bin Julia" }));
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    expect(signinSilent).toHaveBeenCalledOnce();
  });

  it("shows login errors with a retry", async () => {
    setAuth({ error: new Error("invalid_grant") });
    renderGate();
    expect(screen.getByText("Anmeldung fehlgeschlagen")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(authState.signinRedirect).toHaveBeenCalledOnce();
  });
});

describe("AuthCallbackPage", () => {
  beforeEach(() => setAuth({}));

  function renderCallback() {
    renderWithProviders(
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/tenners/t-1" element={<p>Detail</p>} />
        <Route path="/dashboard" element={<p>Dashboard</p>} />
      </Routes>,
      { route: "/auth/callback?code=abc&state=xyz", withoutSession: true },
    );
  }

  it("waits for the code exchange", () => {
    renderCallback();
    expect(screen.getByRole("status", { name: "Anmeldung wird abgeschlossen" })).toBeInTheDocument();
  });

  it("returns to the original page", () => {
    setAuth({ isAuthenticated: true, user: { state: { returnTo: "/tenners/t-1" } } });
    renderCallback();
    expect(screen.getByText("Detail")).toBeInTheDocument();
  });

  it("ignores external return targets", () => {
    setAuth({ isAuthenticated: true, user: { state: { returnTo: "//evil.example" } } });
    renderCallback();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("shows errors", () => {
    setAuth({ error: new Error("state mismatch") });
    renderCallback();
    expect(screen.getByText("Der Anmeldevorgang konnte nicht abgeschlossen werden.")).toBeInTheDocument();
  });
});

describe("AuthConfigMissing", () => {
  it("explains the missing configuration", () => {
    renderWithProviders(<AuthConfigMissing />, { withoutSession: true });
    expect(screen.getByText("Anmeldung nicht eingerichtet")).toBeInTheDocument();
  });
});

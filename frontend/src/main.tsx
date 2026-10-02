import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AuthProvider } from "react-oidc-context";
import { BrowserRouter } from "react-router";
import { configureApiAuth } from "./api/client";
import { createQueryClient } from "./api/queryClient";
import { AppProviders } from "./AppProviders";
import { AuthConfigMissing } from "./auth/AuthConfigMissing";
import { buildLogoutUrl } from "./auth/session";
import { createApiAuth, createUserManager } from "./auth/userManager";
import { config } from "./config";
import { AppRoutes } from "./routes/AppRoutes";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found.");

function createApp() {
  const auth = config.auth;
  if (!auth) return <AuthConfigMissing />;

  // One OIDC client per page load; the API client uses it for tokens (SECURITY-003).
  const userManager = createUserManager(auth);
  configureApiAuth(createApiAuth(userManager));
  const logout = () => {
    void userManager.removeUser().finally(() => window.location.assign(buildLogoutUrl(auth, window.location.origin)));
  };

  return (
    <AuthProvider userManager={userManager}>
      <BrowserRouter>
        <AppRoutes onLogout={logout} />
      </BrowserRouter>
    </AuthProvider>
  );
}

createRoot(root).render(
  <StrictMode>
    <AppProviders queryClient={createQueryClient()}>{createApp()}</AppProviders>
  </StrictMode>,
);

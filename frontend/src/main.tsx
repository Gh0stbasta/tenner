import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { createQueryClient } from "./api/queryClient";
import { AppProviders } from "./AppProviders";
import { AppRoutes } from "./routes/AppRoutes";

const root = document.getElementById("root");
if (!root) throw new Error("Root element #root not found.");

createRoot(root).render(
  <StrictMode>
    <AppProviders queryClient={createQueryClient()}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);

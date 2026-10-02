/** Route table (FRONTEND-001). Pages are added by the feature tickets. */

import { Navigate, Route, Routes } from "react-router";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { TennersPage } from "../features/tenners/TennersPage";
import { AppLayout } from "../layouts/AppLayout";
import { ComingSoonPage } from "../pages/ComingSoonPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tenners" element={<TennersPage />} />
        <Route path="analytics" element={<ComingSoonPage title="Auswertung" />} />
        <Route path="settings" element={<ComingSoonPage title="Einstellungen" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

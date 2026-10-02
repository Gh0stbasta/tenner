/** Route table (FRONTEND-001). Pages are added by the feature tickets. */

import { Navigate, Route, Routes } from "react-router";
import { AppLayout } from "../layouts/AppLayout";
import { ComingSoonPage } from "../pages/ComingSoonPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<ComingSoonPage title="Dashboard" />} />
        <Route path="tenners" element={<ComingSoonPage title="Tenner" />} />
        <Route path="analytics" element={<ComingSoonPage title="Auswertung" />} />
        <Route path="settings" element={<ComingSoonPage title="Einstellungen" />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

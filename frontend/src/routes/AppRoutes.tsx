/** Route table (FRONTEND-001). Everything except the login callback requires a session (SECURITY-003). */

import { Navigate, Route, Routes } from "react-router";
import { AuthCallbackPage } from "../auth/AuthCallbackPage";
import { AuthGate } from "../auth/AuthGate";
import { UserMenu } from "../auth/UserMenu";
import { DashboardPage } from "../features/dashboard/DashboardPage";
import { TennerDetailPage } from "../features/tenner-detail/TennerDetailPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { TennersPage } from "../features/tenners/TennersPage";
import { AppLayout } from "../layouts/AppLayout";
import { AnalyticsPage } from "../features/analytics/AnalyticsPage";
import { MealPlanPage } from "../features/meals/MealPlanPage";
import { NotFoundPage } from "../pages/NotFoundPage";

export interface AppRoutesProps {
  /** Ends the session (SECURITY-003). */
  readonly onLogout: () => void;
}

export function AppRoutes({ onLogout }: AppRoutesProps) {
  return (
    <Routes>
      <Route path="auth/callback" element={<AuthCallbackPage />} />
      <Route
        element={
          <AuthGate onLogout={onLogout}>
            <AppLayout headerActions={<UserMenu />} />
          </AuthGate>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tenners" element={<TennersPage />} />
        <Route path="tenners/:tennerId" element={<TennerDetailPage />} />
        <Route path="essen" element={<MealPlanPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

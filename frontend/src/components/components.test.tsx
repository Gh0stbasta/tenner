import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../tests/render";
import { ConfirmDialog } from "./ConfirmDialog";
import { EmptyState, NoAnalyticsAvailable, NoDashboardData, NoTennersFound } from "./EmptyState";
import { ErrorAlert } from "./ErrorAlert";
import { ErrorBoundary } from "./ErrorBoundary";
import { PageLoading, SectionLoading, SkeletonList } from "./LoadingState";
import { PageHeader } from "./PageHeader";

function Thrower(): never {
  throw new Error("render failure");
}

describe("ErrorAlert", () => {
  it("shows the message and calls onRetry", async () => {
    const onRetry = vi.fn();
    renderWithProviders(<ErrorAlert message="Dashboard nicht ladbar." onRetry={onRetry} />);
    expect(screen.getByText("Dashboard nicht ladbar.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("has no retry button without onRetry", () => {
    renderWithProviders(<ErrorAlert title="Fehler" message="x" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title, description and action", () => {
    renderWithProviders(<EmptyState title="Leer" description="Nichts da" action={<button>Los</button>} />);
    expect(screen.getByText("Leer")).toBeInTheDocument();
    expect(screen.getByText("Nichts da")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Los" })).toBeInTheDocument();
  });

  it("provides preset empty states", () => {
    renderWithProviders(
      <>
        <NoTennersFound />
        <NoDashboardData />
        <NoAnalyticsAvailable />
      </>,
    );
    expect(screen.getByText("Keine Tenner gefunden")).toBeInTheDocument();
    expect(screen.getByText("🎉 Alles erledigt.")).toBeInTheDocument();
    expect(screen.getByText("Noch keine Auswertung")).toBeInTheDocument();
  });
});

describe("Loading components", () => {
  it("expose busy status regions", () => {
    renderWithProviders(
      <>
        <PageLoading />
        <SectionLoading />
        <SkeletonList count={2} label="Tenner werden geladen" />
      </>,
    );
    expect(screen.getByRole("status", { name: "Seite wird geladen" })).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status", { name: "Bereich wird geladen" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Tenner werden geladen" })).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders a level-1 heading, subtitle and actions", () => {
    renderWithProviders(<PageHeader title="Tenner" subtitle="3 aktiv" actions={<button>Neu</button>} />);
    expect(screen.getByRole("heading", { level: 1, name: "Tenner" })).toBeInTheDocument();
    expect(screen.getByText("3 aktiv")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Neu" })).toBeInTheDocument();
  });
});

describe("ErrorBoundary", () => {
  it("shows a fallback with a reload action instead of a blank page", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onReload = vi.fn();
    renderWithProviders(
      <ErrorBoundary onReload={onReload}>
        <Thrower />
      </ErrorBoundary>,
    );
    expect(screen.getByText("Etwas ist schiefgelaufen")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Neu laden" }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it("reloads the page by default", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    renderWithProviders(
      <ErrorBoundary>
        <Thrower />
      </ErrorBoundary>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Neu laden" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("renders children when nothing fails", () => {
    renderWithProviders(
      <ErrorBoundary>
        <p>Inhalt</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
  });
});

describe("ConfirmDialog", () => {
  it("calls confirm and cancel", async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderWithProviders(
      <ConfirmDialog
        open
        title="Archivieren?"
        message="Sicher?"
        confirmLabel="Archivieren"
        destructive
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Archivieren?" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Archivieren" }));
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

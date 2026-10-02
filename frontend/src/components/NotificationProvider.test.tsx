import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "../tests/render";
import { useNotify, type Notification } from "./NotificationProvider";

function Trigger({ notification }: { readonly notification: Notification }) {
  const notify = useNotify();
  return <button onClick={() => notify(notification)}>Auslösen</button>;
}

describe("NotificationProvider", () => {
  it("shows a message with an action and hides after the action", async () => {
    const onClick = vi.fn();
    renderWithProviders(<Trigger notification={{ message: "Erledigt", action: { label: "Rückgängig", onClick } }} />);
    await userEvent.click(screen.getByRole("button", { name: "Auslösen" }));
    expect(screen.getByText("Erledigt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(onClick).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByText("Erledigt")).not.toBeInTheDocument());
  });

  it("closes through the close button", async () => {
    renderWithProviders(<Trigger notification={{ message: "Fehler", severity: "error" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Auslösen" }));
    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(screen.queryByText("Fehler")).not.toBeInTheDocument());
  });

  it("requires the provider", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(<Trigger notification={{ message: "x" }} />)).toThrow(
      "useNotify must be used inside NotificationProvider.",
    );
  });
});

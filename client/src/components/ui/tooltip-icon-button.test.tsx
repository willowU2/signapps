/**
 * Unit tests for `<TooltipIconButton>`.
 *
 * The component exists specifically to close the dominant source of
 * axe `button-name` violations in the codebase (hand-wired
 * Tooltip+TooltipTrigger+Button icon buttons with no `aria-label`), so
 * the tests focus on the accessibility surface: label application,
 * icon aria-hiding, and tooltip text.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TooltipIconButton } from "./tooltip-icon-button";

/** TooltipPrimitive.Root requires a Provider ancestor — wrap each test. */
function renderWithProvider(ui: React.ReactNode) {
  return render(<TooltipProvider delayDuration={0}>{ui}</TooltipProvider>);
}

describe("<TooltipIconButton>", () => {
  it("applies `label` as the button's accessible name", () => {
    renderWithProvider(
      <TooltipIconButton label="Épingler la barre">
        <svg data-testid="icon" />
      </TooltipIconButton>,
    );
    const button = screen.getByRole("button", { name: "Épingler la barre" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label", "Épingler la barre");
  });

  it("marks a single-element child as aria-hidden", () => {
    renderWithProvider(
      <TooltipIconButton label="Fermer">
        <svg data-testid="icon" />
      </TooltipIconButton>,
    );
    const icon = screen.getByTestId("icon");
    expect(icon).toHaveAttribute("aria-hidden", "true");
  });

  it("forwards arbitrary button props (onClick, disabled, type)", () => {
    renderWithProvider(
      <TooltipIconButton
        label="Supprimer"
        type="submit"
        disabled
        data-testid="submit-delete"
      >
        <svg />
      </TooltipIconButton>,
    );
    const button = screen.getByTestId("submit-delete");
    expect(button).toHaveAttribute("type", "submit");
    expect(button).toBeDisabled();
  });

  it("forwards refs to the underlying <button>", () => {
    let captured: HTMLButtonElement | null = null;
    renderWithProvider(
      <TooltipIconButton
        label="Test ref"
        ref={(el) => {
          captured = el;
        }}
      >
        <svg />
      </TooltipIconButton>,
    );
    expect(captured).toBeInstanceOf(HTMLButtonElement);
    expect(captured).not.toBeNull();
    const button: HTMLButtonElement = captured!;
    expect(button.getAttribute("aria-label")).toBe("Test ref");
  });

  it("uses `tooltipText` for the tooltip when provided, keeping `label` as aria-label", () => {
    renderWithProvider(
      <TooltipIconButton label="Sauvegarder" tooltipText="Sauvegarder (Ctrl+S)">
        <svg />
      </TooltipIconButton>,
    );
    const button = screen.getByRole("button");
    // Accessible name stays clean; tooltip content carries the hint.
    expect(button).toHaveAttribute("aria-label", "Sauvegarder");
  });

  it("defaults variant to `ghost` and size to `icon`", () => {
    renderWithProvider(
      <TooltipIconButton label="Default visuals">
        <svg />
      </TooltipIconButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "ghost");
    expect(button).toHaveAttribute("data-size", "icon");
  });

  it("respects variant and size overrides", () => {
    renderWithProvider(
      <TooltipIconButton
        label="Destructive action"
        variant="destructive"
        size="icon-sm"
      >
        <svg />
      </TooltipIconButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("data-variant", "destructive");
    expect(button).toHaveAttribute("data-size", "icon-sm");
  });
});

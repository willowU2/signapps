/**
 * Tests for the a11y dev-mode warning on icon-only `<Button>`.
 *
 * The warning is the last line of defence against regressions of the
 * dominant `button-name` violation source — icon-only buttons with no
 * `aria-label`. Users who miss the warning in local dev land the
 * violation at the next axe run. Tests here guarantee the warning
 * fires when it should and stays quiet when it shouldn't.
 */
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("<Button> a11y dev-warn", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    warnSpy.mockRestore();
  });

  it("warns when size='icon' has no aria-label and only an icon child", () => {
    render(
      <Button size="icon">
        <svg />
      </Button>,
    );
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/\[a11y\]/);
    expect(warnSpy.mock.calls[0][0]).toMatch(/icon-only/);
  });

  it("warns for icon-sm / icon-xs / icon-lg sizes", () => {
    for (const size of ["icon-sm", "icon-xs", "icon-lg"] as const) {
      warnSpy.mockClear();
      render(
        <Button size={size}>
          <svg />
        </Button>,
      );
      expect(warnSpy).toHaveBeenCalled();
    }
  });

  it("stays quiet when aria-label is present", () => {
    render(
      <Button size="icon" aria-label="Close">
        <svg />
      </Button>,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("stays quiet when aria-labelledby is present", () => {
    render(
      <>
        <span id="lbl">Close</span>
        <Button size="icon" aria-labelledby="lbl">
          <svg />
        </Button>
      </>,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("stays quiet for non-icon sizes (default, sm, lg)", () => {
    for (const size of ["default", "sm", "lg"] as const) {
      warnSpy.mockClear();
      render(<Button size={size}>Click me</Button>);
      expect(warnSpy).not.toHaveBeenCalled();
    }
  });

  it("stays quiet in production mode even for icon-only buttons", () => {
    vi.stubEnv("NODE_ENV", "production");
    render(
      <Button size="icon">
        <svg />
      </Button>,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("stays quiet when asChild is true (Slot — consumer owns the button)", () => {
    render(
      <Button size="icon" asChild>
        <span aria-label="External link">
          <svg />
        </span>
      </Button>,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

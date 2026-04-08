import { type Page, type Locator } from "@playwright/test";

/**
 * Drag a source element onto a target using PointerEvent dispatch via
 * page.evaluate. @dnd-kit's PointerSensor reliably catches these synthetic
 * PointerEvents but misses Playwright's low-level `page.mouse.*` inputs.
 *
 * Both parameters are Playwright Locators — we resolve them to element
 * handles and pass them across the page boundary via `evaluateHandle`.
 */
export async function dndKitDrag(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<void> {
  const srcHandle = await source.elementHandle();
  const tgtHandle = await target.elementHandle();
  if (!srcHandle || !tgtHandle)
    throw new Error("dndKitDrag: missing element handle");

  await page.evaluate(
    ({ src, tgt }) => {
      const srcRect = src.getBoundingClientRect();
      const tgtRect = tgt.getBoundingClientRect();
      const sx = srcRect.left + srcRect.width / 2;
      const sy = srcRect.top + srcRect.height / 2;
      const tx = tgtRect.left + tgtRect.width / 2;
      const ty = tgtRect.top + tgtRect.height / 2;

      const makeEvent = (type: string, x: number, y: number, buttons: number) =>
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerType: "mouse",
          pointerId: 1,
          isPrimary: true,
          button: 0,
          buttons,
          clientX: x,
          clientY: y,
          screenX: x,
          screenY: y,
        });

      // pointerdown on the source itself so @dnd-kit's listener catches it.
      src.dispatchEvent(makeEvent("pointerdown", sx, sy, 1));
      // Small initial move satisfies @dnd-kit's activation constraint.
      document.dispatchEvent(makeEvent("pointermove", sx + 5, sy + 5, 1));
      // Mid-travel moves — @dnd-kit's collision detection tracks these.
      const midX = (sx + tx) / 2;
      const midY = (sy + ty) / 2;
      document.dispatchEvent(makeEvent("pointermove", midX, midY, 1));
      document.dispatchEvent(makeEvent("pointermove", tx, ty, 1));
      // Final pointerup on the target so elementFromPoint resolves to it.
      tgt.dispatchEvent(makeEvent("pointerup", tx, ty, 0));
    },
    { src: srcHandle, tgt: tgtHandle },
  );
}

/**
 * Drag & drop helpers for Playwright.
 *
 * Built-in `.dragTo()` fails for libraries that use HTML5 native events or
 * @dnd-kit (which the calendar uses). These helpers dispatch the correct
 * sequence of pointer events so interactions trigger @dnd-kit reducers.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Simulate a click-and-drag from one point to another on a source locator.
 * Used for "drag-to-create" on empty calendar slots.
 *
 * @param page      Playwright page
 * @param source    The element to start the drag on (e.g. a time slot)
 * @param deltaY    Vertical drag distance in pixels (positive = down)
 * @param deltaX    Horizontal drag distance (default 0)
 */
export async function dragToCreate(
  page: Page,
  source: Locator,
  deltaY: number,
  deltaX = 0,
): Promise<void> {
  const box = await source.boundingBox();
  if (!box) throw new Error("dragToCreate: source has no bounding box");

  const startX = box.x + box.width / 2;
  const startY = box.y + 5;
  const endX = startX + deltaX;
  const endY = startY + deltaY;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Intermediate steps help @dnd-kit detect a real drag (not a click).
  await page.mouse.move(startX + 2, startY + 2, { steps: 5 });
  await page.mouse.move(endX, endY, { steps: 10 });
  await page.mouse.up();
}

/**
 * Move an existing element by drag & drop from its current position to a target locator.
 * Used for moving calendar events between time slots or days.
 *
 * Uses explicit delays between steps to give @dnd-kit's PointerSensor time to
 * register activation — without them, Playwright's back-to-back events fire
 * before the sensor can transition from pointerdown → active drag.
 */
export async function dragElementTo(
  page: Page,
  source: Locator,
  target: Locator,
): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox)
    throw new Error("dragElementTo: missing bounding box");

  const startX = sourceBox.x + sourceBox.width / 2;
  const startY = sourceBox.y + sourceBox.height / 2;
  const endX = targetBox.x + targetBox.width / 2;
  const endY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.waitForTimeout(100); // allow @dnd-kit to register pointerdown
  // Small initial movement to trigger activation constraint
  await page.mouse.move(startX + 5, startY + 5, { steps: 10 });
  await page.waitForTimeout(50);
  await page.mouse.move(endX, endY, { steps: 25 });
  await page.waitForTimeout(100); // let @dnd-kit's collision detection settle
  await page.mouse.up();
  await page.waitForTimeout(150); // wait for the drag-end handler + re-render
}

/**
 * Resize an event by dragging its bottom edge.
 * Assumes the element has a resize handle at the bottom 6px.
 */
export async function resizeElementBottom(
  page: Page,
  event: Locator,
  deltaY: number,
): Promise<void> {
  const box = await event.boundingBox();
  if (!box) throw new Error("resizeElementBottom: event has no bounding box");

  const handleX = box.x + box.width / 2;
  const handleY = box.y + box.height - 3;

  await page.mouse.move(handleX, handleY);
  await page.mouse.down();
  await page.mouse.move(handleX, handleY + deltaY, { steps: 10 });
  await page.mouse.up();
}

/**
 * Keyboard-shortcut help overlay.
 *
 * Framework-free logic (toggle state) is kept separate from the DOM wiring
 * so the toggle behavior itself is unit-testable without a browser.
 */

const HELP_OVERLAY_ID = "help-overlay";
const TOGGLE_KEY = "?";

/** Pure toggle logic: given current visibility, returns the next state. */
export function nextHelpOverlayVisibility(current: boolean): boolean {
  return !current;
}

/**
 * Wires up the help overlay: finds the overlay element in the DOM and
 * toggles its visibility whenever the user presses "?".
 *
 * Safe to call once the DOM is ready. Does nothing (beyond a console
 * warning) if the overlay element isn't present in the page.
 */
export function initHelpOverlay(): void {
  const overlay = document.getElementById(HELP_OVERLAY_ID);
  if (!overlay) {
    console.warn(`initHelpOverlay: no element with id "${HELP_OVERLAY_ID}" found`);
    return;
  }

  let visible = false;
  overlay.hidden = !visible;

  const applyVisibility = (next: boolean): void => {
    visible = next;
    overlay.hidden = !visible;
  };

  document.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key !== TOGGLE_KEY) return;
    applyVisibility(nextHelpOverlayVisibility(visible));
  });

  const closeButton = overlay.querySelector<HTMLElement>("[data-help-close]");
  closeButton?.addEventListener("click", () => {
    applyVisibility(false);
  });
}

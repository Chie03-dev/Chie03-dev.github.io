/**
 * Theme handling.
 *
 * Two themes, no light mode: the deep navy on `:root` is the default, and the
 * pitch-black `.dark` variant is part of the containment reward. Breaking the
 * hero portrait's cage drops the site into it automatically; the navbar toggle
 * is for stepping back out (and re-caging puts it away again). Nothing is
 * persisted, because every visit starts locked - a stored preference could only
 * ever apply to a theme the visitor has not unlocked yet, so the choice lives
 * and dies with the page.
 */
const DARK_CLASS = "dark";

export function isDarkTheme(): boolean {
  return document.documentElement.classList.contains(DARK_CLASS);
}

export function setDarkTheme(dark: boolean): void {
  document.documentElement.classList.toggle(DARK_CLASS, dark);
}

/** Switches to whichever theme is not active and returns the new state. */
export function toggleDarkTheme(): boolean {
  setDarkTheme(!isDarkTheme());
  return isDarkTheme();
}

/**
 * Framework-free sound-mute state, persisted in localStorage so it survives
 * reloads. No actual audio playback yet — this just gives future sound
 * effects a single place to check "should I play?".
 */

const MUTE_STORAGE_KEY = "tilemap-io-muted";

/** Returns true if sound is currently muted (persisted in localStorage). */
export function isMuted(): boolean {
  return localStorage.getItem(MUTE_STORAGE_KEY) === "true";
}

/** Flips the mute state, persists it, and returns the new value. */
export function toggleMute(): boolean {
  const next = !isMuted();
  localStorage.setItem(MUTE_STORAGE_KEY, String(next));
  return next;
}

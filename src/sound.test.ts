import { describe, it, expect, beforeEach } from "vitest";
import { isMuted, toggleMute } from "./sound";

/**
 * Minimal localStorage polyfill for this test file. Node's default vitest
 * environment has no `localStorage` global (no jsdom configured for this
 * project), so we stand in a tiny Map-backed implementation that matches
 * the Web Storage API surface sound.ts actually uses.
 */
function installLocalStorageMock(): void {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => store.set(key, String(value)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  } as Storage;
}

installLocalStorageMock();

describe("sound mute state", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to unmuted when nothing is stored", () => {
    expect(isMuted()).toBe(false);
  });

  it("toggleMute flips the state and persists it", () => {
    expect(toggleMute()).toBe(true);
    expect(isMuted()).toBe(true);
    expect(localStorage.getItem("tilemap-io-muted")).toBe("true");

    expect(toggleMute()).toBe(false);
    expect(isMuted()).toBe(false);
    expect(localStorage.getItem("tilemap-io-muted")).toBe("false");
  });

  it("isMuted reflects whatever is persisted in localStorage", () => {
    localStorage.setItem("tilemap-io-muted", "true");
    expect(isMuted()).toBe(true);

    localStorage.setItem("tilemap-io-muted", "false");
    expect(isMuted()).toBe(false);
  });
});

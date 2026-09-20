/**
 * Link to the iki Electron kiosk.
 *
 * The kiosk posts two kinds of messages to the page (see iki/main.js):
 *   { kind: "tick", username, deviceId, ackString }  every second
 *   { kind: "keyboard-event", key }                  for Ctrl/Cmd+N, B and F
 * and reloads the page if it does not receive `ackString` back (as a plain
 * string, via window.parent.postMessage) within its `reloadAfterSec` window.
 * Every tick is therefore answered with an ack.
 */

export interface KioskState {
  ticks: number;
  lastTickAt: number | null;
  username: string;
  deviceId: string;
  ackString: string;
  acksSent: number;
  lastKey: string | null;
}

/** A few missed ticks are tolerated before the link is considered lost. */
const CONNECTED_WITHIN_MS = 3500;

const state: KioskState = {
  ticks: 0,
  lastTickAt: null,
  username: "",
  deviceId: "",
  ackString: "",
  acksSent: 0,
  lastKey: null,
};

const changeListeners = new Set<() => void>();
const keyListeners = new Set<(key: string) => void>();
const notify = () => changeListeners.forEach((fn) => fn());

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;
const text = (value: unknown) => (typeof value === "string" ? value : "");

const sendAck = () => {
  // An empty ack string means the kiosk's watchdog is disabled.
  if (!state.ackString) return;
  // Top-level page: parent === window. Framed page: parent is the kiosk shell.
  window.parent.postMessage(state.ackString, "*");
  state.acksSent++;
};

const onMessage = (e: MessageEvent) => {
  // Only the kiosk (this window, or the frame's parent) may drive us.
  if (e.source !== window && e.source !== window.parent) return;
  const data: unknown = e.data;
  // The ack we post ourselves is a string and lands here too; ignore it.
  if (!isRecord(data)) return;

  if (data.kind === "tick") {
    state.ticks++;
    state.lastTickAt = Date.now();
    state.username = text(data.username);
    state.deviceId = text(data.deviceId);
    state.ackString = text(data.ackString);
    sendAck();
    notify();
  } else if (data.kind === "keyboard-event" && typeof data.key === "string") {
    state.lastKey = data.key;
    keyListeners.forEach((fn) => fn(data.key as string));
    notify();
  }
};

let started = false;
export const startKioskLink = () => {
  if (started) return;
  started = true;
  window.addEventListener("message", onMessage);
};

export const kioskState = (): Readonly<KioskState> => state;

export const isKioskConnected = () =>
  state.lastTickAt !== null &&
  Date.now() - state.lastTickAt < CONNECTED_WITHIN_MS;

export const onKioskChange = (fn: () => void) => {
  changeListeners.add(fn);
  return () => void changeListeners.delete(fn);
};

export const onKioskKey = (fn: (key: string) => void) => {
  keyListeners.add(fn);
  return () => void keyListeners.delete(fn);
};

/** The device id doubles as a credential in the kiosk config, so never show it in full. */
export const maskSecret = (value: string) =>
  value
    ? `${value.slice(0, 2)}${"•".repeat(Math.max(0, value.length - 2))}`
    : "–";

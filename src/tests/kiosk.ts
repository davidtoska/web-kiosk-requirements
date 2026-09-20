import { h } from "../dom.ts";
import {
  isKioskConnected,
  kioskState,
  maskSecret,
  onKioskChange,
} from "../kiosk.ts";
import { createRows } from "../ui.ts";
import type { Status, Test } from "../types.ts";

const NO_TICK_TIMEOUT_MS = 5000;

const ago = (at: number | null) =>
  at === null ? "never" : `${((Date.now() - at) / 1000).toFixed(1)} s ago`;

export const kioskTest: Test = {
  id: "kiosk",
  title: "Kiosk link",
  summary:
    "Listens for the events sent by the iki Electron kiosk and answers every tick with the ack string, so the kiosk's watchdog does not reload the page.",
  run(ctx) {
    const rows = createRows();
    const link = rows.add("Link", "run", "Waiting for kiosk events…");
    const user = rows.add("Username");
    const device = rows.add("Device ID");
    const ack = rows.add("Ack string");
    const sent = rows.add("Acks sent");
    const tick = rows.add("Last tick");
    const key = rows.add("Last kiosk key");
    ctx.root.append(h("div", { class: "scroll-free" }, rows.root));

    const startedAt = Date.now();
    let reported: Status | null = null;
    const report = (status: Status, note: string) => {
      if (reported === status) return;
      reported = status;
      ctx.setStatus(status, note);
    };

    const refresh = () => {
      const s = kioskState();
      const connected = isKioskConnected();
      if (s.ticks === 0) {
        const waited = Date.now() - startedAt;
        if (waited > NO_TICK_TIMEOUT_MS) {
          link.set(
            "fail",
            "No events received — not running inside the kiosk?",
          );
          report("fail", "No kiosk events received");
        }
        return;
      }

      user.set("info", s.username || "–");
      device.set("info", maskSecret(s.deviceId));
      ack.set(
        s.ackString ? "ok" : "warn",
        s.ackString || "Empty — kiosk watchdog is disabled",
      );
      sent.set("info", String(s.acksSent));
      tick.set(
        connected ? "ok" : "fail",
        `${ago(s.lastTickAt)} · ${s.ticks} received`,
      );
      key.set(
        "info",
        s.lastKey
          ? `Ctrl+${s.lastKey.toUpperCase()}`
          : "None yet (try Ctrl+N, B or F)",
      );

      if (connected) {
        link.set("ok", "Connected");
        report(
          "pass",
          s.ackString
            ? `Receiving ticks, ack "${s.ackString}" sent back`
            : "Receiving ticks (ack watchdog disabled)",
        );
      } else {
        link.set("fail", "Lost contact with the kiosk");
        report("fail", "Lost contact with the kiosk");
      }
    };

    const timer = setInterval(refresh, 500);
    const unsubscribe = onKioskChange(refresh);
    ctx.onCleanup(() => {
      clearInterval(timer);
      unsubscribe();
    });
    refresh();
  },
};

import { h } from "../dom.ts";
import { overlay, stat } from "../ui.ts";
import type { Test } from "../types.ts";

const VIDEO_ID = "tUNbhYcY9Ik";
const YOUTUBE_ORIGIN = "https://www.youtube.com";

const PLAYER_STATES: Record<number, string> = {
  [-1]: "Unstarted",
  0: "Ended",
  1: "Playing",
  2: "Paused",
  3: "Buffering",
  5: "Cued",
};

export const youtubeTest: Test = {
  id: "youtube",
  title: "YouTube",
  summary:
    "Embeds a YouTube player and listens to its state. Press play and confirm picture and sound.",
  run(ctx) {
    const params = new URLSearchParams({
      enablejsapi: "1",
      rel: "0",
      origin: location.origin,
    });
    const frame = h("iframe", {
      src: `${YOUTUBE_ORIGIN}/embed/${VIDEO_ID}?${params}`,
      title: "YouTube video player",
      allow:
        "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
      referrerPolicy: "strict-origin-when-cross-origin",
      allowFullscreen: true,
    });
    const status = overlay();
    status.show("Loading YouTube player…");
    const stage = h("div", { class: "stage" }, frame, status.el);

    const player = stat("Player");
    const time = stat("Position");
    player.set("Waiting for player…");

    let disposed = false;
    let responded = false;
    let played = false;

    const setState = (code: number) => {
      player.set(PLAYER_STATES[code] ?? `State ${code}`);
      if (code === 1 && !played) {
        played = true;
        ctx.setStatus("pass", "YouTube playback started");
      }
    };

    const onMessage = (e: MessageEvent) => {
      if (e.origin !== YOUTUBE_ORIGIN || e.source !== frame.contentWindow)
        return;
      let data: { event?: string; info?: unknown };
      try {
        data = JSON.parse(String(e.data));
      } catch {
        return;
      }
      responded = true;
      status.hide();
      if (data.event === "onReady") {
        if (!played) player.set("Ready — press play");
      } else if (
        data.event === "onStateChange" &&
        typeof data.info === "number"
      ) {
        setState(data.info);
      } else if (data.event === "onError") {
        const message = `YouTube reported error ${String(data.info)}`;
        player.set("Error");
        ctx.setStatus("fail", message);
      } else if (
        data.event === "infoDelivery" &&
        data.info &&
        typeof data.info === "object"
      ) {
        const info = data.info as {
          playerState?: number;
          currentTime?: number;
        };
        if (typeof info.playerState === "number") setState(info.playerState);
        if (typeof info.currentTime === "number")
          time.set(`${info.currentTime.toFixed(1)} s`);
      }
    };
    window.addEventListener("message", onMessage);

    // Ask the embedded player to start sending state events.
    frame.addEventListener("load", () => {
      frame.contentWindow?.postMessage(
        JSON.stringify({
          event: "listening",
          id: "kiosk-diag",
          channel: "widget",
        }),
        YOUTUBE_ORIGIN,
      );
    });

    const timeout = setTimeout(() => {
      if (disposed || responded) return;
      status.show(
        "No response from the YouTube player. Check the network and that youtube.com is not blocked.",
        true,
      );
      player.set("No response");
      ctx.setStatus("fail", "YouTube player did not respond");
    }, 12000);

    ctx.onCleanup(() => {
      disposed = true;
      clearTimeout(timeout);
      window.removeEventListener("message", onMessage);
      frame.src = "about:blank";
    });

    ctx.root.append(stage, h("div", { class: "stats" }, player.el, time.el));
  },
};

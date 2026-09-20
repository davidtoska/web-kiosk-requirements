import { h } from "../dom.ts";
import { overlay, stat } from "../ui.ts";
import type { Test } from "../types.ts";

const SOURCES = [
  "https://www.w3schools.com/html/mov_bbb.mp4",
  "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
];

const READY_STATES = [
  "Nothing",
  "Metadata",
  "Current frame",
  "Future data",
  "Enough data",
];

export const videoTest: Test = {
  id: "video",
  title: "Video playback",
  summary:
    "Plays a sample MP4 with sound. Confirm the picture is smooth and the audio is in sync.",
  run(ctx) {
    const video = h("video", {
      controls: true,
      playsInline: true,
      preload: "auto",
    });
    const sources = SOURCES.map((src) =>
      h("source", { src, type: "video/mp4" }),
    );
    video.append(...sources);
    const status = overlay();
    status.show("Loading video…");
    const stage = h("div", { class: "stage" }, video, status.el);

    const state = stat("State");
    const time = stat("Position");
    const resolution = stat("Resolution");
    const dropped = stat("Dropped frames");

    let disposed = false;
    let reportedPass = false;

    const fail = (message: string) => {
      if (disposed) return;
      status.show(message, true);
      ctx.setStatus("fail", message);
    };

    // A <source> error means that candidate failed; only the last one is fatal.
    sources[sources.length - 1]!.addEventListener("error", () =>
      fail(
        "Video could not be loaded from any source. Check the network connection.",
      ),
    );
    video.addEventListener("error", () =>
      fail(
        `Playback error: ${video.error?.message || "unsupported format or network failure"}`,
      ),
    );
    video.addEventListener("playing", () => status.hide());
    video.addEventListener("waiting", () => status.show("Buffering…"));
    video.addEventListener("canplay", () => status.hide());

    const timer = setInterval(() => {
      state.set(
        video.error
          ? "Error"
          : video.paused
            ? "Paused"
            : video.ended
              ? "Ended"
              : "Playing",
      );
      time.set(
        `${video.currentTime.toFixed(1)} / ${Number.isFinite(video.duration) ? video.duration.toFixed(1) : "–"} s`,
      );
      resolution.set(
        video.videoWidth ? `${video.videoWidth} × ${video.videoHeight}` : "–",
      );
      const quality = video.getVideoPlaybackQuality?.();
      dropped.set(
        quality
          ? `${quality.droppedVideoFrames} of ${quality.totalVideoFrames}`
          : "n/a",
      );
      if (
        !reportedPass &&
        !video.paused &&
        video.currentTime > 3 &&
        video.readyState >= 3
      ) {
        reportedPass = true;
        ctx.setStatus(
          "pass",
          `Played smoothly for ${video.currentTime.toFixed(0)} s — ${READY_STATES[video.readyState]}`,
        );
      }
    }, 500);

    ctx.onCleanup(() => {
      disposed = true;
      clearInterval(timer);
      video.pause();
      video.removeAttribute("src");
      video.replaceChildren();
      video.load();
    });

    ctx.root.append(
      stage,
      h(
        "div",
        { class: "stats" },
        state.el,
        time.el,
        resolution.el,
        dropped.el,
      ),
    );
    video.play().catch((err: unknown) => {
      if (
        disposed ||
        (err instanceof DOMException && err.name === "AbortError")
      )
        return;
      status.show("Autoplay was blocked — press play.");
    });
  },
};

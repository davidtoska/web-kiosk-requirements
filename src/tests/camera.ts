import { h } from "../dom.ts";
import {
  describeError,
  fillSelect,
  listDevices,
  stopStream,
} from "../media.ts";
import { field, overlay, stat, toolbar } from "../ui.ts";
import type { Test } from "../types.ts";

const RESOLUTIONS: [label: string, constraints: MediaTrackConstraints][] = [
  ["Auto", {}],
  ["640 × 480", { width: { ideal: 640 }, height: { ideal: 480 } }],
  ["1280 × 720", { width: { ideal: 1280 }, height: { ideal: 720 } }],
  ["1920 × 1080", { width: { ideal: 1920 }, height: { ideal: 1080 } }],
];

export const cameraTest: Test = {
  id: "camera",
  title: "Camera",
  summary:
    "Live preview from the selected camera. Confirm the image is sharp, correctly oriented and smooth.",
  run(ctx) {
    const video = h("video", {
      autoplay: true,
      muted: true,
      playsInline: true,
    });
    const status = overlay();
    status.show("Requesting camera…");
    const stage = h("div", { class: "stage" }, video, status.el);

    const deviceSelect = h("select", { "aria-label": "Camera" });
    const resolutionSelect = h(
      "select",
      { "aria-label": "Resolution" },
      ...RESOLUTIONS.map(([label], i) =>
        h("option", { value: String(i) }, label),
      ),
    );
    resolutionSelect.value = "0";

    const device = stat("Device");
    const resolution = stat("Resolution");
    const fps = stat("Frame rate");
    const facing = stat("Facing");

    let stream: MediaStream | null = null;
    let sequence = 0;
    let disposed = false;
    let frames = 0;
    let measuredFps = 0;

    const refreshDevices = async (selected?: string) => {
      fillSelect(
        deviceSelect,
        await listDevices("videoinput"),
        selected ?? deviceSelect.value,
        "Camera",
      );
    };

    const updateStats = () => {
      const track = stream?.getVideoTracks()[0];
      if (!track) return;
      const s = track.getSettings();
      device.set(track.label || "Unknown camera");
      resolution.set(s.width && s.height ? `${s.width} × ${s.height}` : "–");
      const reported = s.frameRate
        ? `${Math.round(s.frameRate)} fps requested`
        : "";
      fps.set(
        measuredFps
          ? `${measuredFps} fps${reported ? ` · ${reported}` : ""}`
          : reported || "–",
      );
      facing.set(s.facingMode ?? "n/a");
    };

    const start = async () => {
      const id = ++sequence;
      stopStream(stream);
      stream = null;
      status.show("Starting camera…");
      const [, constraints] = RESOLUTIONS[Number(resolutionSelect.value)]!;
      try {
        const next = await navigator.mediaDevices.getUserMedia({
          video: {
            ...constraints,
            ...(deviceSelect.value
              ? { deviceId: { exact: deviceSelect.value } }
              : {}),
          },
          audio: false,
        });
        if (disposed || id !== sequence) {
          stopStream(next);
          return;
        }
        stream = next;
        const track = next.getVideoTracks()[0]!;
        track.addEventListener("ended", () => {
          if (stream !== next) return;
          status.show("Camera disconnected.", true);
          ctx.setStatus("fail", "Camera disconnected");
        });
        video.srcObject = next;
        await video.play().catch(() => undefined);
        status.hide();
        await refreshDevices(track.getSettings().deviceId);
        updateStats();
        ctx.setStatus(
          "pending",
          "Preview running — confirm the image looks right",
        );
      } catch (err) {
        if (disposed || id !== sequence) return;
        const message = describeError(err);
        status.show(message, true);
        ctx.setStatus("fail", message);
      }
    };

    if ("requestVideoFrameCallback" in video) {
      const onFrame = () => {
        frames++;
        if (!disposed) video.requestVideoFrameCallback(onFrame);
      };
      video.requestVideoFrameCallback(onFrame);
    }
    const timer = setInterval(() => {
      measuredFps = frames;
      frames = 0;
      updateStats();
    }, 1000);

    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    deviceSelect.addEventListener("change", () => void start());
    resolutionSelect.addEventListener("change", () => void start());

    ctx.onCleanup(() => {
      disposed = true;
      clearInterval(timer);
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        onDeviceChange,
      );
      stopStream(stream);
      video.srcObject = null;
    });

    ctx.root.append(
      toolbar(
        field("Camera", deviceSelect),
        field("Resolution", resolutionSelect),
      ),
      stage,
      h("div", { class: "stats" }, device.el, resolution.el, fps.el, facing.el),
    );
    void start();
  },
};

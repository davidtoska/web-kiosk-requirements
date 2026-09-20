import { h } from "../dom.ts";
import { createRows, type RowState } from "../ui.ts";
import type { Test } from "../types.ts";

interface NavigatorExtras {
  deviceMemory?: number;
}

type Entry = [label: string, value: string, state: RowState];

const gpuName = (): string => {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ??
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "WebGL unavailable";
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return ext
      ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
      : "Unknown GPU";
  } catch {
    return "WebGL unavailable";
  }
};

const entries = (): Entry[] => {
  const nav = navigator as Navigator & NavigatorExtras;
  const secure = window.isSecureContext;
  const media = !!navigator.mediaDevices?.getUserMedia;
  return [
    [
      "Secure context",
      secure
        ? "Yes (HTTPS or localhost)"
        : "No — camera and microphone are blocked",
      secure ? "ok" : "fail",
    ],
    [
      "Media devices API",
      media ? "Available" : "Unavailable",
      media ? "ok" : "fail",
    ],
    [
      "Network",
      navigator.onLine ? "Online" : "Offline",
      navigator.onLine ? "ok" : "warn",
    ],
    [
      "Screen",
      `${screen.width} × ${screen.height} @ ${window.devicePixelRatio}x`,
      "info",
    ],
    ["Viewport", `${window.innerWidth} × ${window.innerHeight}`, "info"],
    ["Color depth", `${screen.colorDepth}-bit`, "info"],
    ["Orientation", screen.orientation?.type ?? "Unknown", "info"],
    ["Touch points", String(navigator.maxTouchPoints), "info"],
    ["GPU", gpuName(), "info"],
    ["CPU cores", String(navigator.hardwareConcurrency ?? "Unknown"), "info"],
    [
      "Memory",
      nav.deviceMemory ? `≥ ${nav.deviceMemory} GB` : "Unknown",
      "info",
    ],
    ["Platform", navigator.platform || "Unknown", "info"],
    ["Language", navigator.language, "info"],
    ["Time zone", Intl.DateTimeFormat().resolvedOptions().timeZone, "info"],
    [
      "Fullscreen",
      document.fullscreenEnabled ? "Supported" : "Unsupported",
      "info",
    ],
    ["Browser", navigator.userAgent, "info"],
  ];
};

export const systemSnapshot = (): Record<string, string> =>
  Object.fromEntries(entries().map(([label, value]) => [label, value]));

export const systemTest: Test = {
  id: "system",
  title: "System",
  summary:
    "Screen, browser and platform capabilities the other tests depend on.",
  run(ctx) {
    const rows = createRows();
    const rowByLabel = new Map(
      entries().map(([label, value, state]) => [
        label,
        rows.add(label, state, value),
      ]),
    );
    const devices = rows.add("Media devices", "run", "Scanning…");
    ctx.root.append(h("div", { class: "scroll-free" }, rows.root));

    const refresh = () => {
      for (const [label, value, state] of entries())
        rowByLabel.get(label)?.set(state, value);
    };
    window.addEventListener("resize", refresh);
    ctx.onCleanup(() => window.removeEventListener("resize", refresh));

    const blocking = entries().filter(([, , state]) => state === "fail");
    if (blocking.length) {
      ctx.setStatus("fail", blocking.map(([label]) => label).join(", "));
    } else {
      ctx.setStatus("pass", "Browser supports the required APIs");
    }

    navigator.mediaDevices
      ?.enumerateDevices()
      .then((list) => {
        const count = (kind: MediaDeviceKind) =>
          list.filter((d) => d.kind === kind).length;
        const cams = count("videoinput");
        const mics = count("audioinput");
        const speakers = count("audiooutput");
        devices.set(
          cams && mics ? "ok" : "warn",
          `${cams} camera${cams === 1 ? "" : "s"} · ${mics} microphone${mics === 1 ? "" : "s"} · ${speakers} speaker${speakers === 1 ? "" : "s"}`,
        );
      })
      .catch(() => devices.set("warn", "Could not enumerate devices"));
  },
};

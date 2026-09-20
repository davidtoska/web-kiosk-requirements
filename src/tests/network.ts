import { h } from "../dom.ts";
import { btn, createRows, toolbar } from "../ui.ts";
import type { Test } from "../types.ts";

interface ConnectionInfo {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
}

const TARGETS: { label: string; url: string; required: boolean }[] = [
  {
    label: "Internet (google.com)",
    url: "https://www.google.com/generate_204",
    required: true,
  },
  {
    label: "YouTube (youtube.com)",
    url: "https://www.youtube.com/generate_204",
    required: true,
  },
  {
    label: "Sample video host (w3schools.com)",
    url: "https://www.w3schools.com/favicon.ico",
    required: false,
  },
];

const probe = async (url: string, signal: AbortSignal) => {
  const start = performance.now();
  await fetch(url, { mode: "no-cors", cache: "no-store", signal });
  return Math.round(performance.now() - start);
};

export const networkTest: Test = {
  id: "network",
  title: "Network",
  summary: "Connectivity and latency to the services the kiosk relies on.",
  run(ctx) {
    const rows = createRows();
    const online = rows.add("Browser reports");
    const link = rows.add("Connection");
    const targetRows = TARGETS.map((t) => rows.add(t.label));

    let controller = new AbortController();
    let disposed = false;
    ctx.onCleanup(() => {
      disposed = true;
      controller.abort();
    });

    const retest = btn("Run again", () => void run(), "primary");

    const run = async () => {
      controller.abort();
      controller = new AbortController();
      const { signal } = controller;
      retest.disabled = true;

      online.set(
        navigator.onLine ? "ok" : "fail",
        navigator.onLine ? "Online" : "Offline",
      );
      const conn = (navigator as Navigator & { connection?: ConnectionInfo })
        .connection;
      link.set(
        "info",
        conn
          ? `${conn.effectiveType ?? "?"} · ${conn.downlink ?? "?"} Mbit/s · RTT ${conn.rtt ?? "?"} ms`
          : "Not reported by this browser",
      );
      targetRows.forEach((row) => row.set("run", "Checking…"));

      const outcomes = await Promise.allSettled(
        TARGETS.map((t) =>
          probe(t.url, AbortSignal.any([signal, AbortSignal.timeout(6000)])),
        ),
      );
      if (disposed || signal.aborted) return;

      const failed: string[] = [];
      outcomes.forEach((outcome, i) => {
        const target = TARGETS[i]!;
        if (outcome.status === "fulfilled") {
          targetRows[i]!.set("ok", `Reachable · ${outcome.value} ms`);
        } else {
          targetRows[i]!.set(target.required ? "fail" : "warn", "Unreachable");
          if (target.required) failed.push(target.label);
        }
      });
      retest.disabled = false;
      if (!navigator.onLine) ctx.setStatus("fail", "Browser is offline");
      else if (failed.length)
        ctx.setStatus("fail", `Unreachable: ${failed.join(", ")}`);
      else ctx.setStatus("pass", "All required services reachable");
    };

    ctx.root.append(
      toolbar(retest),
      h("div", { class: "scroll-free" }, rows.root),
    );
    void run();
  },
};

import { h } from "../dom.ts";
import { btn, fitCanvas, stat, toolbar } from "../ui.ts";
import type { Test } from "../types.ts";

const COLORS: Record<string, string> = {
  mouse: "#4f8cff",
  touch: "#2fb67c",
  pen: "#e5a93b",
};

export const inputTest: Test = {
  id: "input",
  title: "Touch & input",
  summary:
    "Draw on the pad with touch, pen or mouse, and press keys. Each input type lights up when detected.",
  run(ctx) {
    const canvas = h("canvas", { class: "pad" });
    const hint = h("div", { class: "overlay" }, "Draw here · press any key");
    const stage = h("div", { class: "stage" }, canvas, hint);
    const g = canvas.getContext("2d")!;

    const detected = new Map(
      ["Mouse", "Touch", "Pen", "Keyboard", "Wheel"].map((label) => [
        label,
        h("span", { class: "chip" }, label),
      ]),
    );
    const mark = (label: string) => {
      detected.get(label)?.classList.add("on");
      const seen = (l: string) => detected.get(l)?.classList.contains("on");
      if ((seen("Mouse") || seen("Touch") || seen("Pen")) && seen("Keyboard")) {
        ctx.setStatus("pass", "Pointer and keyboard input detected");
      }
    };

    const position = stat("Pointer");
    const pressure = stat("Pressure");
    const touches = stat("Touch points (max)");
    const lastKey = stat("Last key");

    const last = new Map<number, { x: number; y: number }>();
    const active = new Set<number>();
    let maxTouches = 0;

    const toCanvas = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = canvas.width / rect.width;
      return {
        x: (e.clientX - rect.left) * dpr,
        y: (e.clientY - rect.top) * dpr,
        dpr,
      };
    };

    canvas.addEventListener("pointerdown", (e) => {
      canvas.setPointerCapture(e.pointerId);
      hint.hidden = true;
      const { x, y } = toCanvas(e);
      last.set(e.pointerId, { x, y });
      if (e.pointerType === "touch") {
        active.add(e.pointerId);
        maxTouches = Math.max(maxTouches, active.size);
        touches.set(String(maxTouches));
      }
      mark(
        e.pointerType === "touch"
          ? "Touch"
          : e.pointerType === "pen"
            ? "Pen"
            : "Mouse",
      );
    });

    canvas.addEventListener("pointermove", (e) => {
      const { x, y, dpr } = toCanvas(e);
      position.set(
        `${Math.round(x / dpr)}, ${Math.round(y / dpr)} (${e.pointerType})`,
      );
      pressure.set((e.pressure || 0).toFixed(2));
      const from = last.get(e.pointerId);
      if (!from) return;
      g.strokeStyle = COLORS[e.pointerType] ?? COLORS.mouse!;
      g.lineWidth = (2 + (e.pressure || 0.5) * 6) * dpr;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(from.x, from.y);
      g.lineTo(x, y);
      g.stroke();
      last.set(e.pointerId, { x, y });
    });

    const release = (e: PointerEvent) => {
      last.delete(e.pointerId);
      active.delete(e.pointerId);
    };
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", release);
    canvas.addEventListener("wheel", () => mark("Wheel"), { passive: true });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    const onKey = (e: KeyboardEvent) => {
      hint.hidden = true;
      lastKey.set(`${e.key === " " ? "Space" : e.key} (${e.code})`);
      mark("Keyboard");
      // Keep focused buttons from being triggered by the keys being tested.
      if (!/^F\d+$/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault();
    };
    document.addEventListener("keydown", onKey);

    const stopFit = fitCanvas(canvas);
    ctx.onCleanup(() => {
      stopFit();
      document.removeEventListener("keydown", onKey);
    });

    const clear = btn("Clear pad", () => {
      g.clearRect(0, 0, canvas.width, canvas.height);
    });
    ctx.root.append(
      toolbar(h("div", { class: "chips" }, ...detected.values()), clear),
      stage,
      h(
        "div",
        { class: "stats" },
        position.el,
        pressure.el,
        touches.el,
        lastKey.el,
      ),
    );
  },
};

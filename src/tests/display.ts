import { h } from "../dom.ts";
import { btn, toolbar } from "../ui.ts";
import type { Test } from "../types.ts";

const BARS = ["#fff", "#ff0", "#0ff", "#0f0", "#f0f", "#f00", "#00f", "#000"]
  .map((color, i) => `${color} ${i * 12.5}% ${(i + 1) * 12.5}%`)
  .join(", ");

const PATTERNS: [label: string, background: string][] = [
  ["Red", "#f00"],
  ["Green", "#0f0"],
  ["Blue", "#00f"],
  ["White", "#fff"],
  ["Black", "#000"],
  ["Gray ramp", "linear-gradient(90deg, #000, #fff)"],
  ["Color bars", `linear-gradient(90deg, ${BARS})`],
  [
    "Grid",
    "repeating-linear-gradient(0deg, transparent 0 39px, #fff 39px 40px), repeating-linear-gradient(90deg, transparent 0 39px, #fff 39px 40px), #000",
  ],
];

export const displayTest: Test = {
  id: "display",
  title: "Display",
  summary:
    "Cycle through solid colors and patterns. Look for dead pixels, stuck pixels, banding and uneven backlight.",
  run(ctx) {
    let index = 0;
    const chip = h("div", { class: "chip-overlay" });
    const stage = h("div", { class: "stage pattern" }, chip);
    const buttons = PATTERNS.map(([label], i) =>
      btn(label, () => select(i), "ghost"),
    );

    const select = (i: number) => {
      index = (i + PATTERNS.length) % PATTERNS.length;
      const [label, background] = PATTERNS[index]!;
      stage.style.background = background;
      chip.textContent = `${label} · click to change`;
      buttons.forEach((b, n) => b.classList.toggle("active", n === index));
    };

    stage.addEventListener("click", () => select(index + 1));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") select(index + 1);
      else if (e.key === "ArrowLeft") select(index - 1);
      else return;
      e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    ctx.onCleanup(() => {
      document.removeEventListener("keydown", onKey);
      if (document.fullscreenElement === stage) void document.exitFullscreen();
    });

    const fullscreen = btn(
      "Fullscreen pattern",
      () => void stage.requestFullscreen?.(),
      "primary",
    );
    ctx.root.append(toolbar(...buttons, fullscreen), stage);
    select(0);
  },
};

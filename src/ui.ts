import { h } from "./dom.ts";

export const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export type ButtonVariant = "" | "primary" | "pass" | "fail" | "ghost";

export const btn = (
  label: string,
  onclick: (e: MouseEvent) => void,
  variant: ButtonVariant = "",
) =>
  h(
    "button",
    { class: `btn ${variant}`.trim(), type: "button", onclick },
    label,
  );

export const field = (label: string, control: HTMLElement) =>
  h(
    "label",
    { class: "field" },
    h("span", { class: "field-label" }, label),
    control,
  );

export const toolbar = (...children: (Node | null)[]) =>
  h("div", { class: "toolbar" }, ...children);

export type RowState = "ok" | "fail" | "warn" | "info" | "run";

export interface Row {
  set(state: RowState, value: string): void;
}

export const createRows = () => {
  const root = h("div", { class: "rows" });
  const add = (label: string, state: RowState = "info", value = ""): Row => {
    const dot = h("span", { class: `dot ${state}` });
    const valueEl = h("span", { class: "row-value", title: value }, value);
    root.append(
      h(
        "div",
        { class: "row" },
        dot,
        h("span", { class: "row-label" }, label),
        valueEl,
      ),
    );
    return {
      set(next, text) {
        dot.className = `dot ${next}`;
        valueEl.textContent = text;
        valueEl.title = text;
      },
    };
  };
  return { root, add };
};

export const stat = (label: string) => {
  const value = h("span", { class: "stat-value" }, "–");
  const el = h(
    "div",
    { class: "stat" },
    h("span", { class: "stat-label" }, label),
    value,
  );
  return {
    el,
    set(text: string) {
      value.textContent = text;
    },
  };
};

/** Keeps a canvas backing store matched to its CSS size. Returns a disposer. */
export const fitCanvas = (canvas: HTMLCanvasElement, onResize?: () => void) => {
  const observer = new ResizeObserver(() => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    onResize?.();
  });
  observer.observe(canvas);
  return () => observer.disconnect();
};

export const overlay = () => {
  const el = h("div", { class: "overlay" });
  return {
    el,
    show(text: string, isError = false) {
      el.textContent = text;
      el.className = isError ? "overlay error" : "overlay";
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
  };
};

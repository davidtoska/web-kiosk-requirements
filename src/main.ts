import "./style.css";
import { h } from "./dom.ts";
import { btn } from "./ui.ts";
import type { Result, Status, Test } from "./types.ts";
import { systemTest } from "./tests/system.ts";
import { networkTest } from "./tests/network.ts";
import { storageTest } from "./tests/storage.ts";
import { displayTest } from "./tests/display.ts";
import { inputTest } from "./tests/input.ts";
import { cameraTest } from "./tests/camera.ts";
import { microphoneTest } from "./tests/microphone.ts";
import { speakersTest } from "./tests/speakers.ts";
import { videoTest } from "./tests/video.ts";
import { youtubeTest } from "./tests/youtube.ts";
import { createSummaryTest } from "./tests/summary.ts";

const tests: Test[] = [
  systemTest,
  networkTest,
  storageTest,
  displayTest,
  inputTest,
  cameraTest,
  microphoneTest,
  speakersTest,
  videoTest,
  youtubeTest,
];

const summaryTest = createSummaryTest(() =>
  tests.map((t) => ({ title: t.title, ...resultOf(t.id) })),
);
const all: Test[] = [...tests, summaryTest];

const STATUS_LABEL: Record<Status, string> = {
  pass: "Passed",
  fail: "Failed",
  pending: "Not tested",
};
const STATUS_MARK: Record<Status, string> = {
  pass: "✓",
  fail: "✕",
  pending: "",
};

// ---- State ----------------------------------------------------------------

const results = new Map<string, Result>();
const resultOf = (id: string): Result =>
  results.get(id) ?? { status: "pending", note: "", at: null };

let index = 0;
let token = 0;
let cleanups: (() => void)[] = [];

// ---- Layout ---------------------------------------------------------------

const progressFill = h("div", { class: "progress-fill" });
const progressText = h("span", { class: "progress-text" });
const fullscreenButton = btn(
  "Fullscreen",
  () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.();
  },
  "ghost",
);
const resetButton = btn(
  "Reset",
  () => {
    results.clear();
    open(0);
  },
  "ghost",
);

const topbar = h(
  "header",
  { class: "topbar" },
  h(
    "div",
    { class: "brand" },
    h("div", { class: "brand-mark" }, "K"),
    h(
      "div",
      {},
      h("div", { class: "brand-title" }, "Kiosk Diagnostics"),
      h("div", { class: "brand-sub" }, "Hardware & browser readiness check"),
    ),
  ),
  h(
    "div",
    { class: "progress" },
    h("div", { class: "progress-bar" }, progressFill),
    progressText,
  ),
  h("div", { class: "topbar-actions" }, fullscreenButton, resetButton),
);

const navItems = all.map((test, i) => {
  const mark = h("span", { class: "nav-index" });
  const item = h(
    "button",
    {
      class: "nav-item",
      type: "button",
      onclick: () => open(i),
      title: test.title,
    },
    mark,
    h("span", { class: "nav-label" }, test.title),
  );
  return { item, mark };
});
const sidebar = h(
  "nav",
  { class: "sidebar", "aria-label": "Tests" },
  ...navItems.map((n) => n.item),
);

const panelTitle = h("h2", { class: "panel-title" });
const panelSummary = h("p", { class: "panel-summary" });
const panelPill = h("span", { class: "pill" });
const body = h("section", { class: "panel-body" });
const actionNote = h("span", { class: "action-note" });
const backButton = btn("Back", () => open(index - 1), "ghost");
const failButton = btn("Fail", () => finish("fail"), "fail");
const passButton = btn("Pass", () => finish("pass"), "pass");

const panel = h(
  "main",
  { class: "panel" },
  h(
    "header",
    { class: "panel-head" },
    h("div", {}, panelTitle, panelSummary),
    panelPill,
  ),
  body,
  h(
    "footer",
    { class: "panel-actions" },
    backButton,
    actionNote,
    failButton,
    passButton,
  ),
);

const lastKey = h("span", {}, "Last key: –");
const lastClick = h("span", {}, "Last click: –");
const viewport = h("span", {});
const clock = h("span", {});
const statusbar = h(
  "footer",
  { class: "statusbar" },
  h("div", { class: "statusbar-group" }, lastKey, lastClick),
  h("div", { class: "statusbar-group" }, viewport, clock),
);

document
  .querySelector<HTMLDivElement>("#app")!
  .append(topbar, h("div", { class: "workspace" }, sidebar, panel), statusbar);

// ---- Behaviour ------------------------------------------------------------

const setResult = (id: string, status: Status, note: string) => {
  const current = resultOf(id);
  // A late "pending" (e.g. a preview restarting) must not undo an operator's pass.
  if (status === "pending" && current.status === "pass") return;
  results.set(id, {
    status,
    note,
    at: status === "pending" ? null : Date.now(),
  });
  render();
};

const finish = (status: Status) => {
  const test = all[index]!;
  const note =
    status === "pass"
      ? "Confirmed by operator"
      : "Marked as failed by operator";
  const current = resultOf(test.id);
  // Keep an automatic note (e.g. "Signal detected") if it already agrees.
  setResult(
    test.id,
    status,
    current.status === status && current.note ? current.note : note,
  );
  if (status === "pass" && index < all.length - 1) open(index + 1);
};

const render = () => {
  const test = all[index]!;
  const current = resultOf(test.id);
  const isSummary = test === summaryTest;

  navItems.forEach(({ item, mark }, i) => {
    const status = resultOf(all[i]!.id).status;
    item.dataset.status = status;
    item.classList.toggle("active", i === index);
    if (i === index) item.setAttribute("aria-current", "page");
    else item.removeAttribute("aria-current");
    mark.textContent = STATUS_MARK[status] || String(i + 1);
  });

  panelTitle.textContent = test.title;
  panelSummary.textContent = test.summary;
  panelPill.className = `pill ${current.status}`;
  panelPill.textContent = STATUS_LABEL[current.status];
  actionNote.textContent = current.note;
  backButton.disabled = index === 0;
  failButton.hidden = isSummary;
  passButton.hidden = isSummary;

  const passed = tests.filter((t) => resultOf(t.id).status === "pass").length;
  const failed = tests.filter((t) => resultOf(t.id).status === "fail").length;
  progressFill.style.width = `${(passed / tests.length) * 100}%`;
  progressFill.classList.toggle("has-fail", failed > 0);
  progressText.textContent = `${passed} of ${tests.length} passed${failed ? ` · ${failed} failed` : ""}`;
};

const open = (i: number) => {
  cleanups.splice(0).forEach((fn) => {
    try {
      fn();
    } catch (err) {
      console.error(err);
    }
  });
  index = Math.max(0, Math.min(all.length - 1, i));
  const mine = ++token;
  const test = all[index]!;
  body.replaceChildren();

  const ctx = {
    root: body,
    setStatus: (status: Status, note = "") => {
      if (mine === token) setResult(test.id, status, note);
    },
    onCleanup: (fn: () => void) => cleanups.push(fn),
  };
  render();
  try {
    test.run(ctx);
  } catch (err) {
    console.error(err);
    ctx.setStatus(
      "fail",
      `Test crashed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

// ---- Global monitors ------------------------------------------------------

document.addEventListener("keydown", (e) => {
  const modifiers = [
    e.ctrlKey && "Ctrl",
    e.altKey && "Alt",
    e.shiftKey && "Shift",
  ]
    .filter(Boolean)
    .join("+");
  lastKey.textContent = `Last key: ${modifiers ? `${modifiers}+` : ""}${e.key === " " ? "Space" : e.key}`;
});

document.addEventListener("pointerdown", (e) => {
  lastClick.textContent = `Last ${e.pointerType === "mouse" ? "click" : e.pointerType}: ${Math.round(e.clientX)}, ${Math.round(e.clientY)}${e.isTrusted ? "" : " (synthetic)"}`;
});

const updateEnvironment = () => {
  viewport.textContent = `${window.innerWidth} × ${window.innerHeight}`;
  fullscreenButton.textContent = document.fullscreenElement
    ? "Exit fullscreen"
    : "Fullscreen";
};
const updateClock = () => {
  clock.textContent = new Date().toLocaleTimeString();
};
window.addEventListener("resize", updateEnvironment);
document.addEventListener("fullscreenchange", updateEnvironment);
setInterval(updateClock, 1000);
updateEnvironment();
updateClock();

open(0);

import { h } from "../dom.ts";
import { btn, toolbar } from "../ui.ts";
import { systemSnapshot } from "./system.ts";
import type { Status, Test } from "../types.ts";

export interface SummaryRow {
  title: string;
  status: Status;
  note: string;
  at: number | null;
}

const LABELS: Record<Status, string> = {
  pass: "Passed",
  fail: "Failed",
  pending: "Not tested",
};

export const createSummaryTest = (getRows: () => SummaryRow[]): Test => ({
  id: "summary",
  title: "Summary",
  summary:
    "Overall result for this kiosk. Download or copy the report for your records.",
  run(ctx) {
    const rows = getRows();
    const count = (status: Status) =>
      rows.filter((r) => r.status === status).length;

    const report = () => ({
      generatedAt: new Date().toISOString(),
      overall: count("fail")
        ? "fail"
        : count("pending")
          ? "incomplete"
          : "pass",
      results: rows.map((r) => ({
        test: r.title,
        status: r.status,
        note: r.note,
        testedAt: r.at ? new Date(r.at).toISOString() : null,
      })),
      system: systemSnapshot(),
    });

    const message = h("span", { class: "muted" });
    const flash = (text: string) => {
      message.textContent = text;
    };

    const download = btn(
      "Download report (JSON)",
      () => {
        const blob = new Blob([JSON.stringify(report(), null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = h("a", {
          href: url,
          download: `kiosk-report-${new Date().toISOString().slice(0, 10)}.json`,
        });
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        flash("Report downloaded.");
      },
      "primary",
    );

    const copy = btn("Copy report", () => {
      navigator.clipboard
        .writeText(JSON.stringify(report(), null, 2))
        .then(() => flash("Report copied to clipboard."))
        .catch(() => flash("Clipboard is unavailable — use Download instead."));
    });

    const tiles = h(
      "div",
      { class: "tiles" },
      ...(["pass", "fail", "pending"] as const).map((status) =>
        h(
          "div",
          { class: `tile ${status}` },
          h("span", { class: "tile-count" }, count(status)),
          h("span", { class: "tile-label" }, LABELS[status]),
        ),
      ),
    );

    const list = h(
      "div",
      { class: "results" },
      ...rows.map((r) =>
        h(
          "div",
          { class: "result" },
          h("span", { class: `pill ${r.status}` }, LABELS[r.status]),
          h("span", { class: "result-title" }, r.title),
          h("span", { class: "result-note", title: r.note }, r.note || "–"),
          h(
            "span",
            { class: "result-time" },
            r.at ? new Date(r.at).toLocaleTimeString() : "",
          ),
        ),
      ),
    );

    ctx.root.append(
      tiles,
      h("div", { class: "scroll-free" }, list),
      toolbar(download, copy, message),
    );
    if (count("fail")) ctx.setStatus("fail", `${count("fail")} test(s) failed`);
    else if (count("pending"))
      ctx.setStatus("pending", `${count("pending")} test(s) not run`);
    else ctx.setStatus("pass", "All tests passed");
  },
});

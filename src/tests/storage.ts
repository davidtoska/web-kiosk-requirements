import { h } from "../dom.ts";
import { createRows } from "../ui.ts";
import type { Test } from "../types.ts";

const LAST_RUN_KEY = "kiosk-diag-last-run";

const request = <T>(req: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const transactionDone = (tx: IDBTransaction) =>
  new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

const webStorageCheck = (storage: Storage) => {
  const key = "kiosk-diag-probe";
  const value = String(Math.random());
  storage.setItem(key, value);
  if (storage.getItem(key) !== value) throw new Error("Read-back mismatch");
  storage.removeItem(key);
  return "Read / write OK";
};

const cookieCheck = () => {
  document.cookie = "kiosk_diag=1; path=/; SameSite=Lax; max-age=60";
  const ok = document.cookie.includes("kiosk_diag=1");
  document.cookie = "kiosk_diag=; path=/; max-age=0";
  if (!ok) throw new Error("Cookie was not stored");
  return "Read / write OK";
};

const indexedDbCheck = async () => {
  const db = await request(
    Object.assign(indexedDB.open("kiosk-diag", 1), {
      onupgradeneeded(this: IDBOpenDBRequest) {
        this.result.createObjectStore("kv");
      },
    }),
  );
  try {
    const write = db.transaction("kv", "readwrite");
    write.objectStore("kv").put("ok", "probe");
    await transactionDone(write);
    const value = await request(
      db.transaction("kv").objectStore("kv").get("probe"),
    );
    if (value !== "ok") throw new Error("Read-back mismatch");
  } finally {
    db.close();
  }
  return "Read / write OK";
};

const CHECKS: [label: string, check: () => string | Promise<string>][] = [
  ["localStorage", () => webStorageCheck(localStorage)],
  ["sessionStorage", () => webStorageCheck(sessionStorage)],
  ["Cookies", cookieCheck],
  ["IndexedDB", indexedDbCheck],
];

export const storageTest: Test = {
  id: "storage",
  title: "Storage",
  summary:
    "Browser storage the kiosk app can use, and whether data survives restarts.",
  run(ctx) {
    const rows = createRows();
    ctx.root.append(h("div", { class: "scroll-free" }, rows.root));
    let disposed = false;
    ctx.onCleanup(() => (disposed = true));

    const checkRows = CHECKS.map(([label]) =>
      rows.add(label, "run", "Checking…"),
    );
    const persistence = rows.add("Previous session");
    const quota = rows.add("Storage quota");

    try {
      const previous = localStorage.getItem(LAST_RUN_KEY);
      persistence.set(
        previous ? "ok" : "info",
        previous
          ? `Data persisted — last run ${new Date(previous).toLocaleString()}`
          : "No earlier run recorded on this profile",
      );
      localStorage.setItem(LAST_RUN_KEY, new Date().toISOString());
    } catch {
      persistence.set("warn", "Unavailable");
    }

    navigator.storage
      ?.estimate()
      .then(({ usage = 0, quota: total = 0 }) => {
        const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
        quota.set("info", `${mb(usage)} used of ${mb(total)}`);
      })
      .catch(() => quota.set("info", "Not reported"));

    void Promise.all(
      CHECKS.map(async ([, check], i) => {
        try {
          checkRows[i]!.set("ok", await check());
          return true;
        } catch (err) {
          checkRows[i]!.set(
            "fail",
            err instanceof Error ? err.message : String(err),
          );
          return false;
        }
      }),
    ).then((outcomes) => {
      if (disposed) return;
      const failed = CHECKS.filter((_, i) => !outcomes[i]).map(
        ([label]) => label,
      );
      if (failed.length) ctx.setStatus("fail", `Failed: ${failed.join(", ")}`);
      else ctx.setStatus("pass", "All storage mechanisms work");
    });
  },
};

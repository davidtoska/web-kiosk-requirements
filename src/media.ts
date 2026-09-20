import { h } from "./dom.ts";

export const describeError = (err: unknown): string => {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "Permission denied. Allow access in the browser or kiosk policy.";
      case "NotFoundError":
        return "No matching device found.";
      case "NotReadableError":
        return "The device is in use by another application or cannot be read.";
      case "OverconstrainedError":
        return "The device does not support the requested settings.";
      case "SecurityError":
        return "Blocked by security policy. Media access needs HTTPS or localhost.";
    }
    return `${err.name}: ${err.message}`;
  }
  return err instanceof Error ? `${err.name}: ${err.message}` : String(err);
};

export const listDevices = async (kind: MediaDeviceKind) =>
  (await navigator.mediaDevices.enumerateDevices()).filter(
    (d) => d.kind === kind,
  );

/** Rebuilds a <select> from a device list, keeping `selected` if it still exists. */
export const fillSelect = (
  select: HTMLSelectElement,
  devices: MediaDeviceInfo[],
  selected: string | undefined,
  noun: string,
  leading: [value: string, label: string][] = [],
) => {
  select.replaceChildren(
    ...leading.map(([value, label]) => h("option", { value }, label)),
    ...devices.map((d, i) =>
      h("option", { value: d.deviceId }, d.label || `${noun} ${i + 1}`),
    ),
  );
  if (!select.options.length) {
    select.append(
      h(
        "option",
        { value: "", disabled: true },
        `No ${noun.toLowerCase()} found`,
      ),
    );
  }
  if (
    selected !== undefined &&
    [...select.options].some((o) => o.value === selected)
  ) {
    select.value = selected;
  }
};

export const stopStream = (stream: MediaStream | null) =>
  stream?.getTracks().forEach((track) => track.stop());

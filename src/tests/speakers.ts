import { h } from "../dom.ts";
import { fillSelect, listDevices } from "../media.ts";
import { btn, field, sleep, toolbar } from "../ui.ts";
import type { Test } from "../types.ts";

type SinkAudioContext = AudioContext & {
  setSinkId?: (id: string) => Promise<void>;
};

const FREQUENCIES: [hz: number, label: string][] = [
  [250, "250 Hz (low)"],
  [440, "440 Hz (A4)"],
  [1000, "1 kHz (reference)"],
  [4000, "4 kHz (high)"],
];

export const speakersTest: Test = {
  id: "speakers",
  title: "Speakers",
  summary:
    "Play a test tone through the left, right and both channels. Confirm each is audible, undistorted and on the correct side.",
  run(ctx) {
    const audio: SinkAudioContext = new AudioContext();
    let disposed = false;
    let busy = false;

    const left = h("div", { class: "speaker" }, h("span", {}, "Left"));
    const right = h("div", { class: "speaker" }, h("span", {}, "Right"));
    const stage = h("div", { class: "stage speakers" }, left, right);

    const frequency = h(
      "select",
      { "aria-label": "Frequency" },
      ...FREQUENCIES.map(([hz, label]) =>
        h("option", { value: String(hz) }, label),
      ),
    );
    frequency.value = "1000";
    const volume = h("input", {
      type: "range",
      min: "0",
      max: "1",
      step: "0.05",
      value: "0.4",
      "aria-label": "Volume",
    });
    const output = h("select", { "aria-label": "Output device" });
    const outputField = field("Output", output);
    outputField.hidden = typeof audio.setSinkId !== "function";

    const play = async (pan: -1 | 0 | 1, ms = 1200) => {
      await audio.resume();
      const now = audio.currentTime;
      const end = now + ms / 1000;
      const gain = audio.createGain();
      const level = Number(volume.value) ** 2;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(level, now + 0.03);
      gain.gain.setValueAtTime(level, end - 0.05);
      gain.gain.linearRampToValueAtTime(0, end);
      const panner = audio.createStereoPanner();
      panner.pan.value = pan;
      const osc = audio.createOscillator();
      osc.frequency.value = Number(frequency.value);
      osc.connect(panner).connect(gain).connect(audio.destination);
      osc.start(now);
      osc.stop(end + 0.02);
      if (pan <= 0) left.classList.add("on");
      if (pan >= 0) right.classList.add("on");
      await sleep(ms);
      left.classList.remove("on");
      right.classList.remove("on");
    };

    const guarded = (fn: () => Promise<void>) => async () => {
      if (busy || disposed) return;
      busy = true;
      buttons.forEach((b) => (b.disabled = true));
      try {
        await fn();
      } finally {
        busy = false;
        buttons.forEach((b) => (b.disabled = false));
      }
    };

    const buttons = [
      btn(
        "Left",
        guarded(() => play(-1)),
      ),
      btn(
        "Right",
        guarded(() => play(1)),
      ),
      btn(
        "Both",
        guarded(() => play(0)),
      ),
      btn(
        "Left → Right → Both",
        guarded(async () => {
          for (const pan of [-1, 1, 0] as const) {
            if (disposed) return;
            await play(pan, 900);
            await sleep(150);
          }
        }),
        "primary",
      ),
    ];

    output.addEventListener("change", () => {
      audio.setSinkId?.(output.value).catch((err: unknown) => {
        ctx.setStatus(
          "fail",
          `Could not switch output: ${err instanceof Error ? err.message : err}`,
        );
      });
    });
    if (audio.setSinkId) {
      void listDevices("audiooutput").then((devices) =>
        fillSelect(
          output,
          devices.filter((d) => d.deviceId !== "default"),
          "",
          "Speaker",
          [["", "System default"]],
        ),
      );
    }

    ctx.onCleanup(() => {
      disposed = true;
      void audio.close();
    });

    ctx.root.append(
      toolbar(
        ...buttons,
        field("Tone", frequency),
        field("Volume", volume),
        outputField,
      ),
      stage,
    );
    ctx.setStatus("pending", "Play the tones and confirm they are audible");
  },
};

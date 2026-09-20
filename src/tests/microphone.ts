import { h } from "../dom.ts";
import {
  describeError,
  fillSelect,
  listDevices,
  stopStream,
} from "../media.ts";
import { btn, field, fitCanvas, overlay, stat, toolbar } from "../ui.ts";
import type { Test } from "../types.ts";

const FLOOR_DB = -60;
const DETECT_RMS = 0.02;
const RECORD_SECONDS = 4;

const toDb = (linear: number) =>
  linear > 0 ? Math.max(-90, 20 * Math.log10(linear)) : -90;
const toPercent = (db: number) =>
  Math.max(0, Math.min(100, ((db - FLOOR_DB) / -FLOOR_DB) * 100));

export const microphoneTest: Test = {
  id: "microphone",
  title: "Microphone",
  summary:
    "Speak or tap near the microphone. The level meter and waveform react, and you can record and play back a clip.",
  run(ctx) {
    const canvas = h("canvas");
    const status = overlay();
    status.show("Requesting microphone…");
    const stage = h("div", { class: "stage scope" }, canvas, status.el);

    const fill = h("div", { class: "meter-fill" });
    const peakMark = h("div", { class: "meter-peak" });
    const meter = h("div", { class: "meter" }, fill, peakMark);
    const levelText = h("span", { class: "meter-text" }, "−∞ dBFS");

    const deviceSelect = h("select", { "aria-label": "Microphone" });
    const player = h("audio", { controls: true, hidden: true });
    const device = stat("Device");
    const sampleRate = stat("Sample rate");
    const channels = stat("Channels");
    const peak = stat("Peak");

    let stream: MediaStream | null = null;
    let audio: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let sequence = 0;
    let disposed = false;
    let detected = false;
    let peakDb = -90;
    let frame = 0;
    let clipUrl: string | null = null;
    let recorder: MediaRecorder | null = null;

    const colors = getComputedStyle(ctx.root);
    const accent = colors.getPropertyValue("--accent").trim() || "#4f8cff";
    const grid = colors.getPropertyValue("--border").trim() || "#283149";
    const g = canvas.getContext("2d")!;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      if (!analyser) return;
      const samples = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;
      let max = 0;
      for (const v of samples) {
        sum += v * v;
        max = Math.max(max, Math.abs(v));
      }
      const rms = Math.sqrt(sum / samples.length);
      const db = toDb(rms);
      peakDb = Math.max(db, peakDb - 0.4);

      fill.style.clipPath = `inset(0 ${100 - toPercent(db)}% 0 0)`;
      peakMark.style.left = `${toPercent(peakDb)}%`;
      levelText.textContent = `${db <= -90 ? "−∞" : db.toFixed(0)} dBFS`;
      peak.set(`${toDb(max) <= -90 ? "−∞" : toDb(max).toFixed(0)} dBFS`);

      if (!detected && rms > DETECT_RMS) {
        detected = true;
        ctx.setStatus("pass", `Signal detected (${db.toFixed(0)} dBFS)`);
      }

      const { width, height } = canvas;
      g.clearRect(0, 0, width, height);
      g.strokeStyle = grid;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(0, height / 2);
      g.lineTo(width, height / 2);
      g.stroke();
      g.strokeStyle = accent;
      g.lineWidth = 2 * (window.devicePixelRatio || 1);
      g.beginPath();
      samples.forEach((v, i) => {
        const x = (i / (samples.length - 1)) * width;
        const y = height / 2 - v * (height / 2) * 0.9;
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      });
      g.stroke();
    };

    const teardownAudio = () => {
      stopStream(stream);
      stream = null;
      analyser = null;
      void audio?.close();
      audio = null;
    };

    const refreshDevices = async (selected?: string) => {
      fillSelect(
        deviceSelect,
        await listDevices("audioinput"),
        selected ?? deviceSelect.value,
        "Microphone",
      );
    };

    const start = async () => {
      const id = ++sequence;
      teardownAudio();
      detected = false;
      peakDb = -90;
      status.show("Starting microphone…");
      try {
        // Raw signal: processing would hide a weak or noisy microphone.
        const next = await navigator.mediaDevices.getUserMedia({
          audio: {
            ...(deviceSelect.value
              ? { deviceId: { exact: deviceSelect.value } }
              : {}),
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (disposed || id !== sequence) {
          stopStream(next);
          return;
        }
        stream = next;
        const track = next.getAudioTracks()[0]!;
        track.addEventListener("ended", () => {
          if (stream !== next) return;
          status.show("Microphone disconnected.", true);
          ctx.setStatus("fail", "Microphone disconnected");
        });
        audio = new AudioContext();
        void audio.resume();
        analyser = audio.createAnalyser();
        analyser.fftSize = 2048;
        audio.createMediaStreamSource(next).connect(analyser);

        const s = track.getSettings();
        device.set(track.label || "Unknown microphone");
        sampleRate.set(`${audio.sampleRate} Hz`);
        channels.set(String(s.channelCount ?? "–"));
        status.hide();
        await refreshDevices(s.deviceId);
        ctx.setStatus(
          "pending",
          "Waiting for sound — speak or tap near the microphone",
        );
      } catch (err) {
        if (disposed || id !== sequence) return;
        const message = describeError(err);
        status.show(message, true);
        ctx.setStatus("fail", message);
      }
    };

    const recordButton = btn(
      "Record 4 s clip",
      () => {
        if (!stream || typeof MediaRecorder === "undefined") return;
        const chunks: Blob[] = [];
        const rec = new MediaRecorder(stream);
        recorder = rec;
        rec.ondataavailable = (e) => chunks.push(e.data);
        rec.onstop = () => {
          recordButton.disabled = false;
          recordButton.textContent = "Record 4 s clip";
          if (disposed) return;
          if (clipUrl) URL.revokeObjectURL(clipUrl);
          clipUrl = URL.createObjectURL(
            new Blob(chunks, { type: rec.mimeType }),
          );
          player.src = clipUrl;
          player.hidden = false;
          void player.play().catch(() => undefined);
        };
        recordButton.disabled = true;
        let remaining = RECORD_SECONDS;
        recordButton.textContent = `Recording… ${remaining}`;
        const tick = setInterval(() => {
          remaining--;
          if (remaining > 0)
            recordButton.textContent = `Recording… ${remaining}`;
          else {
            clearInterval(tick);
            if (rec.state !== "inactive") rec.stop();
          }
        }, 1000);
        rec.start();
      },
      "primary",
    );
    if (typeof MediaRecorder === "undefined") recordButton.hidden = true;

    const onDeviceChange = () => void refreshDevices();
    navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);
    deviceSelect.addEventListener("change", () => void start());
    const stopFit = fitCanvas(canvas);
    frame = requestAnimationFrame(draw);

    ctx.onCleanup(() => {
      disposed = true;
      cancelAnimationFrame(frame);
      stopFit();
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        onDeviceChange,
      );
      if (recorder && recorder.state !== "inactive") recorder.stop();
      player.pause();
      if (clipUrl) URL.revokeObjectURL(clipUrl);
      teardownAudio();
    });

    ctx.root.append(
      toolbar(field("Microphone", deviceSelect), recordButton, player),
      stage,
      h("div", { class: "meter-row" }, meter, levelText),
      h(
        "div",
        { class: "stats" },
        device.el,
        sampleRate.el,
        channels.el,
        peak.el,
      ),
    );
    void start();
  },
};

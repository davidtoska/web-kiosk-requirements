import "./pico.css";
import "./style.css";
import { button } from "./dom.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;
const menuBar = document.createElement("div");
const globalEventDisplay = document.createElement("div");
const lastKeyDisplay = document.createElement("p");
lastKeyDisplay.innerText = "Last keydown: ";
const lastMouseClick = document.createElement("p");
lastMouseClick.innerText = "Last mouse-click: ";
globalEventDisplay.classList.add("global-event-display");
globalEventDisplay.appendChild(lastKeyDisplay);
globalEventDisplay.appendChild(lastMouseClick);

menuBar.classList.add("menubar");
const mainElement = document.createElement("div");
mainElement.classList.add("main-element");

const saveStringToLocalStorage = (value: string) => {
  localStorage.setItem("test-key", value);
};

const getStringFromLocalStorage = (): string => {
  return localStorage.getItem("test-key") ?? "NO VALUE IN LOCAL STORAGE";
};

document.addEventListener("keydown", (e) => {
  console.log(e);
  const alt = e.altKey ? "Alt" : "";
  const shift = e.shiftKey ? "Shift" : "";
  const ctrl = e.ctrlKey ? "Ctrl" : "";
  const userGesture = "userGesture: " + e.isTrusted;

  const modifiers = [alt, shift, ctrl].filter((x) => x !== "").join(", ");
  lastKeyDisplay.innerText = `Last keydown: ${e.key} (${modifiers}) ${userGesture}`;
});

document.addEventListener("click", (e) => {
  console.log(e);
  lastMouseClick.innerText = `Last mouse-click: ${e.clientX}, ${e.clientY} userGesture: ${e.isTrusted}`;
});

// Global state
let mediaStream: MediaStream | null = null;
const cleanUpMedia = () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
};
let cleanUp = () => {};
const clearMainElement = () => {
  cleanUp();
  cleanUpMedia();
  mainElement.innerHTML = "";
};

const tryLocalStorage = () => {
  clearMainElement();
  const container = document.createElement("div");
  container.style.width = "700px";
  container.style.height = "500px";
  container.style.background = "white";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "Type here";
  const button = document.createElement("button");
  button.style.display = "block";
  button.textContent = "Save to LocalStorage";
  const savedText = document.createElement("p");
  savedText.textContent = "From local-storage: " + getStringFromLocalStorage();
  button.onclick = () => {
    const value = input.value;
    saveStringToLocalStorage(value);
    savedText.innerText = "From local-storage: " + value;
  };
  container.appendChild(savedText);
  container.appendChild(input);
  container.appendChild(button);
  mainElement.appendChild(container);
};

const tryVideo = () => {
  clearMainElement();
  const video = document.createElement("video");
  video.src = "https://www.w3schools.com/html/mov_bbb.mp4";
  video.style.width = "700px";
  video.controls = true;
  mainElement.appendChild(video);
  video.play();
};
app.appendChild(menuBar);
app.appendChild(mainElement);
app.appendChild(globalEventDisplay);

const tryWebCam = () => {
  clearMainElement();
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: true })
    .then((stream) => {
      const video = document.createElement("video");
      video.srcObject = stream;
      video.style.width = "700px";
      video.style.height = "500px";
      video.style.background = "red";
      video.style.display = "block";
      video.controls = true;
      video.volume = 1;
      mediaStream = stream;
      setTimeout(() => {
        video.play();
      }, 100);
      mainElement.appendChild(video);
    })
    .catch((err) => {
      console.error(err);
    });
};
const tryYoutube = () => {
  clearMainElement();
  const video = document.createElement("iframe");

  video.src = "https://www.youtube.com/embed/tUNbhYcY9Ik?si=4pdAd2cVqAFom0Ni";
  video.style.width = "700px";
  video.style.height = "500px";
  video.allow =
    "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  video.referrerPolicy = "strict-origin-when-cross-origin";
  video.allowFullscreen = true;
  video.title = "YouTube video player";
  mainElement.appendChild(video);
};
menuBar.appendChild(button("Try Video", tryVideo));
menuBar.appendChild(button("Try WebCam", tryWebCam));
menuBar.appendChild(button("Try Youtube", tryYoutube));
menuBar.appendChild(button("Try LocalStorage", tryLocalStorage));

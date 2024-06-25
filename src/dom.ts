export const button = (text: string, callback: () => void) => {
  const btn = document.createElement("button");
  btn.textContent = text;
  btn.onclick = callback;
  return btn;
};

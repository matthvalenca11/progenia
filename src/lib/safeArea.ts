const FALLBACK_INSETS = {
  top: 47,
  bottom: 34,
  left: 0,
  right: 0,
};

function readInset(side: "top" | "bottom" | "left" | "right") {
  const el = document.createElement("div");
  el.style.cssText =
    "position:fixed;visibility:hidden;pointer-events:none;padding:0;margin:0;border:0;";
  const prop =
    side === "top"
      ? "paddingTop"
      : side === "bottom"
        ? "paddingBottom"
        : side === "left"
          ? "paddingLeft"
          : "paddingRight";
  (el.style as Record<string, string>)[prop] =
    `env(safe-area-inset-${side}, constant(safe-area-inset-${side}))`;
  document.body.appendChild(el);
  const value = parseFloat(getComputedStyle(el)[prop as "paddingTop"] || "0") || 0;
  document.body.removeChild(el);
  return value;
}

export function applySafeAreaInsets() {
  let top = readInset("top");
  let bottom = readInset("bottom");
  let left = readInset("left");
  let right = readInset("right");

  // WKWebView/Capacitor às vezes retorna 0 mesmo com notch — fallback iPhone moderno.
  if (top === 0 && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    top = FALLBACK_INSETS.top;
    bottom = bottom || FALLBACK_INSETS.bottom;
  }

  const root = document.documentElement;
  root.style.setProperty("--sat", `${top}px`);
  root.style.setProperty("--sab", `${bottom}px`);
  root.style.setProperty("--sal", `${left}px`);
  root.style.setProperty("--sar", `${right}px`);
}

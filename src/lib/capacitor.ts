import { Capacitor } from "@capacitor/core";
import { applySafeAreaInsets } from "@/lib/safeArea";

export const isNativeApp = Capacitor.isNativePlatform();
export const isNativeMobile =
  isNativeApp && (Capacitor.getPlatform() === "ios" || Capacitor.getPlatform() === "android");

export async function initNativeApp() {
  if (!isNativeApp) return;

  document.documentElement.classList.add("native-app");
  if (Capacitor.getPlatform() === "ios") {
    document.documentElement.classList.add("native-ios");
  }

  let viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) {
    viewport = document.createElement("meta");
    viewport.setAttribute("name", "viewport");
    document.head.appendChild(viewport);
  }
  viewport.setAttribute(
    "content",
    "width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=1, viewport-fit=cover, user-scalable=no",
  );

  applySafeAreaInsets();
  window.addEventListener("orientationchange", () => {
    window.setTimeout(applySafeAreaInsets, 100);
  });

  document.body.style.overscrollBehavior = "none";
  document.body.style.touchAction = "manipulation";
}

import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.matthvalenca11.progenia",
  appName: "ProGenia",
  webDir: "dist",
  ios: {
    contentInset: "never",
    preferredContentMode: "mobile",
    scrollEnabled: true,
  },
  server: {
    androidScheme: "https",
    iosScheme: "https",
    allowNavigation: [
      "*.youtube.com",
      "*.youtube-nocookie.com",
      "*.youtu.be",
      "*.googlevideo.com",
      "*.ytimg.com",
    ],
  },
};

export default config;

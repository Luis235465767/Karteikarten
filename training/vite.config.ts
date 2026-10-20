import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// BASE: Pfad, unter dem die App online liegt. Für GitHub Pages im Repo „Karteikarten“: /Karteikarten/training/
// Für Netlify oder lokal: "/" (Standard). Setzen per Umgebungsvariable BASE.
const base = process.env.BASE ?? "/";

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Trainingstagebuch",
        short_name: "Training",
        description: "Krafttraining und Handball aufzeichnen und auswerten",
        lang: "de",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#0b0f14",
        theme_color: "#0b0f14",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
        navigateFallback: "index.html",
      },
    }),
  ],
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(rootDirectory, "./src"),
    },
  },
  server: {
    proxy: {
      "/api/v2": {
        target: "https://app.epsilonengg.in",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            // The backend returns 502 on any request that includes an Origin
            // or Referer header. Browsers always send these on fetch() calls,
            // but the Vite proxy does not strip them automatically.
            proxyReq.removeHeader("origin");
            proxyReq.removeHeader("referer");
          });
        },
      },
    },
  },
});

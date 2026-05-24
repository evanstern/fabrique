import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const allowedHosts = [
  "localhost",
  "dev-fabrique.infinitynode.ai",
  ...(process.env.FABRIQUE_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean),
];

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    allowedHosts: Array.from(new Set(allowedHosts)),
  },
});

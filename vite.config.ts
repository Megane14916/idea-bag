import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	plugins: [react(), cloudflare()],
	// Google OAuth redirects must match the configured local origin exactly.
	server: { port: 5173, strictPort: true },
});

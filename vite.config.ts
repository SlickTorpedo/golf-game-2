import { defineConfig } from 'vite';

// Relative base so the built game works from any folder or static host.
// host: true listens on every network interface, not just localhost, so other
// machines (on the LAN or over a VPN such as Tailscale) can open the game.
export default defineConfig({
  base: './',
  build: { chunkSizeWarningLimit: 900 },
  server: { host: true },
  preview: { host: true },
});

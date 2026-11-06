import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { routinesPlugin } from "./server/routinesPlugin.mjs";

/**
 * The admin dashboard only ever runs here, on this computer. It is never built or deployed, and
 * the dev server listens on 127.0.0.1 only, so nothing else on the network can open it either.
 *
 * It reads the Supabase address and public key from the app's own .env (two folders up). Only
 * settings starting EXPO_PUBLIC_SUPABASE_ reach the page; the service role key in that file
 * doesn't, and the dashboard never needs it: every number comes through the admin-only functions
 * in 20261106_0001_admin_dashboard.sql, signed in as you.
 *
 * routinesPlugin lets the Routines page read and save src/features/ar/routineLayouts.data.json.
 */
export default defineConfig({
  plugins: [react(), routinesPlugin()],
  envDir: "../..",
  envPrefix: "EXPO_PUBLIC_SUPABASE_",
  server: { host: "127.0.0.1", port: 5620, strictPort: true },
  preview: { host: "127.0.0.1", port: 5620, strictPort: true },
});

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function isSecretKey(k) {
  const s = String(k || "").trim();
  if (!s) return false;
  if (/^sb_secret_/i.test(s)) return true;
  const parts = s.split(".");
  if (parts.length === 3) {
    try {
      const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
      if (payload?.role === "service_role") return true;
    } catch { /* not a JWT */ }
  }
  return false;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  if (isSecretKey(process.env.VITE_SUPABASE_ANON_KEY) || isSecretKey(env.VITE_SUPABASE_ANON_KEY)) {
    throw new Error(
      "Refusing to build with a Supabase secret / service_role key in VITE_SUPABASE_ANON_KEY. Use the publishable / anon key instead."
    );
  }
  return { base: "./", plugins: [react()] };
});

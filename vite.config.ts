import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  const url = env.VITE_SUPABASE_URL || "";
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  let isPublicKey = key.startsWith("sb_publishable_");
  if (!isPublicKey && key) {
    try {
      isPublicKey = JSON.parse(atob(key.split(".")[1])).role === "anon";
    } catch {
      /* Invalid key. */
    }
  }
  if (
    (url || key) &&
    (!/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) || !isPublicKey)
  ) {
    throw new Error(
      "Supabase URL과 publishable key를 함께 설정하세요. 비밀 키는 브라우저 빌드에 사용할 수 없습니다.",
    );
  }
  return {
    plugins: [react(), tailwindcss()],
    build: {
      manifest: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (/node_modules\/(react|react-dom|scheduler)\//.test(id))
              return "react";
            if (id.includes("/node_modules/@supabase/")) return "supabase";
            // Let Rollup share UI code by actual imports. One all-HeroUI chunk
            // also pulls controls used only in deferred community screens.
          },
        },
      },
    },
  };
});

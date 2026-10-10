import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react";
          if (
            /node_modules\/(@heroui|react-aria|@react-aria|@react-stately|@react-types|@internationalized)\//.test(
              id,
            ) ||
            id.includes("/node_modules/react-aria-components/")
          )
            return "heroui";
        },
      },
    },
  },
});

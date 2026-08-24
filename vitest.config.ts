import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // `server-only` 는 클라이언트 번들에 섞이는 것을 막는 표지인데, import 만
      // 해도 던지므로 서버 모듈을 테스트에서 직접 못 부른다. 표지는 남겨 두고
      // 테스트에서만 빈 모듈로 바꾼다.
      "server-only": path.resolve(__dirname, "__tests__/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["__tests__/**/*.test.ts"],
    testTimeout: 30_000,
  },
});

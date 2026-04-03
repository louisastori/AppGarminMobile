import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "packages/**/*.test.ts",
      "apps/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      all: true,
      include: [
        "packages/shared/src/**/*.ts",
        "packages/domain/src/**/*.ts",
        "packages/connectors/src/**/*.ts",
        "packages/ui/src/**/*.ts",
        "apps/api/src/**/*.ts",
        "apps/web/src/**/*.ts",
        "apps/mobile/src/modules/garmin-connect-iq/**/*.ts"
      ],
      exclude: [
        "**/*.test.ts",
        "**/*.d.ts",
        "packages/**/src/index.ts",
        "apps/**/src/index.ts",
        "apps/api/src/build.ts",
        "apps/api/src/server.ts",
        "apps/web/src/build.ts",
        "apps/web/src/dev.ts",
        "apps/mobile/src/modules/garmin-connect-iq/factory.ts",
        "apps/mobile/src/modules/garmin-connect-iq/index.ts",
        "apps/mobile/src/modules/garmin-connect-iq/native.ts",
        "apps/mobile/src/modules/garmin-connect-iq/realBridge.ts",
        "apps/mobile/src/modules/garmin-connect-iq/types.ts",
        "packages/domain/src/watch-models.ts"
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      }
    }
  }
});

import { defineComputeConfig } from "@prisma/compute-sdk/config";

export default defineComputeConfig({
  app: {
    name: "bakersmania",
    framework: "bun",
    entry: "apps/api/src/server.ts",
    httpPort: 4000,
  },
});

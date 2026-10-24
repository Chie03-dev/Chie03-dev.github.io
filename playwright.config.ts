import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: "http://127.0.0.1:8123",
  },
  webServer: {
    command: "python -m http.server 8123 --directory out",
    url: "http://127.0.0.1:8123",
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
});

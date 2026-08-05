import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/mobile",
  fullyParallel: false,
  timeout: 45_000,
  expect: {
    timeout: 8_000
  },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:5198",
    actionTimeout: 8_000,
    navigationTimeout: 15_000,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "retain-on-failure"
  },
  projects: [
    {
      name: "iphone-webkit",
      use: {
        ...devices["iPhone 13"],
        browserName: "webkit"
      }
    }
  ],
  webServer: {
    command: "PORT=5198 npm run dev",
    url: "http://127.0.0.1:5198",
    reuseExistingServer: true,
    timeout: 20_000
  }
});

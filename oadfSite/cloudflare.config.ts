import { defineConfig } from "cf/config";

export default defineConfig({
  accountId: "bf5936596955a58db56b2a497de60c74",
  worker: {
    name: "oadf",
    compatibilityDate: "2026-11-22",
    workersDev: false,
    domains: ["oadf.dev", "www.oadf.dev"],
    observability: {
      enabled: true,
      traces: { enabled: true },
    },
    assets: {
      htmlHandling: "auto-trailing-slash",
      notFoundHandling: "404-page",
    },
  },
});

const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.{js,mjs}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.js"],
      exclude: ["src/app.js"],
      reporter: ["text", "lcov"]
    }
  }
});

import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["./src/cli.ts"],
  format: "esm",
  target: "node22",
  platform: "node",
  clean: true,
  dts: true,
  shims: true,
  external: ["node:*"],
  alias: {
    "~/": "./src/",
  },
  outDir: "./dist",
  sourcemap: true,
  unbundle: false,
  treeshake: true,
  splitting: false,
  minify: false,
  env: {
    NODE_ENV: "production",
  },
});

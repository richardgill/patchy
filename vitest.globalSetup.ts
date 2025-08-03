import { execSync } from "node:child_process";

export const setup = () => {
  console.log("\n🔨 Running build before tests...");
  try {
    execSync("pnpm run build --silent", { stdio: "inherit" });
    console.log("✅ Build completed successfully\n");
  } catch (error) {
    console.error("❌ Build failed:", error);
    process.exit(1);
  }
};

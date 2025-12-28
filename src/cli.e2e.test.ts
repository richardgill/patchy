import { describe, expect, it } from "bun:test";
import { runCli } from "~/testing/e2e-utils";
import { generateTmpDir } from "~/testing/fs-test-utils";

describe("patchy CLI", () => {
  describe("--help with AI agent detection", () => {
    it("should show tip when AI agent env var is set", async () => {
      const tmpDir = generateTmpDir();
      const result = await runCli("--help", tmpDir, {
        env: { CLAUDECODE: "1" },
      });

      expect(result.stdout).toContain("TIP: Run `patchy prime`");
    });

    it("should NOT show tip when no agent env vars are set", async () => {
      const tmpDir = generateTmpDir();
      const result = await runCli("--help", tmpDir, {
        env: { CLAUDECODE: "", AI_AGENT: "" },
      });

      expect(result.stdout).not.toContain("TIP: Run `patchy prime`");
    });

    it("should NOT show tip for subcommand help", async () => {
      const tmpDir = generateTmpDir();
      const result = await runCli("init --help", tmpDir, {
        env: { CLAUDECODE: "1" },
      });

      expect(result.stdout).not.toContain("TIP: Run `patchy prime`");
    });
  });
});

// Uses raw bun $ instead of scenario()/runCli() because we need to test
// the actual CLI entry point (src/cli.ts), not just the Stricli app
import { describe, expect, it } from "bun:test";
import { $ } from "bun";

const clearAgentEnv = { CLAUDECODE: "", AI_AGENT: "" };

describe("patchy CLI", () => {
  describe("--help with AI agent detection", () => {
    it("should show tip when AI agent env var is set", async () => {
      const result = await $`bun run src/cli.ts --help`
        .env({ ...clearAgentEnv, CLAUDECODE: "1" })
        .text();

      expect(result).toContain("TIP: Run `patchy prime`");
    });

    it("should NOT show tip when no agent env vars are set", async () => {
      const result = await $`bun run src/cli.ts --help`
        .env(clearAgentEnv)
        .text();

      expect(result).not.toContain("TIP: Run `patchy prime`");
    });

    it("should NOT show tip for subcommand help", async () => {
      const result = await $`bun run src/cli.ts init --help`
        .env({ ...clearAgentEnv, CLAUDECODE: "1" })
        .text();

      expect(result).not.toContain("TIP: Run `patchy prime`");
    });
  });
});

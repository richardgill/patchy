import { describe, expect, it } from "bun:test";
import { scenario } from "~/testing/scenario";

describe("patchy prime", () => {
  it("should output AI context with config values", async () => {
    const ctx = await scenario({
      config: {
        source_repo: "https://github.com/owner/my-lib.git",
        patches_dir: "my-patches",
        clones_dir: "my-clones",
        target_repo: "my-lib",
        base_revision: "v1.0.0",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("## Patchy");
    expect(result.stdout).toContain("./patchy.json");
    expect(result.stdout).toContain("./my-patches/");
    expect(result.stdout).toContain("./my-clones/my-lib/");
    expect(result.stdout).toContain("patchy generate --patch-set <name>");
    expect(result.stdout).toContain("patchy apply --auto-commit all");
    expect(result.stdout).toContain("patchy repo reset --yes");
  });

  it("should show source_repo when configured", async () => {
    const ctx = await scenario({
      config: {
        source_repo: "https://github.com/owner/my-lib.git",
        base_revision: "v2.0.0",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain(
      "Source: `https://github.com/owner/my-lib.git`",
    );
  });

  it("should show base_revision", async () => {
    const ctx = await scenario({
      config: {
        source_repo: "https://github.com/owner/repo.git",
        base_revision: "v2.0.0",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("Base revision: `v2.0.0`");
  });

  it("should default base_revision to main when not specified", async () => {
    const ctx = await scenario({
      rawConfig: {
        source_repo: "https://github.com/owner/repo.git",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("Base revision: `main`");
  });

  it("should list existing patch sets", async () => {
    const ctx = await scenario({
      config: {
        source_repo: "https://github.com/owner/repo.git",
        base_revision: "main",
      },
      patches: {
        "001-feature-one": { "file.diff": "diff content" },
        "002-feature-two": { "other.diff": "other diff" },
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("Patch sets:");
    expect(result.stdout).toContain("- `001-feature-one/`");
    expect(result.stdout).toContain("- `002-feature-two/`");
  });

  it("should show (none yet) when no patch sets exist", async () => {
    const ctx = await scenario({
      config: {
        source_repo: "https://github.com/owner/repo.git",
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("Patch sets:");
    expect(result.stdout).toContain("(none yet)");
  });

  it("should not show Source line when source_repo is not configured", async () => {
    const ctx = await scenario({
      rawConfig: {
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).not.toContain("Source:");
  });

  it("should use default paths when not specified in config", async () => {
    const ctx = await scenario({
      rawConfig: {
        source_repo: "https://github.com/owner/repo.git",
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("./patches/");
    expect(result.stdout).toContain("./clones/repo/");
  });

  it("should handle SSH git URLs", async () => {
    const ctx = await scenario({
      rawConfig: {
        source_repo: "git@github.com:owner/ssh-repo.git",
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("./clones/ssh-repo/");
  });

  it("should handle local file paths as source_repo", async () => {
    const ctx = await scenario({
      rawConfig: {
        source_repo: "/path/to/local/repo",
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("./clones/repo/");
  });

  it("should show placeholder when source_repo is missing", async () => {
    const ctx = await scenario({
      rawConfig: {
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("<repo-name>");
  });

  it("should fail when config file does not exist", async () => {
    const ctx = await scenario({ noConfig: true });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toFail();
    expect(result.stderr).toContain("Configuration file not found");
  });

  it("should respect custom --config path", async () => {
    const ctx = await scenario({
      rawConfig: {
        source_repo: "https://github.com/owner/custom-config.git",
        base_revision: "main",
      },
      configPath: "custom.json",
    });

    const { result } = await ctx.runCli("patchy prime --config custom.json");

    expect(result).toSucceed();
    expect(result.stdout).toContain("./custom.json");
    expect(result.stdout).toContain("custom-config");
  });

  it("should strip .git suffix from repo name", async () => {
    const ctx = await scenario({
      rawConfig: {
        source_repo: "https://github.com/owner/with-git-suffix.git",
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("./clones/with-git-suffix/");
    expect(result.stdout).not.toContain(".git/");
  });

  it("should use target_repo when set", async () => {
    const ctx = await scenario({
      config: {
        source_repo: "https://github.com/owner/some-repo.git",
        target_repo: "my-target",
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).toContain("./repos/my-target/");
  });

  it("should not produce double slashes when paths have trailing slashes", async () => {
    const ctx = await scenario({
      rawConfig: {
        source_repo: "https://github.com/qmk/qmk_firmware.git",
        clones_dir: "./clones/",
        patches_dir: "./patches/",
        base_revision: "0.29.11",
        target_repo: "qmk_firmware",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).not.toContain(".//");
    expect(result.stdout).toContain("./clones/qmk_firmware/");
    expect(result.stdout).toContain("./patches/");
  });

  it("should handle multiple trailing slashes", async () => {
    const ctx = await scenario({
      rawConfig: {
        source_repo: "https://github.com/owner/repo.git",
        clones_dir: "./clones///",
        patches_dir: "./patches///",
        base_revision: "main",
      },
    });

    const { result } = await ctx.runCli("patchy prime");

    expect(result).toSucceed();
    expect(result.stdout).not.toContain(".//");
    expect(result.stdout).toContain("./clones/repo/");
    expect(result.stdout).toContain("./patches/");
  });
});

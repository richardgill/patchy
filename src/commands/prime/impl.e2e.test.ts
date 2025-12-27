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
    expect(result.stdout).toContain("patchy generate");
    expect(result.stdout).toContain("patchy apply");
    expect(result.stdout).toContain("patchy repo reset");
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
});

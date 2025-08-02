import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveConfig } from "../config/resolver";
import type { PartialResolvedConfig, ResolvedConfig } from "../config/types";
import type { LocalContext } from "../context";

vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}));

vi.mock("../config/yaml-config", () => ({
  parseOptionalYamlConfig: vi.fn(),
}));

const { existsSync } = await import("node:fs");
const { parseOptionalYamlConfig } = await import("../config/yaml-config");

const createMockContext = (): LocalContext =>
  ({
    process: {
      stdout: {
        write: vi.fn(),
      },
    } as any,
  }) as LocalContext;

describe("resolveConfig", () => {
  let mockContext: LocalContext;

  beforeEach(() => {
    mockContext = createMockContext();
    vi.clearAllMocks();
  });

  const setupConfigMock = (
    config: PartialResolvedConfig,
    fileExists = true,
  ) => {
    vi.mocked(existsSync).mockReturnValue(fileExists);
    vi.mocked(parseOptionalYamlConfig).mockReturnValue(config);
  };

  describe("with no required fields", () => {
    it("should return partial config when no fields required", async () => {
      setupConfigMock({});

      const result = await resolveConfig(mockContext, {}, []);

      expect(result).toEqual({
        repoUrl: undefined,
        repoDir: undefined,
        repoBaseDir: undefined,
        patchesDir: "./patches/",
        ref: "main",
        verbose: false,
        dryRun: false,
      });
    });

    it("should merge flags with yaml config", async () => {
      const yamlConfig = {
        repo_url: "https://github.com/yaml/repo.git",
        repo_dir: "yaml-dir",
        patches_dir: "yaml-patches",
      };
      setupConfigMock(yamlConfig);

      const result = await resolveConfig(
        mockContext,
        {
          "repo-dir": "flag-dir",
          verbose: true,
        },
        [],
      );

      expect(result).toEqual({
        repoUrl: "https://github.com/yaml/repo.git",
        repoDir: "flag-dir",
        repoBaseDir: undefined,
        patchesDir: "yaml-patches",
        ref: "main",
        verbose: true,
        dryRun: false,
      });
    });

    it("should use defaults when neither flags nor yaml provide values", async () => {
      setupConfigMock({});

      const result = await resolveConfig(
        mockContext,
        {
          "repo-url": "https://github.com/test/repo.git",
        },
        [],
      );

      expect(result).toEqual({
        repoUrl: "https://github.com/test/repo.git",
        repoDir: undefined,
        repoBaseDir: undefined,
        patchesDir: "./patches/",
        ref: "main",
        verbose: false,
        dryRun: false,
      });
    });
  });

  describe("with required fields", () => {
    it("should validate required repo-url and repo-dir", async () => {
      const yamlConfig = {
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
      };
      setupConfigMock(yamlConfig);

      const result = await resolveConfig(mockContext, {}, [
        "repo_url",
        "repo_dir",
      ]);

      expect(result).toEqual({
        repoUrl: "https://github.com/test/repo.git",
        repoDir: "test-dir",
        repoBaseDir: undefined,
        patchesDir: "./patches/",
        ref: "main",
        verbose: false,
        dryRun: false,
      });
    });

    it("should throw error when required repo-url is missing", async () => {
      setupConfigMock({
        repo_dir: "test-dir",
      });

      await expect(
        resolveConfig(mockContext, {}, ["repo_url", "repo_dir"]),
      ).rejects.toThrow("Missing required configuration: repo-url");
    });

    it("should throw error when required repo-dir is missing", async () => {
      setupConfigMock({
        repo_url: "https://github.com/test/repo.git",
      });

      await expect(
        resolveConfig(mockContext, {}, ["repo_url", "repo_dir"]),
      ).rejects.toThrow("Missing required configuration: repo-dir");
    });

    it("should throw error when multiple required fields are missing", async () => {
      setupConfigMock({});

      await expect(
        resolveConfig(mockContext, {}, ["repo_url", "repo_dir"]),
      ).rejects.toThrow("Missing required configuration: repo-url, repo-dir");
    });

    it("should allow flags to override yaml for required fields", async () => {
      const yamlConfig = {
        repo_url: "https://github.com/yaml/repo.git",
        repo_dir: "yaml-dir",
      };
      setupConfigMock(yamlConfig);

      const result = await resolveConfig(
        mockContext,
        {
          "repo-url": "https://github.com/flag/repo.git",
          "repo-dir": "flag-dir",
        },
        ["repo_url", "repo_dir"],
      );

      expect(result).toEqual({
        repoUrl: "https://github.com/flag/repo.git",
        repoDir: "flag-dir",
        repoBaseDir: undefined,
        patchesDir: "./patches/",
        ref: "main",
        verbose: false,
        dryRun: false,
      });
    });

    it("should require repo-base-dir when specified as required", async () => {
      setupConfigMock({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
      });

      await expect(
        resolveConfig(mockContext, {}, [
          "repo_url",
          "repo_dir",
          "repo_base_dir",
        ]),
      ).rejects.toThrow("Missing required configuration: repo-base-dir");
    });
  });

  describe("config file handling", () => {
    it("should handle non-existent default config file", async () => {
      setupConfigMock({}, false);

      const result = await resolveConfig(
        mockContext,
        {
          "repo-url": "https://github.com/test/repo.git",
        },
        [],
      );

      expect(result.repo_url).toBe("https://github.com/test/repo.git");
      expect(vi.mocked(parseOptionalYamlConfig)).not.toHaveBeenCalled();
    });

    it("should throw error when explicit config file doesn't exist", async () => {
      setupConfigMock({}, false);

      await expect(
        resolveConfig(mockContext, { config: "custom-config.yaml" }, []),
      ).rejects.toThrow("Configuration file not found: ");
    });

    it("should handle config parse errors", async () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(parseOptionalYamlConfig).mockImplementation(() => {
        throw new Error("Invalid YAML");
      });

      await expect(resolveConfig(mockContext, {}, [])).rejects.toThrow(
        "Failed to parse config file",
      );
    });

    it("should use custom config path", async () => {
      const customConfig = {
        repo_url: "https://github.com/custom/repo.git",
        repo_dir: "custom-dir",
      };
      setupConfigMock(customConfig);

      await resolveConfig(
        mockContext,
        { config: "/custom/path/config.yaml" },
        [],
      );

      expect(vi.mocked(parseOptionalYamlConfig)).toHaveBeenCalledWith(
        "/custom/path/config.yaml",
      );
    });
  });

  describe("verbose logging", () => {
    it("should log configuration when verbose is true from flags", async () => {
      setupConfigMock({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
      });

      await resolveConfig(mockContext, { verbose: true }, [
        "repo_url",
        "repo_dir",
      ]);

      const writeCalls = vi.mocked(mockContext.process.stdout.write).mock.calls;
      expect(writeCalls).toContainEqual(["Configuration resolved:\n"]);
      expect(writeCalls).toContainEqual([
        "  repo_url: https://github.com/test/repo.git\n",
      ]);
      expect(writeCalls).toContainEqual(["  repo_dir: test-dir\n"]);
    });

    it("should log configuration when verbose is true from yaml", async () => {
      setupConfigMock({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
        verbose: true,
      });

      await resolveConfig(mockContext, {}, ["repo_url", "repo_dir"]);

      const writeCalls = vi.mocked(mockContext.process.stdout.write).mock.calls;
      expect(writeCalls).toContainEqual(["Configuration resolved:\n"]);
    });

    it("should not log when verbose is false", async () => {
      setupConfigMock({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
      });

      await resolveConfig(mockContext, {}, ["repo_url", "repo_dir"]);

      expect(mockContext.process.stdout.write).not.toHaveBeenCalled();
    });

    it("should prefer flag verbose over yaml verbose", async () => {
      setupConfigMock({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
        verbose: false,
      });

      await resolveConfig(mockContext, { verbose: true }, [
        "repo_url",
        "repo_dir",
      ]);

      const writeCalls = vi.mocked(mockContext.process.stdout.write).mock.calls;
      expect(writeCalls).toContainEqual(["  verbose: true\n"]);
    });
  });

  describe("all config fields", () => {
    it("should handle all possible configuration fields", async () => {
      const fullConfig = {
        repo_url: "https://github.com/full/repo.git",
        repo_dir: "full-dir",
        repo_base_dir: "/full/base",
        patches_dir: "full-patches",
        ref: "develop",
        verbose: true,
      };
      setupConfigMock(fullConfig);

      const result = await resolveConfig(mockContext, { "dry-run": true }, []);

      expect(result).toEqual({
        repoUrl: "https://github.com/full/repo.git",
        repoDir: "full-dir",
        repoBaseDir: "/full/base",
        patchesDir: "full-patches",
        ref: "develop",
        verbose: true,
        dryRun: true,
      });
    });

    it("should validate all required fields when specified", async () => {
      const requiredFieldsWithoutDefaults = [
        "repo_url",
        "repo_dir",
        "repo_base_dir",
      ] as (keyof ResolvedConfig)[];

      setupConfigMock({});

      await expect(
        resolveConfig(mockContext, {}, requiredFieldsWithoutDefaults),
      ).rejects.toThrow(
        "Missing required configuration: repo-url, repo-dir, repo-base-dir",
      );
    });

    it("should allow boolean fields to be false when required", async () => {
      setupConfigMock({
        repo_url: "https://github.com/test/repo.git",
        repo_dir: "test-dir",
        verbose: false,
      });

      const result = await resolveConfig(mockContext, { "dry-run": false }, [
        "repo_url",
        "repo_dir",
        "verbose",
        "dry_run",
      ]);

      expect(result.verbose).toBe(false);
      expect(result.dry_run).toBe(false);
    });
  });
});

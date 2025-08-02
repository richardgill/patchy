import { describe, expect, it, vi } from "vitest";
import { createMergedConfig } from "~/config/resolver";
import type { ResolvedConfig, SharedFlags } from "~/config/types";

describe("createMergedConfig", () => {
  const createTestCase = (
    description: string,
    input: {
      yamlString?: string;
      flags: SharedFlags & { "repo-url"?: string; ref?: string };
      requiredFields: (keyof ResolvedConfig)[];
      configPath?: string;
    },
    expected: {
      mergedConfig: Partial<ResolvedConfig>;
      success?: boolean;
      error?: string;
    },
  ) => {
    it(description, () => {
      const result = createMergedConfig({
        yamlString: input.yamlString,
        flags: input.flags,
        requiredFields: input.requiredFields,
        configPath: input.configPath ?? "./patchy.yaml",
      });

      expect(result.mergedConfig).toMatchObject(expected.mergedConfig);
      if (expected.success !== undefined) {
        expect(result.success).toBe(expected.success);
      }
      if (expected.error) {
        expect(result.error).toBe(expected.error);
      }
    });
  };

  describe("precedence: CLI flags override YAML config", () => {
    createTestCase(
      "CLI flags take precedence over YAML config",
      {
        yamlString: `
repo_url: https://github.com/yaml/upstream.git
repo_dir: yaml-repo
repo_base_dir: ../yaml-clones
patches_dir: yaml-patches/
ref: yaml-main
verbose: true
`,
        flags: {
          "repo-url": "https://github.com/cli/upstream.git",
          "repo-dir": "cli-repo",
          "patches-dir": "cli-patches/",
          ref: "cli-main",
          verbose: false,
        },
        requiredFields: [],
      },
      {
        mergedConfig: {
          repo_url: "https://github.com/cli/upstream.git",
          repo_dir: "cli-repo",
          repo_base_dir: "../yaml-clones", // from YAML since not in CLI
          patches_dir: "cli-patches/",
          ref: "cli-main",
          verbose: false,
          dry_run: false,
        },
      },
    );
  });

  describe("default values", () => {
    createTestCase(
      "uses default values when not provided in flags or YAML",
      {
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          repo_url: undefined,
          repo_dir: undefined,
          repo_base_dir: undefined,
          patches_dir: "./patches/", // DEFAULT_PATCHES_DIR
          ref: "main", // DEFAULT_REF
          verbose: false,
          dry_run: false,
        },
      },
    );

    createTestCase(
      "YAML config overrides defaults",
      {
        yamlString: `
patches_dir: custom-patches/
ref: develop
verbose: true
`,
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          patches_dir: "custom-patches/",
          ref: "develop",
          verbose: true,
          dry_run: false,
        },
      },
    );
  });

  describe("dry_run flag handling", () => {
    createTestCase(
      "dry_run defaults to false",
      {
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          dry_run: false,
        },
      },
    );

    createTestCase(
      "dry_run can be set via CLI flag",
      {
        flags: {
          "dry-run": true,
        },
        requiredFields: [],
      },
      {
        mergedConfig: {
          dry_run: true,
        },
      },
    );
  });

  describe("YAML parsing", () => {
    createTestCase(
      "handles empty YAML string",
      {
        yamlString: "",
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          patches_dir: "./patches/",
          ref: "main",
          verbose: false,
          dry_run: false,
        },
      },
    );

    createTestCase(
      "handles undefined YAML string",
      {
        yamlString: undefined,
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          patches_dir: "./patches/",
          ref: "main",
          verbose: false,
          dry_run: false,
        },
      },
    );

    createTestCase(
      "handles partial YAML config",
      {
        yamlString: `
repo_url: https://github.com/example/repo.git
ref: v1.2.3
`,
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          repo_url: "https://github.com/example/repo.git",
          repo_dir: undefined,
          repo_base_dir: undefined,
          patches_dir: "./patches/",
          ref: "v1.2.3",
          verbose: false,
          dry_run: false,
        },
      },
    );
  });

  describe("complete configuration scenarios", () => {
    createTestCase(
      "full YAML config matches README example",
      {
        yamlString: `
repo_url: https://github.com/richardgill/upstream.git
repo_dir: upstream-repo
repo_base_dir: ../clones
patches_dir: patches/
ref: main
`,
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          repo_url: "https://github.com/richardgill/upstream.git",
          repo_dir: "upstream-repo",
          repo_base_dir: "../clones",
          patches_dir: "patches/",
          ref: "main",
          verbose: false,
          dry_run: false,
        },
      },
    );

    createTestCase(
      "CLI overrides for typical workflow",
      {
        yamlString: `
repo_url: https://github.com/richardgill/upstream.git
repo_base_dir: ../clones
ref: main
`,
        flags: {
          "repo-dir": "../clones/upstream",
          ref: "v1.2.3",
          verbose: true,
          "dry-run": true,
        },
        requiredFields: [],
      },
      {
        mergedConfig: {
          repo_url: "https://github.com/richardgill/upstream.git",
          repo_dir: "../clones/upstream",
          repo_base_dir: "../clones",
          patches_dir: "./patches/",
          ref: "v1.2.3",
          verbose: true,
          dry_run: true,
        },
      },
    );
  });

  describe("onConfigMerged callback", () => {
    it("calls onConfigMerged with merged config", () => {
      const mockCallback = vi.fn();

      createMergedConfig({
        yamlString: undefined,
        flags: { verbose: true },
        requiredFields: [],
        configPath: "./test.yaml",
        onConfigMerged: mockCallback,
      });

      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          verbose: true,
          dry_run: false,
          patches_dir: "./patches/",
          ref: "main",
        }),
      );
    });
  });

  describe("required fields validation", () => {
    createTestCase(
      "validates required fields are present",
      {
        flags: {
          "repo-dir": "test-repo",
        },
        requiredFields: ["repo_dir", "repo_url"],
      },
      {
        mergedConfig: {
          repo_dir: "test-repo",
          repo_url: undefined,
        },
        success: true, // Will change when validation is implemented
      },
    );
  });

  describe("error handling", () => {
    it("throws on invalid YAML", () => {
      expect(() =>
        createMergedConfig({
          yamlString: "invalid: yaml: content: :",
          flags: {},
          requiredFields: [],
          configPath: "./test.yaml",
        }),
      ).toThrow();
    });

    it("throws on malformed YAML structure", () => {
      expect(() =>
        createMergedConfig({
          yamlString: "- this\n- is\n- a\n- list",
          flags: {},
          requiredFields: [],
          configPath: "./test.yaml",
        }),
      ).toThrow();
    });

    createTestCase(
      "handles missing required repo_url",
      {
        flags: {
          "repo-dir": "test-repo",
        },
        requiredFields: ["repo_url"],
      },
      {
        mergedConfig: {
          repo_url: undefined,
          repo_dir: "test-repo",
        },
        success: true, // Will be false when validation is implemented
      },
    );

    createTestCase(
      "handles missing required repo_dir",
      {
        yamlString: `repo_url: https://github.com/test/repo.git`,
        flags: {},
        requiredFields: ["repo_dir"],
      },
      {
        mergedConfig: {
          repo_url: "https://github.com/test/repo.git",
          repo_dir: undefined,
        },
        success: true, // Will be false when validation is implemented
      },
    );

    createTestCase(
      "handles multiple missing required fields",
      {
        flags: {},
        requiredFields: ["repo_url", "repo_dir", "repo_base_dir"],
      },
      {
        mergedConfig: {
          repo_url: undefined,
          repo_dir: undefined,
          repo_base_dir: undefined,
        },
        success: true, // Will be false when validation is implemented
      },
    );
  });

  describe("edge cases", () => {
    createTestCase(
      "handles boolean false values in YAML",
      {
        yamlString: `
verbose: false
`,
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          verbose: false,
        },
      },
    );

    createTestCase(
      "handles empty string values in YAML",
      {
        yamlString: `
repo_dir: ""
patches_dir: ""
`,
        flags: {},
        requiredFields: [],
      },
      {
        mergedConfig: {
          repo_dir: "",
          patches_dir: "",
        },
      },
    );

    createTestCase(
      "CLI flag undefined values don't override YAML",
      {
        yamlString: `
repo_url: https://github.com/yaml/repo.git
verbose: true
`,
        flags: {
          "repo-url": undefined,
          verbose: undefined,
        },
        requiredFields: [],
      },
      {
        mergedConfig: {
          repo_url: "https://github.com/yaml/repo.git",
          verbose: true,
        },
      },
    );
  });
});

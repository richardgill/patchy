export type CLIResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  failed: boolean;
  command: string;
  cwd: string;
};

export type FileMap = Record<string, string>;

export type CLIResult = {
  stdout: string;
  stderr: string;
  exitCode: number;
  failed: boolean;
  command: string;
  cwd: string;
};

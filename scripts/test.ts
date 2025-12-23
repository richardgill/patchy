import { $ } from "bun";

const result = await $`bun test --max-concurrency=5 ${Bun.argv.slice(2)}`
  .nothrow()
  .quiet();

process.stdout.write(result.stdout);
process.stderr.write(result.stderr);

const output = result.stdout.toString() + result.stderr.toString();
if (/snapshots:.*failed/.test(output)) {
  console.log("\nTo update snapshots: bun run test -u");
}

process.exit(result.exitCode);

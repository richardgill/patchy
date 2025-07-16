import type { LocalContext } from "../../context.js";

type InitCommandFlags = Record<string, never>;

export default async function (
  this: LocalContext,
  _flags: InitCommandFlags,
): Promise<void> {
  console.log("hello world");
}

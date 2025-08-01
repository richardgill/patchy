import type { LocalContext } from "../../context";

type ApplyCommandFlags = Record<string, never>;

export default async function (
  this: LocalContext,
  _flags: ApplyCommandFlags,
): Promise<void> {
  console.log("applying..");
}

import type { ApplyCommandFlags } from "../../config/types";
import type { LocalContext } from "../../context";

export default async function (
  this: LocalContext,
  _flags: ApplyCommandFlags,
): Promise<void> {
  console.log("generate");
}

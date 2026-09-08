import { diffWords } from "diff";
import type { DiffPart } from "./types";

/** Word-level diff so small phrase changes are readable instead of whole-line replacements. */
export function computeDiff(original: string, revised: string): DiffPart[] {
  return diffWords(original, revised).map((part) => ({
    value: part.value,
    added: part.added,
    removed: part.removed,
  }));
}

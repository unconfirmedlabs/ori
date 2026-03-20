// Copyright (c) Unconfirmed Labs, LLC
// SPDX-License-Identifier: MIT

import type { WalrusData } from "./types";

/**
 * Parses on-chain WalrusData JSON into the typed WalrusData union.
 *
 * Handles multiple serialization formats:
 * - Enum with `@variant` tag: `{ "@variant": "Blob", pos0: "..." }`
 * - Positional tuple struct: `{ pos0: "...", pos1: 1, pos2: 0, pos3: 651 }`
 * - Already parsed: `{ type: "Blob", blobId: "..." }`
 */
export function parseWalrusData(d: Record<string, unknown>): WalrusData {
  if (!d) throw new Error("WalrusData is null");

  const variant = d["@variant"] as string | undefined;
  const type = d["type"] as string | undefined;

  // Already in parsed form
  if (type === "Blob" && typeof d["blobId"] === "string") return d as unknown as WalrusData;
  if (type === "QuiltPatch") return d as unknown as WalrusData;

  // Enum with @variant tag (GraphQL JSON format)
  if (variant === "Blob") return { type: "Blob", blobId: String(d["pos0"]) };
  if (variant === "QuiltPatch") {
    return {
      type: "QuiltPatch",
      quiltId: String(d["pos0"]),
      version: Number(d["pos1"]),
      startIndex: Number(d["pos2"]),
      endIndex: Number(d["pos3"]),
    };
  }

  // Positional without @variant: infer from field count
  if ("pos0" in d && "pos3" in d) {
    return {
      type: "QuiltPatch",
      quiltId: String(d["pos0"]),
      version: Number(d["pos1"]),
      startIndex: Number(d["pos2"]),
      endIndex: Number(d["pos3"]),
    };
  }
  if ("pos0" in d) return { type: "Blob", blobId: String(d["pos0"]) };

  throw new Error(`Unknown WalrusData format: ${JSON.stringify(d).slice(0, 200)}`);
}

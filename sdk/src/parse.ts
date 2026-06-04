// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

import type { Confidentiality, WalrusData } from "./types";

/**
 * Parses on-chain WalrusData JSON into the typed WalrusData union.
 *
 * Handles multiple serialization formats:
 * - Enum with `@variant` tag: `{ "@variant": "Blob", pos0: "...", pos1: {...} }`
 * - Positional tuple struct: `{ pos0: "...", pos1: 1, pos2: 0, pos3: 651 }`
 * - Already parsed: `{ type: "Blob", blobId: "..." }`
 *
 * A `Blob` carries a second field, its `Confidentiality` (unencrypted or
 * encrypted). It's parsed when present and omitted otherwise (⇒ unencrypted).
 */
export function parseWalrusData(d: Record<string, unknown>): WalrusData {
  if (!d) throw new Error("WalrusData is null");

  const variant = d["@variant"] as string | undefined;
  const type = d["type"] as string | undefined;

  // Already in parsed form
  if (type === "Blob" && typeof d["blobId"] === "string") return d as unknown as WalrusData;
  if (type === "QuiltPatch") return d as unknown as WalrusData;

  // Enum with @variant tag (GraphQL JSON format)
  if (variant === "Blob") return blob(d["pos0"], d["pos1"]);
  if (variant === "QuiltPatch") {
    return {
      type: "QuiltPatch",
      quiltId: String(d["pos0"]),
      version: Number(d["pos1"]),
      startIndex: Number(d["pos2"]),
      endIndex: Number(d["pos3"]),
    };
  }

  // Positional without @variant: infer from field count.
  // QuiltPatch has pos0..pos3; an (unencrypted) Blob has only pos0 (or pos0+pos1).
  if ("pos0" in d && "pos3" in d) {
    return {
      type: "QuiltPatch",
      quiltId: String(d["pos0"]),
      version: Number(d["pos1"]),
      startIndex: Number(d["pos2"]),
      endIndex: Number(d["pos3"]),
    };
  }
  if ("pos0" in d) return blob(d["pos0"], d["pos1"]);

  throw new Error(`Unknown WalrusData format: ${JSON.stringify(d).slice(0, 200)}`);
}

/** Builds a Blob, attaching confidentiality only when present. */
function blob(blobId: unknown, conf: unknown): WalrusData {
  const confidentiality = parseConfidentiality(conf);
  const out: WalrusData = { type: "Blob", blobId: String(blobId) };
  if (confidentiality) out.confidentiality = confidentiality;
  return out;
}

/** Parses a `Confidentiality` enum from on-chain JSON, or undefined if absent/unknown. */
function parseConfidentiality(c: unknown): Confidentiality | undefined {
  if (c == null || typeof c !== "object") return undefined;
  const d = c as Record<string, unknown>;
  const tag = (d["@variant"] ?? d["type"]) as string | undefined;

  if (tag === "Unencrypted") return { type: "Unencrypted" };
  if (tag === "Encrypted") {
    return {
      type: "Encrypted",
      dek: toHex(d["dek"]),
    };
  }
  return undefined;
}

/** Normalizes a Move `vector<u8>` (number[] or already-hex string) to a hex string. */
function toHex(v: unknown): string {
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map((b) => Number(b).toString(16).padStart(2, "0")).join("");
  return String(v);
}

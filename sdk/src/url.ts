// Copyright (c) Unconfirmed Labs, LLC
// SPDX-License-Identifier: MIT

import { blobIdToInt, blobIdFromInt } from "@mysten/walrus";
import type { WalrusData } from "./types.ts";

/**
 * Converts a u256 decimal string to a base64url-encoded blob ID.
 * Used to convert on-chain WalrusData blob IDs to Walrus aggregator format.
 */
export function u256ToB64Url(u256: string | bigint): string {
  const value = typeof u256 === "string" ? BigInt(u256) : u256;
  return blobIdFromInt(value);
}

/**
 * Converts a base64url-encoded blob ID to a u256 decimal string.
 * Used to convert Walrus blob IDs to on-chain WalrusData format.
 */
export function b64UrlToU256(blobId: string): string {
  return blobIdToInt(blobId).toString();
}

/**
 * Builds a 37-byte quilt patch ID and returns it as base64url.
 *
 * Layout: quilt_id (32 bytes LE) + version (1 byte) + start_index (2 bytes LE) + end_index (2 bytes LE).
 * All fields use little-endian (BCS encoding) to match Walrus SDK conventions.
 */
export function quiltPatchId(quiltId: string, version: number, startIndex: number, endIndex: number): string {
  // Decode the quilt ID base64url back to its raw 32 bytes
  const quiltIdB64 = u256ToB64Url(quiltId);
  let base64 = quiltIdB64.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) base64 += "=";
  const quiltIdBinary = atob(base64);

  const bytes = new Uint8Array(37);

  // quilt_id: 32 bytes (raw blob ID bytes from Walrus SDK)
  for (let i = 0; i < 32; i++) {
    bytes[i] = quiltIdBinary.charCodeAt(i);
  }

  // version: 1 byte
  bytes[32] = version;

  // start_index: 2 bytes little-endian (BCS u16)
  bytes[33] = startIndex & 0xff;
  bytes[34] = (startIndex >> 8) & 0xff;

  // end_index: 2 bytes little-endian (BCS u16)
  bytes[35] = endIndex & 0xff;
  bytes[36] = (endIndex >> 8) & 0xff;

  const result = btoa(String.fromCharCode(...bytes));
  return result.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Extract the blob ID from a Blob WalrusData. Throws if it's a QuiltPatch. */
export function assertBlobId(data: WalrusData): string {
  if (data.type !== "Blob") throw new Error("Expected Blob WalrusData, got " + data.type);
  return data.blobId;
}

/**
 * Returns the Walrus aggregator URL for any WalrusData variant.
 *
 * - Blob: `{aggregatorUrl}/v1/blobs/{base64url blob ID}`
 * - QuiltPatch: `{aggregatorUrl}/v1/blobs/by-quilt-patch-id/{base64url patch ID}`
 */
export function walrusDataUrl(aggregatorUrl: string, data: WalrusData): string {
  switch (data.type) {
    case "Blob":
      return `${aggregatorUrl}/v1/blobs/${u256ToB64Url(data.blobId)}`;
    case "QuiltPatch":
      return `${aggregatorUrl}/v1/blobs/by-quilt-patch-id/${quiltPatchId(data.quiltId, data.version, data.startIndex, data.endIndex)}`;
  }
}

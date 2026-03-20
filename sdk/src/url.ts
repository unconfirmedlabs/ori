// Copyright (c) Unconfirmed Labs, LLC
// SPDX-License-Identifier: MIT

import { bcs } from "@mysten/sui/bcs";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import type { WalrusData } from "./types";

const u256 = bcs.u256();

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/=*$/, "").replaceAll("+", "-").replaceAll("/", "_");
}

function fromBase64Url(str: string): Uint8Array {
  let b64 = str.replaceAll("-", "+").replaceAll("_", "/");
  while (b64.length % 4) b64 += "=";
  return fromBase64(b64);
}

/**
 * Converts a u256 decimal string to a base64url-encoded blob ID.
 * Used to convert on-chain WalrusData blob IDs to Walrus aggregator format.
 */
export function u256ToB64Url(u256Value: string | bigint): string {
  const value = typeof u256Value === "string" ? BigInt(u256Value) : u256Value;
  return toBase64Url(u256.serialize(value).toBytes());
}

/**
 * Converts a base64url-encoded blob ID to a u256 decimal string.
 * Used to convert Walrus blob IDs to on-chain WalrusData format.
 */
export function b64UrlToU256(blobId: string): string {
  const bytes = fromBase64Url(blobId);
  return u256.parse(bytes).toString();
}

/**
 * Builds a 37-byte quilt patch ID and returns it as base64url.
 *
 * Layout: quilt_id (32 bytes LE) + version (1 byte) + start_index (2 bytes LE) + end_index (2 bytes LE).
 * All fields use little-endian (BCS encoding) to match Walrus SDK conventions.
 */
export function quiltPatchId(quiltId: string, version: number, startIndex: number, endIndex: number): string {
  const quiltIdBytes = u256.serialize(BigInt(quiltId)).toBytes();

  const bytes = new Uint8Array(37);
  bytes.set(quiltIdBytes, 0);
  bytes[32] = version;
  bytes[33] = startIndex & 0xff;
  bytes[34] = (startIndex >> 8) & 0xff;
  bytes[35] = endIndex & 0xff;
  bytes[36] = (endIndex >> 8) & 0xff;

  return toBase64Url(bytes);
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

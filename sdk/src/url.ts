// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

import { bcs } from "@mysten/sui/bcs";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import type { WalrusBlob, WalrusQuilt, WalrusQuiltPatch } from "./types.js";

const u256 = bcs.u256();

/** Convert a u256 decimal value to its canonical, unpadded base64url Walrus ID. */
export function u256ToB64Url(value: string | bigint): string {
  return toBase64Url(u256.serialize(parseU256(value)).toBytes());
}

/** Convert a canonical Walrus blob ID to its decimal u256 representation. */
export function b64UrlToU256(blobId: string): string {
  const bytes = fromBase64Url(blobId, "blob ID");
  if (bytes.length !== 32) throw new Error("Walrus blob ID must decode to exactly 32 bytes");
  return u256.parse(bytes).toString();
}

/** Encode opaque Walrus quilt patch ID bytes as canonical unpadded base64url. */
export function quiltPatchIdFromBytes(bytes: Uint8Array): string {
  if (!(bytes instanceof Uint8Array) || bytes.length === 0) {
    throw new Error("Walrus quilt patch ID bytes must not be empty");
  }
  return toBase64Url(bytes);
}

/** Decode a canonical unpadded base64url quilt patch ID into its opaque raw bytes. */
export function quiltPatchIdToBytes(quiltPatchId: string): Uint8Array {
  return fromBase64Url(quiltPatchId, "quilt patch ID");
}

/** Build the aggregator URL for a standalone blob. */
export function walrusBlobUrl(aggregatorUrl: string, blob: WalrusBlob): string {
  return `${aggregator(aggregatorUrl)}/v1/blobs/${u256ToB64Url(blob.blobId)}`;
}

/** Build the aggregator URL for a quilt patch. */
export function walrusQuiltPatchUrl(aggregatorUrl: string, patch: WalrusQuiltPatch): string {
  const patchId = quiltPatchIdFromBytes(quiltPatchIdToBytes(patch.quiltPatchId));
  return `${aggregator(aggregatorUrl)}/v1/blobs/by-quilt-patch-id/${patchId}`;
}

/** Build the aggregator URL for one quilt item addressed by its identifier. */
export function walrusQuiltItemUrl(
  aggregatorUrl: string,
  quilt: WalrusQuilt,
  identifier: string,
): string {
  if (identifier.length === 0) throw new Error("Quilt item identifier must not be empty");
  const quiltId = u256ToB64Url(quilt.quiltId);
  return `${aggregator(aggregatorUrl)}/v1/blobs/by-quilt-id/${quiltId}/${encodeURIComponent(identifier)}`;
}

function aggregator(value: string): string {
  const normalized = value.replace(/\/+$/, "");
  if (normalized.length === 0) throw new Error("Aggregator URL must not be empty");
  return normalized;
}

function parseU256(value: string | bigint): bigint {
  if (typeof value === "string" && !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error("u256 value must be a canonical decimal string");
  }
  const parsed = typeof value === "string" ? BigInt(value) : value;
  if (parsed < 0n || parsed >= 2n ** 256n) throw new Error("u256 value is out of range");
  return parsed;
}

function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/=*$/, "").replaceAll("+", "-").replaceAll("/", "_");
}

function fromBase64Url(value: string, label: string): Uint8Array {
  if (typeof value !== "string" || value.length === 0 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`Walrus ${label} must be non-empty unpadded base64url`);
  }
  let base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  while (base64.length % 4 !== 0) base64 += "=";
  const bytes = fromBase64(base64);
  if (toBase64Url(bytes) !== value) throw new Error(`Walrus ${label} is not canonical base64url`);
  return bytes;
}

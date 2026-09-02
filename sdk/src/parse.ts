// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

import { quiltPatchIdFromBytes, quiltPatchIdToBytes } from "./url.js";
import type {
  WalrusBlob,
  Confidentiality,
  WalrusQuilt,
  WalrusQuiltPatch,
} from "./types.js";

type UnknownRecord = Record<string, unknown>;

/** Parse `ori::confidentiality::Confidentiality` Move JSON or normalized camelCase JSON. */
export function parseConfidentiality(value: unknown): Confidentiality {
  const input = record(value, "ori::confidentiality::Confidentiality");

  if (hasExactKeys(input, ["@variant"]) && input["@variant"] === "Unencrypted") {
    return { type: "Unencrypted" };
  }
  if (hasExactKeys(input, ["type"]) && input["type"] === "Unencrypted") {
    return { type: "Unencrypted" };
  }
  if (hasExactKeys(input, ["@variant", "sealed_dek"]) && input["@variant"] === "Encrypted") {
    return {
      type: "Encrypted",
      sealedDek: bytesToHex(parseBytes(input["sealed_dek"], "sealed DEK")),
    };
  }
  if (hasExactKeys(input, ["type", "sealedDek"]) && input["type"] === "Encrypted") {
    return {
      type: "Encrypted",
      sealedDek: bytesToHex(parseBytes(input["sealedDek"], "sealed DEK")),
    };
  }

  throw new Error("Invalid Confidentiality");
}

/** Parse `{ blob_id, confidentiality }` Move JSON or normalized camelCase JSON. */
export function parseWalrusBlob(value: unknown): WalrusBlob {
  const input = record(value, "WalrusBlob");
  if (hasExactKeys(input, ["blob_id", "confidentiality"])) {
    return {
      blobId: parseU256(input["blob_id"], "blob_id"),
      confidentiality: parseConfidentiality(input["confidentiality"]),
    };
  }
  if (hasExactKeys(input, ["blobId", "confidentiality"])) {
    return {
      blobId: parseU256(input["blobId"], "blobId"),
      confidentiality: parseConfidentiality(input["confidentiality"]),
    };
  }
  throw new Error("Invalid WalrusBlob");
}

/** Parse `{ quilt_id }` Move JSON or normalized camelCase JSON. */
export function parseWalrusQuilt(value: unknown): WalrusQuilt {
  const input = record(value, "WalrusQuilt");
  if (hasExactKeys(input, ["quilt_id"])) {
    return { quiltId: parseU256(input["quilt_id"], "quilt_id") };
  }
  if (hasExactKeys(input, ["quiltId"])) {
    return { quiltId: parseU256(input["quiltId"], "quiltId") };
  }
  throw new Error("Invalid WalrusQuilt");
}

/** Parse `{ quilt_patch_id, confidentiality }` Move JSON or normalized camelCase JSON. */
export function parseWalrusQuiltPatch(value: unknown): WalrusQuiltPatch {
  const input = record(value, "WalrusQuiltPatch");
  if (hasExactKeys(input, ["quilt_patch_id", "confidentiality"])) {
    return {
      quiltPatchId: parsePatchId(input["quilt_patch_id"]),
      confidentiality: parseConfidentiality(input["confidentiality"]),
    };
  }
  if (hasExactKeys(input, ["quiltPatchId", "confidentiality"])) {
    return {
      quiltPatchId: parseNormalizedPatchId(input["quiltPatchId"]),
      confidentiality: parseConfidentiality(input["confidentiality"]),
    };
  }
  throw new Error("Invalid WalrusQuiltPatch");
}

function parsePatchId(value: unknown): string {
  const bytes = parseBytes(value, "quilt patch ID");
  return quiltPatchIdFromBytes(bytes);
}

function parseNormalizedPatchId(value: unknown): string {
  if (typeof value !== "string") throw new Error("quiltPatchId must be an unpadded base64url string");
  return quiltPatchIdFromBytes(quiltPatchIdToBytes(value));
}

function bytesToHex(bytes: Uint8Array): string {
  if (bytes.length === 0) throw new Error("sealed DEK must not be empty");
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function parseBytes(value: unknown, label: string): Uint8Array {
  if (value instanceof Uint8Array) return new Uint8Array(value);

  if (Array.isArray(value)) {
    const result = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index += 1) {
      const byte = value[index];
      if (!Number.isInteger(byte) || (byte as number) < 0 || (byte as number) > 0xff) {
        throw new Error(`${label} must contain only u8 values`);
      }
      result[index] = byte as number;
    }
    return result;
  }

  if (typeof value === "string") {
    const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
    if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
      throw new Error(`${label} must be an even-length hex string`);
    }
    return Uint8Array.from(hex.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
  }

  throw new Error(`${label} must be a byte array, Uint8Array, or hex string`);
}

function parseU256(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throw new Error(`${label} must be a canonical decimal u256 string`);
  }
  if (BigInt(value) >= 2n ** 256n) throw new Error(`${label} is greater than u256::MAX`);
  return value;
}

function record(value: unknown, label: string): UnknownRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as UnknownRecord;
}

function hasExactKeys(input: UnknownRecord, expected: string[]): boolean {
  const actual = Object.keys(input).sort();
  const sortedExpected = [...expected].sort();
  return (
    actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index])
  );
}

import { describe, expect, test } from "bun:test";
import { blobIdFromInt, blobIdToInt } from "@mysten/walrus";
import {
  b64UrlToU256,
  parseWalrusBlob,
  parseWalrusConfidentiality,
  parseWalrusQuilt,
  parseWalrusQuiltPatch,
  quiltPatchIdFromBytes,
  quiltPatchIdToBytes,
  u256ToB64Url,
  walrusBlobUrl,
  walrusQuiltItemUrl,
  walrusQuiltPatchUrl,
} from "./index.js";
import type {
  WalrusBlob,
  WalrusConfidentiality,
  WalrusQuilt,
  WalrusQuiltPatch,
} from "./index.js";

const REAL_BLOB_ID = "A9ce7uz-A9CFTsrVv6qK_DROz6glfGlXK7xdgHirKgo";
const REAL_QUILT_ID = "QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2E";
const REAL_PATCH_ID = "QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2EBAQACAA";
const REAL_BLOB_U256 = blobIdToInt(REAL_BLOB_ID).toString();
const REAL_QUILT_U256 = blobIdToInt(REAL_QUILT_ID).toString();
const UNENCRYPTED = { type: "Unencrypted" } satisfies WalrusConfidentiality;

describe("public types", () => {
  test("represent only the three concrete Walrus reference kinds", () => {
    const blob = { blobId: REAL_BLOB_U256, confidentiality: UNENCRYPTED } satisfies WalrusBlob;
    const quilt = { quiltId: REAL_QUILT_U256 } satisfies WalrusQuilt;
    const patch = { quiltPatchId: REAL_PATCH_ID, confidentiality: UNENCRYPTED } satisfies WalrusQuiltPatch;
    expect({ blob, quilt, patch }).toEqual({
      blob: { blobId: REAL_BLOB_U256, confidentiality: UNENCRYPTED },
      quilt: { quiltId: REAL_QUILT_U256 },
      patch: { quiltPatchId: REAL_PATCH_ID, confidentiality: UNENCRYPTED },
    });
  });
});

describe("u256 and Walrus blob IDs", () => {
  test.each(["0", "42", "123456789012345678901234567890", (2n ** 256n - 1n).toString()])(
    "roundtrips %s",
    (value) => expect(b64UrlToU256(u256ToB64Url(value))).toBe(value),
  );

  test("accepts bigint and matches @mysten/walrus", () => {
    const value = 100823958982459129214775293723226273787816046204392402565982341370597827029082n;
    expect(u256ToB64Url(value)).toBe(blobIdFromInt(value));
    expect(b64UrlToU256(blobIdFromInt(value))).toBe(value.toString());
  });

  test("roundtrips a known Walrus blob ID", () => {
    expect(u256ToB64Url(b64UrlToU256(REAL_BLOB_ID))).toBe(REAL_BLOB_ID);
  });

  test.each(["", "01", "-1", "+1", "1.0", "nope"])("rejects malformed decimal u256 %p", (value) => {
    expect(() => u256ToB64Url(value)).toThrow();
  });

  test("rejects values outside u256", () => {
    expect(() => u256ToB64Url(2n ** 256n)).toThrow("out of range");
    expect(() => u256ToB64Url(-1n)).toThrow("out of range");
  });

  test.each(["", "AA==", "not+a/blob", "AA", REAL_BLOB_ID.slice(0, -1)])(
    "rejects malformed blob ID %p",
    (value) => expect(() => b64UrlToU256(value)).toThrow(),
  );
});

describe("quilt patch ID encoding", () => {
  test("roundtrips a known Walrus patch ID", () => {
    const bytes = quiltPatchIdToBytes(REAL_PATCH_ID);
    expect(bytes).toHaveLength(37);
    expect(quiltPatchIdFromBytes(bytes)).toBe(REAL_PATCH_ID);
    expect(Array.from(bytes.slice(0, 32))).toEqual(Array.from(quiltPatchIdToBytes(REAL_PATCH_ID).slice(0, 32)));
  });

  test("known patch embeds the known quilt ID and patch coordinates", () => {
    const bytes = quiltPatchIdToBytes(REAL_PATCH_ID);
    expect(u256ToB64Url(REAL_QUILT_U256)).toBe(REAL_QUILT_ID);
    expect(bytes[32]).toBe(1);
    expect(bytes[33]).toBe(1);
    expect(bytes[34]).toBe(0);
    expect(bytes[35]).toBe(2);
    expect(bytes[36]).toBe(0);
  });

  test("roundtrips opaque IDs without interpreting their layout", () => {
    const opaque = new Uint8Array([0xff, 0, 0x42, 0x80, 1]);
    expect(quiltPatchIdToBytes(quiltPatchIdFromBytes(opaque))).toEqual(opaque);
  });

  test("rejects an empty raw ID", () => {
    expect(() => quiltPatchIdFromBytes(new Uint8Array())).toThrow("must not be empty");
  });

  test.each(["", REAL_PATCH_ID + "=", "A", "not+a/patch"])(
    "rejects malformed patch ID %p",
    (value) => expect(() => quiltPatchIdToBytes(value)).toThrow(),
  );
});

describe("parseWalrusConfidentiality", () => {
  test("parses named Move JSON and normalized variants", () => {
    expect(parseWalrusConfidentiality({ "@variant": "Unencrypted" })).toEqual(UNENCRYPTED);
    expect(parseWalrusConfidentiality({ type: "Unencrypted" })).toEqual(UNENCRYPTED);
    expect(parseWalrusConfidentiality({ "@variant": "Encrypted", dek: [0, 0xab, 0xff] })).toEqual({
      type: "Encrypted",
      dek: "00abff",
    });
    expect(parseWalrusConfidentiality({ type: "Encrypted", dek: "0X00ABFF" })).toEqual({
      type: "Encrypted",
      dek: "00abff",
    });
    expect(parseWalrusConfidentiality({ type: "Encrypted", dek: new Uint8Array([1, 2]) })).toEqual({
      type: "Encrypted",
      dek: "0102",
    });
  });

  test.each([
    null,
    {},
    { "@variant": "Unknown" },
    { type: "Encrypted" },
    { type: "Encrypted", dek: "" },
    { type: "Encrypted", dek: "0x" },
    { type: "Encrypted", dek: "abc" },
    { type: "Encrypted", dek: "zz" },
    { type: "Encrypted", dek: [-1] },
    { type: "Encrypted", dek: [256] },
    { type: "Encrypted", dek: new Array(1) },
    { type: "Unencrypted", dek: "01" },
    { type: "Unencrypted", extra: true },
    { "@variant": "Unencrypted", type: "Unencrypted" },
  ])("strictly rejects invalid confidentiality %#", (value) => {
    expect(() => parseWalrusConfidentiality(value)).toThrow();
  });
});

describe("parseWalrusBlob", () => {
  test("parses named Move JSON and normalized camelCase", () => {
    expect(
      parseWalrusBlob({
        blob_id: REAL_BLOB_U256,
        confidentiality: { "@variant": "Encrypted", dek: [0xde, 0xad] },
      }),
    ).toEqual({ blobId: REAL_BLOB_U256, confidentiality: { type: "Encrypted", dek: "dead" } });
    expect(parseWalrusBlob({ blobId: "42", confidentiality: UNENCRYPTED })).toEqual({
      blobId: "42",
      confidentiality: UNENCRYPTED,
    });
  });

  test.each([
    null,
    {},
    { blob_id: "42" },
    { blobId: "42" },
    { blob_id: "42", confidentiality: null },
    { blob_id: 42, confidentiality: { "@variant": "Unencrypted" } },
    { blob_id: "042", confidentiality: { "@variant": "Unencrypted" } },
    { blob_id: (2n ** 256n).toString(), confidentiality: { "@variant": "Unencrypted" } },
    { pos0: "42", pos1: { "@variant": "Unencrypted" } },
    { blob_id: "42", confidentiality: { "@variant": "Unencrypted" }, extra: true },
    { blob_id: "42", blobId: "42", confidentiality: { "@variant": "Unencrypted" } },
  ])("strictly rejects invalid blob %#", (value) => {
    expect(() => parseWalrusBlob(value)).toThrow();
  });
});

describe("parseWalrusQuilt", () => {
  test("parses named Move JSON and normalized camelCase", () => {
    expect(parseWalrusQuilt({ quilt_id: REAL_QUILT_U256 })).toEqual({ quiltId: REAL_QUILT_U256 });
    expect(parseWalrusQuilt({ quiltId: "42" })).toEqual({ quiltId: "42" });
  });

  test.each([
    null,
    {},
    { quilt_id: 42 },
    { quilt_id: "01" },
    { quilt_id: "42", confidentiality: UNENCRYPTED },
    { quiltId: "42", extra: true },
    { pos0: "42" },
  ])("strictly rejects invalid quilt %#", (value) => {
    expect(() => parseWalrusQuilt(value)).toThrow();
  });
});

describe("parseWalrusQuiltPatch", () => {
  const raw = quiltPatchIdToBytes(REAL_PATCH_ID);
  const hex = Array.from(raw, (byte) => byte.toString(16).padStart(2, "0")).join("");

  test("normalizes named Move byte representations to base64url", () => {
    for (const quilt_patch_id of [Array.from(raw), raw, `0x${hex.toUpperCase()}`]) {
      expect(
        parseWalrusQuiltPatch({
          quilt_patch_id,
          confidentiality: { "@variant": "Unencrypted" },
        }),
      ).toEqual({ quiltPatchId: REAL_PATCH_ID, confidentiality: UNENCRYPTED });
    }
  });

  test("accepts an already-normalized camelCase value", () => {
    expect(
      parseWalrusQuiltPatch({
        quiltPatchId: REAL_PATCH_ID,
        confidentiality: { type: "Encrypted", dek: "ABCD" },
      }),
    ).toEqual({
      quiltPatchId: REAL_PATCH_ID,
      confidentiality: { type: "Encrypted", dek: "abcd" },
    });
  });

  test.each([
    null,
    {},
    { quilt_patch_id: Array.from(raw) },
    { quiltPatchId: REAL_PATCH_ID },
    { quilt_patch_id: [], confidentiality: { "@variant": "Unencrypted" } },
    { quilt_patch_id: [256], confidentiality: { "@variant": "Unencrypted" } },
    { quilt_patch_id: "abc", confidentiality: { "@variant": "Unencrypted" } },
    { quiltPatchId: REAL_PATCH_ID + "=", confidentiality: UNENCRYPTED },
    { quilt_patch_id: Array.from(raw), confidentiality: UNENCRYPTED, extra: true },
    { pos0: Array.from(raw), pos1: { "@variant": "Unencrypted" } },
  ])("strictly rejects invalid patch %#", (value) => {
    expect(() => parseWalrusQuiltPatch(value)).toThrow();
  });
});

describe("aggregator URLs", () => {
  const aggregator = "https://aggregator.example.com";
  const blob = { blobId: REAL_BLOB_U256, confidentiality: UNENCRYPTED } satisfies WalrusBlob;
  const quilt = { quiltId: REAL_QUILT_U256 } satisfies WalrusQuilt;
  const patch = { quiltPatchId: REAL_PATCH_ID, confidentiality: UNENCRYPTED } satisfies WalrusQuiltPatch;

  test("builds all three supported read endpoints", () => {
    expect(walrusBlobUrl(aggregator, blob)).toBe(`${aggregator}/v1/blobs/${REAL_BLOB_ID}`);
    expect(walrusQuiltPatchUrl(aggregator, patch)).toBe(
      `${aggregator}/v1/blobs/by-quilt-patch-id/${REAL_PATCH_ID}`,
    );
    expect(walrusQuiltItemUrl(aggregator, quilt, "cover.png")).toBe(
      `${aggregator}/v1/blobs/by-quilt-id/${REAL_QUILT_ID}/cover.png`,
    );
  });

  test("removes any aggregator trailing slashes", () => {
    expect(walrusBlobUrl(`${aggregator}///`, blob)).toBe(`${aggregator}/v1/blobs/${REAL_BLOB_ID}`);
  });

  test("encodes the identifier as exactly one path segment", () => {
    expect(walrusQuiltItemUrl(aggregator, quilt, "folder/a b?#%.wav")).toBe(
      `${aggregator}/v1/blobs/by-quilt-id/${REAL_QUILT_ID}/folder%2Fa%20b%3F%23%25.wav`,
    );
  });

  test("rejects empty aggregator URLs and identifiers", () => {
    expect(() => walrusBlobUrl("/", blob)).toThrow("Aggregator URL");
    expect(() => walrusQuiltItemUrl(aggregator, quilt, "")).toThrow("identifier");
  });
});

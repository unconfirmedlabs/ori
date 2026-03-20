import { test, expect, describe } from "bun:test";
import { u256ToB64Url, b64UrlToU256, quiltPatchId, walrusDataUrl, assertBlobId, parseWalrusData } from "./index.ts";
import { blobIdToInt, blobIdFromInt } from "@mysten/walrus";
import type { WalrusData } from "./index.ts";
import { fromBase64 } from "@mysten/sui/utils";

// ---------------------------------------------------------------------------
// u256ToB64Url / b64UrlToU256 roundtrip
// ---------------------------------------------------------------------------

describe("u256ToB64Url / b64UrlToU256", () => {
  test("roundtrip zero", () => {
    const encoded = u256ToB64Url("0");
    expect(b64UrlToU256(encoded)).toBe("0");
  });

  test("roundtrip known value", () => {
    const value = "123456789012345678901234567890";
    const encoded = u256ToB64Url(value);
    expect(b64UrlToU256(encoded)).toBe(value);
  });

  test("roundtrip max u256", () => {
    const maxU256 = (2n ** 256n - 1n).toString();
    const encoded = u256ToB64Url(maxU256);
    expect(b64UrlToU256(encoded)).toBe(maxU256);
  });

  test("accepts bigint input", () => {
    const encoded = u256ToB64Url(42n);
    expect(b64UrlToU256(encoded)).toBe("42");
  });

  test("output is base64url (no +, /, or =)", () => {
    const encoded = u256ToB64Url((2n ** 256n - 1n).toString());
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  test("matches @mysten/walrus blobIdFromInt", () => {
    const value = 100823958982459129214775293723226273787816046204392402565982341370597827029082n;
    expect(u256ToB64Url(value)).toBe(blobIdFromInt(value));
  });

  test("matches @mysten/walrus blobIdToInt", () => {
    const blobId = "Wij2hvmUIKmYj4cqshL27GYjY8C6dEKlOtml8adW6N4";
    expect(b64UrlToU256(blobId)).toBe(blobIdToInt(blobId).toString());
  });
});

// ---------------------------------------------------------------------------
// quiltPatchId
// ---------------------------------------------------------------------------

function decodeB64Url(str: string): Uint8Array {
  let b64 = str.replaceAll("-", "+").replaceAll("_", "/");
  while (b64.length % 4) b64 += "=";
  return fromBase64(b64);
}

describe("quiltPatchId", () => {
  test("produces 37 bytes base64url encoded", () => {
    const id = quiltPatchId("0", 0, 0, 0);
    const decoded = decodeB64Url(id);
    expect(decoded.length).toBe(37);
  });

  test("quilt_id bytes match blobIdFromInt output", () => {
    const quiltU256 = "100823958982459129214775293723226273787816046204392402565982341370597827029082";
    const id = quiltPatchId(quiltU256, 1, 1, 605);
    const raw = decodeB64Url(id);

    const expectedB64 = blobIdFromInt(BigInt(quiltU256));
    const expectedBytes = decodeB64Url(expectedB64);

    expect(raw.slice(0, 32)).toEqual(expectedBytes);
  });

  test("version is a single byte at offset 32", () => {
    const id = quiltPatchId("0", 42, 0, 0);
    const raw = decodeB64Url(id);
    expect(raw[32]).toBe(42);
  });

  test("start_index is little-endian u16 at offset 33", () => {
    const id = quiltPatchId("0", 0, 258, 0);
    const raw = decodeB64Url(id);
    expect(raw[33]).toBe(2);
    expect(raw[34]).toBe(1);
  });

  test("end_index is little-endian u16 at offset 35", () => {
    const id = quiltPatchId("0", 0, 0, 513);
    const raw = decodeB64Url(id);
    expect(raw[35]).toBe(1);
    expect(raw[36]).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// walrusDataUrl
// ---------------------------------------------------------------------------

describe("walrusDataUrl", () => {
  const agg = "https://aggregator.example.com";

  test("Blob variant", () => {
    const data: WalrusData = { type: "Blob", blobId: "42" };
    const url = walrusDataUrl(agg, data);
    expect(url).toBe(`${agg}/v1/blobs/${u256ToB64Url("42")}`);
  });

  test("QuiltPatch variant", () => {
    const data: WalrusData = { type: "QuiltPatch", quiltId: "100", version: 1, startIndex: 0, endIndex: 5 };
    const url = walrusDataUrl(agg, data);
    const expectedPatchId = quiltPatchId("100", 1, 0, 5);
    expect(url).toBe(`${agg}/v1/blobs/by-quilt-patch-id/${expectedPatchId}`);
  });
});

// ---------------------------------------------------------------------------
// assertBlobId
// ---------------------------------------------------------------------------

describe("assertBlobId", () => {
  test("returns blobId for Blob variant", () => {
    expect(assertBlobId({ type: "Blob", blobId: "123" })).toBe("123");
  });

  test("throws for QuiltPatch variant", () => {
    expect(() =>
      assertBlobId({ type: "QuiltPatch", quiltId: "1", version: 0, startIndex: 0, endIndex: 1 }),
    ).toThrow("Expected Blob");
  });
});

// ---------------------------------------------------------------------------
// parseWalrusData
// ---------------------------------------------------------------------------

describe("parseWalrusData", () => {
  test("parses Blob with @variant", () => {
    const result = parseWalrusData({ "@variant": "Blob", pos0: "999" });
    expect(result).toEqual({ type: "Blob", blobId: "999" });
  });

  test("parses QuiltPatch with @variant", () => {
    const result = parseWalrusData({ "@variant": "QuiltPatch", pos0: "12345", pos1: 2, pos2: 10, pos3: 20 });
    expect(result).toEqual({ type: "QuiltPatch", quiltId: "12345", version: 2, startIndex: 10, endIndex: 20 });
  });

  test("parses positional Blob (no @variant)", () => {
    const result = parseWalrusData({ pos0: "42" });
    expect(result).toEqual({ type: "Blob", blobId: "42" });
  });

  test("parses positional QuiltPatch (no @variant)", () => {
    const result = parseWalrusData({ pos0: "100", pos1: 1, pos2: 0, pos3: 5 });
    expect(result).toEqual({ type: "QuiltPatch", quiltId: "100", version: 1, startIndex: 0, endIndex: 5 });
  });

  test("passes through already-parsed Blob", () => {
    const data = { type: "Blob", blobId: "123" };
    expect(parseWalrusData(data)).toEqual(data);
  });

  test("throws on null", () => {
    expect(() => parseWalrusData(null as any)).toThrow();
  });

  test("throws on unknown format", () => {
    expect(() => parseWalrusData({ foo: "bar" })).toThrow("Unknown WalrusData format");
  });
});

// ---------------------------------------------------------------------------
// Real Walrus data roundtrip (from `walrus store --dry-run` and `walrus store-quilt --dry-run`)
// ---------------------------------------------------------------------------

describe("real walrus data", () => {
  // From: walrus store --dry-run --epochs 1 (15 byte file)
  const realBlobId = "A9ce7uz-A9CFTsrVv6qK_DROz6glfGlXK7xdgHirKgo";

  test("blob ID roundtrips through u256", () => {
    const u256Value = b64UrlToU256(realBlobId);
    expect(u256ToB64Url(u256Value)).toBe(realBlobId);
  });

  test("walrusDataUrl produces correct blob URL", () => {
    const u256Value = b64UrlToU256(realBlobId);
    const data: WalrusData = { type: "Blob", blobId: u256Value };
    const url = walrusDataUrl("https://aggregator.walrus.site", data);
    expect(url).toBe(`https://aggregator.walrus.site/v1/blobs/${realBlobId}`);
  });

  // From: walrus store-quilt --dry-run --epochs 1 --paths p1.txt p2.txt
  // Quilt blob ID: QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2E
  // Patch 0: QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2EBAQACAA (sliver [1,2), id: quilt-p1.txt)
  // Patch 1: QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2EBAgADAA (sliver [2,3), id: quilt-p2.txt)
  const realQuiltBlobId = "QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2E";
  const realPatch0Id = "QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2EBAQACAA";
  const realPatch1Id = "QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2EBAgADAA";

  test("quiltPatchId matches real patch 0", () => {
    const quiltU256 = b64UrlToU256(realQuiltBlobId);
    // Patch 0: version=1, startIndex=1, endIndex=2
    const patchId = quiltPatchId(quiltU256, 1, 1, 2);
    expect(patchId).toBe(realPatch0Id);
  });

  test("quiltPatchId matches real patch 1", () => {
    const quiltU256 = b64UrlToU256(realQuiltBlobId);
    // Patch 1: version=1, startIndex=2, endIndex=3
    const patchId = quiltPatchId(quiltU256, 1, 2, 3);
    expect(patchId).toBe(realPatch1Id);
  });

  test("walrusDataUrl produces correct quilt patch URL", () => {
    const quiltU256 = b64UrlToU256(realQuiltBlobId);
    const data: WalrusData = { type: "QuiltPatch", quiltId: quiltU256, version: 1, startIndex: 1, endIndex: 2 };
    const url = walrusDataUrl("https://aggregator.walrus.site", data);
    expect(url).toBe(`https://aggregator.walrus.site/v1/blobs/by-quilt-patch-id/${realPatch0Id}`);
  });

  test("parseWalrusData handles QuiltPatch from on-chain format", () => {
    const quiltU256 = b64UrlToU256(realQuiltBlobId);
    // Simulating on-chain @variant JSON format
    const onChain = { "@variant": "QuiltPatch", pos0: quiltU256, pos1: 1, pos2: 1, pos3: 2 };
    const parsed = parseWalrusData(onChain);
    expect(parsed.type).toBe("QuiltPatch");
    if (parsed.type === "QuiltPatch") {
      const url = walrusDataUrl("https://aggregator.walrus.site", parsed);
      expect(url).toContain(realPatch0Id);
    }
  });
});

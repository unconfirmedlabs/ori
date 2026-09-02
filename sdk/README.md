# @unconfirmed/ori

TypeScript types, strict parsers, and Walrus aggregator URL helpers for the [Ori](https://github.com/unconfirmedlabs/ori) Move package.

## Install

```sh
npm install @unconfirmed/ori @mysten/sui
```

`@mysten/sui` is a peer dependency.

## Concrete reference types

Ori models the three distinct Walrus concepts separately:

```ts
import type {
  WalrusBlob,
  WalrusConfidentiality,
  WalrusQuilt,
  WalrusQuiltPatch,
} from "@unconfirmed/ori";

const confidentiality: WalrusConfidentiality = { type: "Unencrypted" };

const blob: WalrusBlob = {
  blobId: "42", // decimal u256
  confidentiality,
};

const quilt: WalrusQuilt = {
  quiltId: "42", // decimal u256
};

const patch: WalrusQuiltPatch = {
  quiltPatchId: "QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2EBAQACAA",
  confidentiality,
};
```

Encrypted references carry a Seal-encrypted data-encryption key as normalized lowercase, unprefixed hex:

```ts
const encrypted: WalrusConfidentiality = {
  type: "Encrypted",
  dek: "deadbeef",
};
```

## Parse Move JSON

The parsers accept either named Move JSON fields or an already-normalized camelCase value:

```ts
import {
  parseWalrusBlob,
  parseWalrusConfidentiality,
  parseWalrusQuilt,
  parseWalrusQuiltPatch,
} from "@unconfirmed/ori";

const blob = parseWalrusBlob({
  blob_id: "42",
  confidentiality: { "@variant": "Unencrypted" },
});

const quilt = parseWalrusQuilt({ quilt_id: "42" });

const patch = parseWalrusQuiltPatch({
  quilt_patch_id: [0x51, 0x02, 0xff],
  confidentiality: { "@variant": "Encrypted", dek: "0xDEADBEEF" },
});
```

Parsers are intentionally strict. They reject positional fields, unknown fields, missing confidentiality, malformed IDs, invalid byte values, and empty encrypted DEKs. Raw Move `vector<u8>` values may be a `number[]`, `Uint8Array`, or even-length hex string. Patch IDs normalize to unpadded base64url; DEKs normalize to lowercase unprefixed hex.

## Build aggregator URLs

```ts
import {
  walrusBlobUrl,
  walrusQuiltItemUrl,
  walrusQuiltPatchUrl,
} from "@unconfirmed/ori";

walrusBlobUrl("https://aggregator.example.com/", blob);
// https://aggregator.example.com/v1/blobs/<BLOB_ID>

walrusQuiltPatchUrl("https://aggregator.example.com", patch);
// https://aggregator.example.com/v1/blobs/by-quilt-patch-id/<PATCH_ID>

walrusQuiltItemUrl("https://aggregator.example.com", quilt, "mixes/final.wav");
// https://aggregator.example.com/v1/blobs/by-quilt-id/<QUILT_ID>/mixes%2Ffinal.wav
```

Aggregator trailing slashes are normalized. Quilt item identifiers are encoded as exactly one URL path segment. See the official [Walrus quilt HTTP API](https://docs.wal.app/docs/http-api/quilt-http-apis) and [blob read API](https://docs.wal.app/docs/http-api/reading-blobs).

## ID conversion

```ts
import {
  b64UrlToU256,
  quiltPatchIdFromBytes,
  quiltPatchIdToBytes,
  u256ToB64Url,
} from "@unconfirmed/ori";

const blobId = u256ToB64Url("42");
const decimal = b64UrlToU256(blobId);

const patchId = quiltPatchIdFromBytes(rawPatchId);
const rawPatchIdAgain = quiltPatchIdToBytes(patchId);
```

## Breaking changes in 0.2.0

Version 0.2.0 removes the generic `WalrusData` union and its `parseWalrusData`, `walrusDataUrl`, and `assertBlobId` helpers. It also removes the decomposed `quiltPatchId(quiltId, version, startIndex, endIndex)` helper. Use the concrete reference type, parser, and URL helper appropriate to each field.

Confidentiality is now required on blobs and patches. A complete quilt has its own `WalrusQuilt` type and does not carry confidentiality.

## License

MIT

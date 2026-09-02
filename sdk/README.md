# @unconfirmed/ori

TypeScript types, strict parsers, and Walrus aggregator URL helpers for the [Ori](https://github.com/unconfirmedlabs/ori) Move package.

## Install

```sh
npm install @unconfirmed/ori @mysten/sui
```

`@mysten/sui` is a peer dependency.

## Immutable package IDs

```ts
import { ORI_PACKAGE_IDS, oriPackageId } from "@unconfirmed/ori";

const mainnetPackageId = ORI_PACKAGE_IDS.mainnet;
const testnetPackageId = oriPackageId("testnet");
```

The SDK embeds the immutable `ori::data` deployments:

| Network | Package ID |
| --- | --- |
| Mainnet | `0xe9b70375353ec0ed99e9ef2a4e51e70087db042ceba4631430cc2d7217b7fdcf` |
| Testnet | `0x3013ca910b7571a5d19b215cce1037ea0061ba844831ea7013ce1b37303ec0ca` |

## Concrete reference types

Ori models the three distinct Walrus concepts separately:

```ts
import type {
  Confidentiality,
  WalrusBlob,
  WalrusQuilt,
  WalrusQuiltPatch,
} from "@unconfirmed/ori";

const confidentiality: Confidentiality = { type: "Unencrypted" };

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
const encrypted: Confidentiality = {
  type: "Encrypted",
  sealedDek: "deadbeef",
};
```

## Parse Move JSON

The parsers accept either named Move JSON fields or an already-normalized camelCase value:

```ts
import {
  parseConfidentiality,
  parseWalrusBlob,
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
  confidentiality: { "@variant": "Encrypted", sealed_dek: "0xDEADBEEF" },
});
```

Parsers are intentionally strict. They reject positional fields, unknown fields, missing confidentiality, malformed IDs, invalid byte values, and empty sealed DEKs. Raw Move `vector<u8>` values may be a `number[]`, `Uint8Array`, or even-length hex string. Patch IDs normalize to unpadded base64url; sealed DEKs normalize to lowercase unprefixed hex.

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

## Breaking changes in 0.3.0

Version 0.3.0 follows the final immutable `ori::data` Move API and embeds its Mainnet and Testnet package IDs. `WalrusConfidentiality` is now `Confidentiality`, `parseWalrusConfidentiality` is now `parseConfidentiality`, and the encrypted field is now the explicit `sealedDek` (`sealed_dek` in Move JSON).

## Breaking changes in 0.2.0

Version 0.2.0 removes the generic `WalrusData` union and its `parseWalrusData`, `walrusDataUrl`, and `assertBlobId` helpers. It also removes the decomposed `quiltPatchId(quiltId, version, startIndex, endIndex)` helper. Use the concrete reference type, parser, and URL helper appropriate to each field.

Confidentiality is now required on blobs and patches. A complete quilt has its own `WalrusQuilt` type and does not carry confidentiality.

## License

MIT

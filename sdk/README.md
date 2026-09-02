# @unconfirmed/ori

TypeScript types, strict parsers, and Walrus aggregator URL helpers for the [Ori](https://github.com/unconfirmedlabs/ori) Move package.

> **0.4.0:** this release targets the immutable `ori::confidentiality` +
> `ori::data` packages published on Sui Mainnet and Testnet.

`ORI_DEPLOYMENTS` contains each package ID, publication transaction digest, and
the pinned audited package-artifact digest. `ORI_PACKAGE_IDS` is its complete
package-ID-only view. Release validation queries the fixed official Sui Mainnet and Testnet gRPC
endpoints, confirms each endpoint's chain identifier, verifies the exact public
and entry ABI, proves the transaction created that package from the pinned
bytecode and dependencies, and proves the same PTB consumed its `UpgradeCap`
with `0x2::package::make_immutable`.

## Types

The TypeScript representation composes the same confidentiality value into blobs and patches:

```ts
import type {
  Confidentiality,
  WalrusBlob,
  WalrusQuilt,
  WalrusQuiltPatch,
} from "@unconfirmed/ori";

const unencrypted: Confidentiality = { type: "Unencrypted" };
const encrypted: Confidentiality = {
  type: "Encrypted",
  sealedDek: "deadbeef",
};

const blob: WalrusBlob = {
  blobId: "42",
  confidentiality: unencrypted,
};

const quilt: WalrusQuilt = {
  quiltId: "42",
};

const patch: WalrusQuiltPatch = {
  quiltPatchId: "QDKNLeUeLquludWfLV-UywuEvbIr7bruPGz5n1ppz2EBAQACAA",
  confidentiality: encrypted,
};
```

`blobId` and `quiltId` are canonical decimal `u256` strings. `quiltPatchId` is canonical unpadded base64url. `sealedDek` is lowercase unprefixed hex containing the Seal-encrypted DEK, never the plaintext key.

## Parse Move JSON

```ts
import {
  parseConfidentiality,
  parseWalrusBlob,
  parseWalrusQuilt,
  parseWalrusQuiltPatch,
} from "@unconfirmed/ori";

const confidentiality = parseConfidentiality({
  "@variant": "Encrypted",
  sealed_dek: "0xDEADBEEF",
});

const blob = parseWalrusBlob({
  blob_id: "42",
  confidentiality: { "@variant": "Unencrypted" },
});

const quilt = parseWalrusQuilt({ quilt_id: "42" });

const patch = parseWalrusQuiltPatch({
  quilt_patch_id: [0x51, 0x02, 0xff],
  confidentiality: { "@variant": "Encrypted", sealed_dek: [0xde, 0xad] },
});
```

The parsers accept either named Move JSON fields or already-normalized camelCase values. They reject positional fields, unknown fields, missing confidentiality, malformed IDs, invalid bytes, and empty sealed DEKs. Raw Move `vector<u8>` values may be a `number[]`, `Uint8Array`, or even-length hex string.

## Aggregator URLs

```ts
import {
  walrusBlobUrl,
  walrusQuiltItemUrl,
  walrusQuiltPatchUrl,
} from "@unconfirmed/ori";

walrusBlobUrl("https://aggregator.example.com/", blob);
walrusQuiltPatchUrl("https://aggregator.example.com", patch);
walrusQuiltItemUrl("https://aggregator.example.com", quilt, "mixes/final.wav");
```

Aggregator trailing slashes are normalized. Quilt item identifiers are encoded as one URL path segment. See the official [Walrus quilt HTTP API](https://docs.wal.app/docs/http-api/quilt-http-apis) and [blob read API](https://docs.wal.app/docs/http-api/reading-blobs).

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

## Current deployments

```ts
import {
  AUDITED_ORI_PACKAGE_ARTIFACT_SHA256,
  ORI_DEPLOYMENTS,
  ORI_PACKAGE_IDS,
  oriPackageId,
} from "@unconfirmed/ori";

const mainnetPackage = oriPackageId("mainnet");
const testnetPublication = ORI_DEPLOYMENTS.testnet.publishTransactionDigest;
const allPackageIds = ORI_PACKAGE_IDS;
const auditedArtifact = AUDITED_ORI_PACKAGE_ARTIFACT_SHA256;
```

| Network | Package ID | Publication transaction |
| --- | --- | --- |
| Mainnet | `0xadefbe1aeb900807ed03144bddd80dc6478030c28ede3b2990f8e792606f317a` | `FA2s1EKiapuUfhSeaKYBTVEwdNABBk1w86bcn3YrXoc6` |
| Testnet | `0x51792b9adb9a5d05d7c4d74d7d0cb5aefc5639afa80c0089399cab8b99752e60` | `ErQxNA2coFkf8Fg9DtmGDU4GtCeb4Gs4GhPNchUjUyeY` |

Both publications report Sui package digest
`0x37b234b464fda663d771f14c992e8741fac0d7d29a060db9b75ac106fc166bc4`.
The independently pinned canonical artifact SHA-256 used by release validation
is `1915ee941fd1b1ae797f064c9fa0aee52b8014015c8542391176ce5071fbb51f`.

## Migrating to 0.4.0

- Use `oriPackageId(network)` or `ORI_PACKAGE_IDS` for current Move calls.
- Use `ORI_DEPLOYMENTS` when publication provenance is required.
- Import confidentiality constructors from `ori::confidentiality`; `WalrusBlob`
  and `WalrusQuiltPatch` constructors now accept a composed `Confidentiality`.
- Replace the old generic `WalrusData` representation with `WalrusBlob`,
  `WalrusQuilt`, or `WalrusQuiltPatch`.
- Do not use the `LEGACY_ORI_PACKAGE_IDS` with the 0.4 Move API.

## Legacy deployment metadata

The immutable pre-split package IDs remain available under explicitly legacy names:

```ts
import {
  LEGACY_ORI_PACKAGE_IDS,
  legacyOriPackageId,
} from "@unconfirmed/ori";

const oldMainnetPackage = LEGACY_ORI_PACKAGE_IDS.mainnet;
const oldTestnetPackage = legacyOriPackageId("testnet");

```

Do not use these IDs for calls to `ori::confidentiality`; that module is absent from those packages.

## Release verification

The pinned artifact SHA-256 is calculated over
`ori-sui-package-artifact-v1\0`, the ordered length-prefixed module bytecode,
and the ordered length-prefixed dependency IDs from
`sui move build --dump-bytecode-as-base64`.

Run `npm run validate:release` to check readiness. The same fail-closed check is
the first `prepublishOnly` step and runs explicitly in trusted CI immediately
before `npm publish`.

The validator cryptographically binds the configured deployment to the module
bytes and dependencies recorded in its successful on-chain publication PTB.
The remaining human audit boundary is the act of approving the pinned digest as
the intended output of the reviewed Move source; trusted npm CI does not install
the Sui compiler or independently reproduce that build.

## License

MIT

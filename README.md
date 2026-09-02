# ori

A Sui Move library for embedding concrete references to data stored on [Walrus](https://docs.wal.app/).

## Overview

Ori keeps storage references and confidentiality metadata orthogonal:

- `ori::confidentiality::Confidentiality` describes whether referenced bytes are unencrypted or encrypted with a non-empty Seal-sealed DEK.
- `ori::data::WalrusBlob` references a standalone blob and contains a composed `Confidentiality`.
- `ori::data::WalrusQuilt` references a complete quilt and is intentionally non-confidential.
- `ori::data::WalrusQuiltPatch` references one patch and contains a composed `Confidentiality`.

This avoids constructors for every storage-kind/confidentiality combination. Callers build confidentiality once, then compose it into a blob or patch. All four types have `copy`, `drop`, and `store` abilities.

See the official Walrus [quilt overview](https://docs.wal.app/docs/system-overview/quilt) and [quilt HTTP API](https://docs.wal.app/docs/http-api/quilt-http-apis).

> **Deployment status:** the module-split API is live as immutable packages on
> Sui Mainnet and Testnet. Each publication consumed its `UpgradeCap` with
> `0x2::package::make_immutable` in the same PTB.

The active [`move/Published.toml`](move/Published.toml) contains only these
current deployments. Historical metadata is archived in
[`move/legacy/README.md`](move/legacy/README.md).

| Network | Package ID | Publication transaction |
| --- | --- | --- |
| Mainnet | `0xadefbe1aeb900807ed03144bddd80dc6478030c28ede3b2990f8e792606f317a` | `FA2s1EKiapuUfhSeaKYBTVEwdNABBk1w86bcn3YrXoc6` |
| Testnet | `0x51792b9adb9a5d05d7c4d74d7d0cb5aefc5639afa80c0089399cab8b99752e60` | `ErQxNA2coFkf8Fg9DtmGDU4GtCeb4Gs4GhPNchUjUyeY` |

Both have Sui package digest
`0x37b234b464fda663d771f14c992e8741fac0d7d29a060db9b75ac106fc166bc4`.

## Usage

```move
use ori::{confidentiality, data};

let unencrypted = confidentiality::new_unencrypted();
let blob = data::new_blob(blob_id, unencrypted);

let encrypted = confidentiality::new_encrypted(sealed_dek);
let encrypted_patch = data::new_quilt_patch(quilt_patch_id, encrypted);

// A complete quilt has no confidentiality field.
let quilt = data::new_quilt(quilt_id);
```

The constructors return values rather than transferring them, so applications can compose them directly:

```move
public struct Release has store {
    master: data::WalrusBlob,
    stems: data::WalrusQuilt,
    cover: data::WalrusQuiltPatch,
}
```

### Reading fields

```move
let blob_id: u256 = blob.blob_id();
let quilt_id: u256 = quilt.quilt_id();
let patch_id: &vector<u8> = encrypted_patch.quilt_patch_id();

let confidentiality = encrypted_patch.quilt_patch_confidentiality();
if (confidentiality.is_encrypted()) {
    let sealed_dek: &vector<u8> = confidentiality.sealed_dek();
};
```

`confidentiality::new_encrypted` rejects an empty sealed DEK. `sealed_dek` aborts on `Unencrypted`. `data::new_quilt_patch` rejects an empty patch ID.

## Move API

### `ori::confidentiality`

| Function | Signature | Description |
| --- | --- | --- |
| `new_unencrypted` | `(): Confidentiality` | Create unencrypted metadata |
| `new_encrypted` | `(vector<u8>): Confidentiality` | Create encrypted metadata with a non-empty Seal-sealed DEK |
| `is_encrypted` | `(&Confidentiality): bool` | Test whether data is encrypted |
| `sealed_dek` | `(&Confidentiality): &vector<u8>` | Return the sealed DEK; abort on `Unencrypted` |

### `ori::data`

| Function | Signature | Description |
| --- | --- | --- |
| `new_blob` | `(u256, Confidentiality): WalrusBlob` | Create a standalone blob reference |
| `new_quilt` | `(u256): WalrusQuilt` | Create a complete quilt reference |
| `new_quilt_patch` | `(vector<u8>, Confidentiality): WalrusQuiltPatch` | Create an opaque patch reference |
| `blob_id` | `(&WalrusBlob): u256` | Return a standalone blob ID |
| `blob_confidentiality` | `(&WalrusBlob): &Confidentiality` | Return blob confidentiality |
| `quilt_id` | `(&WalrusQuilt): u256` | Return a complete quilt ID |
| `quilt_patch_id` | `(&WalrusQuiltPatch): &vector<u8>` | Return opaque patch ID bytes |
| `quilt_patch_confidentiality` | `(&WalrusQuiltPatch): &Confidentiality` | Return patch confidentiality |

There are deliberately no `new_encrypted_blob`, `new_unencrypted_blob`, `new_encrypted_quilt_patch`, or `new_unencrypted_quilt_patch` cross-product helpers.

## TypeScript SDK

The SDK source mirrors the composed `Confidentiality` JSON shape and provides strict parsers, ID codecs, and helpers for the official Walrus [blob](https://docs.wal.app/docs/http-api/reading-blobs) and [quilt](https://docs.wal.app/docs/http-api/quilt-http-apis) endpoints.

SDK 0.4.0 targets the immutable module-split deployments above. Earlier SDKs
and the legacy package IDs predate this split.

See the [SDK README](sdk/README.md) for the source API and release caveat.

## Legacy immutable deployments

These deployed packages contain the pre-split `ori::data::Confidentiality` API. They do not contain `ori::confidentiality` and cannot be upgraded.

| Network | Legacy package ID | Transaction digest |
| --- | --- | --- |
| Mainnet | `0xe9b70375353ec0ed99e9ef2a4e51e70087db042ceba4631430cc2d7217b7fdcf` | `2FumWeQAu3uMgynnPHJu1NGfx2t5zprF3vrx12Wg4W9R` |
| Testnet | `0x3013ca910b7571a5d19b215cce1037ea0061ba844831ea7013ce1b37303ec0ca` | `4bi48n3Nxfk8qf7EdiQPfVdkTSonoR9FVdZBHJKwc29m` |

Earlier immutable 0.1 deployments expose the original `WalrusData` enum:

| Network | Legacy 0.1 package ID | Transaction digest |
| --- | --- | --- |
| Mainnet | `0x6b48ac981da192c9f7308cd8a781dffde9790288c5bfb6b935b94cf8fa1f043f` | `BP17wt9Z73CnZWq8hkkQeswE66BdC6PCc8pgLK7kZC1o` |
| Testnet | `0xf35cf353a62cef01084b51a9cf3da4c64c8724685ad1862f2f8284b71bd26c1a` | `D7dWZ98usk1sea7YA2ftPWd43HrF7TgChjCCnPZKdgnB` |

## Development

```sh
cd move
sui move build
sui move test

cd ../sdk
npm ci
npm test
npm run typecheck
npm run build
```

## License

[MIT](LICENSE)

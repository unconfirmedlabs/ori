# ori

A Sui Move library for embedding concrete references to data stored on [Walrus](https://docs.wal.app/).

## Overview

Ori keeps the three Walrus concepts distinct:

- `WalrusBlob` references a standalone blob by its `u256` blob ID.
- `WalrusQuilt` references a complete quilt by its `u256` quilt ID.
- `WalrusQuiltPatch` references one patch by its opaque `vector<u8>` patch ID.

`WalrusBlob` and `WalrusQuiltPatch` carry a required `WalrusConfidentiality`, either `Unencrypted` or `Encrypted { dek }`. The encrypted DEK is a Seal-encrypted data-encryption key, not plaintext key material. All types have `copy`, `drop`, and `store` abilities.

This mirrors Walrus's own distinction between a blob, a batch, and an item within that batch. See the official [quilt overview](https://docs.wal.app/docs/system-overview/quilt) and [quilt HTTP API](https://docs.wal.app/docs/http-api/quilt-http-apis).

The concrete Move API documented below is currently source-only and has not yet been deployed as a new immutable package. The legacy package IDs below do not contain these types. A stable dependency declaration will be documented when the new Move package is published.

## Usage

```move
use ori::walrus_data;

let blob = walrus_data::new_blob(blob_id);
let encrypted_blob = walrus_data::new_encrypted_blob(ciphertext_blob_id, sealed_dek);

let quilt = walrus_data::new_quilt(quilt_id);

// Patch IDs are opaque bytes obtained from Walrus.
let patch = walrus_data::new_quilt_patch(quilt_patch_id);
let encrypted_patch =
    walrus_data::new_encrypted_quilt_patch(encrypted_patch_id, sealed_dek);
```

Applications can make their storage choice explicit in field types:

```move
public struct Release has store {
    master: walrus_data::WalrusBlob,
    stems: walrus_data::WalrusQuilt,
    cover: walrus_data::WalrusQuiltPatch,
}
```

### Reading fields

```move
let blob_id: u256 = blob.blob_id();
let quilt_id: u256 = quilt.quilt_id();
let patch_id: &vector<u8> = patch.quilt_patch_id();

let confidentiality = blob.blob_confidentiality();
if (confidentiality.is_encrypted()) {
    let sealed_dek: &vector<u8> = confidentiality.sealed_dek();
};
```

`sealed_dek` aborts for `Unencrypted`. Encrypted constructors reject an empty DEK, and quilt-patch constructors reject an empty patch ID.

## Move API

| Function | Signature | Description |
| --- | --- | --- |
| `new_blob` | `(u256): WalrusBlob` | Create an unencrypted standalone blob reference |
| `new_encrypted_blob` | `(u256, vector<u8>): WalrusBlob` | Create an encrypted standalone blob reference |
| `new_quilt` | `(u256): WalrusQuilt` | Create a complete quilt reference |
| `new_quilt_patch` | `(vector<u8>): WalrusQuiltPatch` | Create an unencrypted opaque patch reference |
| `new_encrypted_quilt_patch` | `(vector<u8>, vector<u8>): WalrusQuiltPatch` | Create an encrypted opaque patch reference |
| `blob_id` | `(&WalrusBlob): u256` | Return a standalone blob ID |
| `blob_confidentiality` | `(&WalrusBlob): &WalrusConfidentiality` | Return blob confidentiality |
| `quilt_id` | `(&WalrusQuilt): u256` | Return a complete quilt ID |
| `quilt_patch_id` | `(&WalrusQuiltPatch): &vector<u8>` | Return opaque patch ID bytes |
| `quilt_patch_confidentiality` | `(&WalrusQuiltPatch): &WalrusConfidentiality` | Return patch confidentiality |
| `is_encrypted` | `(&WalrusConfidentiality): bool` | Test confidentiality |
| `sealed_dek` | `(&WalrusConfidentiality): &vector<u8>` | Return the encrypted DEK; abort if unencrypted |

## TypeScript SDK

The `@unconfirmed/ori` package provides matching concrete types, strict Move JSON parsers, ID codecs, and helpers for the official [Walrus blob](https://docs.wal.app/docs/http-api/reading-blobs) and [quilt](https://docs.wal.app/docs/http-api/quilt-http-apis) read endpoints.

```sh
npm install @unconfirmed/ori
```

See the [SDK README](sdk/README.md) for its complete API and the 0.2.0 migration notes.

## Legacy 0.1 deployments

These immutable deployments expose the old `WalrusData` enum API. They are retained for historical users and do **not** contain the concrete API documented above.

| Network | Legacy 0.1 package ID | Transaction digest |
| --- | --- | --- |
| Mainnet | `0x6b48ac981da192c9f7308cd8a781dffde9790288c5bfb6b935b94cf8fa1f043f` | `BP17wt9Z73CnZWq8hkkQeswE66BdC6PCc8pgLK7kZC1o` |
| Testnet | `0xf35cf353a62cef01084b51a9cf3da4c64c8724685ad1862f2f8284b71bd26c1a` | `D7dWZ98usk1sea7YA2ftPWd43HrF7TgChjCCnPZKdgnB` |

## Development

```sh
sui move build
sui move test

cd sdk
npm ci
npm test
npm run typecheck
npm run build
```

## License

[MIT](LICENSE)

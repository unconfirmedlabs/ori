# ori

A Sui Move library for referencing data stored on [Walrus](https://docs.walrus.site/). Supports both standalone blobs and [quilt](https://docs.walrus.site/usage/quilts.html) patches.

## Overview

`ori` provides a single enum type, `WalrusData`, that represents a reference to data on Walrus. It has two variants:

- **`Blob(u256)`** — a reference to a standalone Walrus blob, identified by its blob ID.
- **`QuiltPatch(u256, u8, u16, u16)`** — a reference to a patch within a Walrus quilt, identified by the quilt ID, version, start index, and end index.

The type has `copy`, `drop`, and `store` abilities, so it can be freely embedded in other on-chain objects.

## Installation

Add ori as a dependency in your `Move.toml`:

```toml
[dependencies]
ori = { git = "https://github.com/unconfirmedlabs/ori.git", rev = "main" }
```

## Usage

```move
use ori::walrus_data::{Self, WalrusData};

// Reference a standalone blob
let blob: WalrusData = walrus_data::new_blob(blob_id);

// Reference a quilt patch
let patch: WalrusData = walrus_data::new_quilt_patch(
    quilt_id,
    version,
    start_index,
    end_index,
);
```

### Reading fields

```move
// Check the variant
if (data.is_blob()) {
    let id: u256 = data.blob_id();
} else {
    let qid: u256 = data.quilt_id();
    let ver: u8 = data.quilt_patch_version();
    let start: u16 = data.quilt_patch_start_index();
    let end: u16 = data.quilt_patch_end_index();
};
```

Calling a field accessor on the wrong variant aborts the transaction.

### Quilt patch ID encoding

`quilt_patch_id` serializes a quilt patch reference into a 37-byte `vector<u8>`:

| Bytes | Field | Encoding |
|-------|-------|----------|
| 0..31 | `quilt_id` | 32 bytes, little-endian |
| 32 | `version` | 1 byte |
| 33..34 | `start_index` | 2 bytes, little-endian |
| 35..36 | `end_index` | 2 bytes, little-endian |

```move
let raw: vector<u8> = patch.quilt_patch_id();
```

### Assertions

```move
data.assert_is_blob();        // aborts if not a Blob
data.assert_is_quilt_patch(); // aborts if not a QuiltPatch
```

## API Reference

| Function | Signature | Description |
|----------|-----------|-------------|
| `new_blob` | `(u256): WalrusData` | Create a blob reference |
| `new_quilt_patch` | `(u256, u8, u16, u16): WalrusData` | Create a quilt patch reference |
| `blob_id` | `(&WalrusData): u256` | Get blob ID (aborts on QuiltPatch) |
| `quilt_id` | `(&WalrusData): u256` | Get quilt ID (aborts on Blob) |
| `quilt_patch_version` | `(&WalrusData): u8` | Get patch version (aborts on Blob) |
| `quilt_patch_start_index` | `(&WalrusData): u16` | Get patch start index (aborts on Blob) |
| `quilt_patch_end_index` | `(&WalrusData): u16` | Get patch end index (aborts on Blob) |
| `quilt_patch_id` | `(&WalrusData): vector<u8>` | Encode patch as 37-byte ID (aborts on Blob) |
| `is_blob` | `(&WalrusData): bool` | Check if Blob variant |
| `is_quilt_patch` | `(&WalrusData): bool` | Check if QuiltPatch variant |
| `assert_is_blob` | `(&WalrusData)` | Abort if not Blob |
| `assert_is_quilt_patch` | `(&WalrusData)` | Abort if not QuiltPatch |

## Published packages

Both deployments are immutable.

| Network | Package ID | Transaction digest |
| --- | --- | --- |
| Mainnet | `0x6b48ac981da192c9f7308cd8a781dffde9790288c5bfb6b935b94cf8fa1f043f` | `BP17wt9Z73CnZWq8hkkQeswE66BdC6PCc8pgLK7kZC1o` |
| Testnet | `0xf35cf353a62cef01084b51a9cf3da4c64c8724685ad1862f2f8284b71bd26c1a` | `D7dWZ98usk1sea7YA2ftPWd43HrF7TgChjCCnPZKdgnB` |

## Development

### Build

```sh
sui move build
```

### Test

```sh
sui move test
```

The test suite covers blob and quilt patch construction, field accessors, boundary values, quilt patch ID encoding against real quilt data, and cross-variant abort behavior.

## License

[MIT](LICENSE)

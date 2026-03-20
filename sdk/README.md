# @unconfirmed/ori

TypeScript types and URL helpers for the [Ori](https://github.com/unconfirmedlabs/ori) Walrus data package on Sui.

## Install

```bash
npm install @unconfirmed/ori
```

## Usage

```typescript
import { walrusDataUrl, parseWalrusData, u256ToB64Url } from "@unconfirmed/ori";
import type { WalrusData } from "@unconfirmed/ori";

// Parse on-chain JSON into typed WalrusData
const data = parseWalrusData(onChainJson);

// Generate aggregator URL
const url = walrusDataUrl("https://aggregator.walrus.site", data);
```

## API

### Types

- **`WalrusData`** — Discriminated union: `{ type: "Blob"; blobId: string }` or `{ type: "QuiltPatch"; quiltId: string; version: number; startIndex: number; endIndex: number }`

### Functions

- **`parseWalrusData(json)`** — Parse on-chain WalrusData JSON into the typed union
- **`walrusDataUrl(aggregatorUrl, data)`** — Build a Walrus aggregator URL for any WalrusData variant
- **`u256ToB64Url(value)`** — Convert a u256 decimal string to base64url blob ID
- **`b64UrlToU256(blobId)`** — Convert a base64url blob ID to u256 decimal string
- **`quiltPatchId(quiltId, version, startIndex, endIndex)`** — Build a 37-byte quilt patch ID as base64url
- **`assertBlobId(data)`** — Extract blob ID from a Blob variant (throws on QuiltPatch)

## License

MIT

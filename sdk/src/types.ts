// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

/** Confidentiality metadata attached to a standalone blob or quilt patch. */
export type WalrusConfidentiality =
  | { type: "Unencrypted" }
  | {
      type: "Encrypted";
      /** A Seal-encrypted data-encryption key, as lowercase unprefixed hex. */
      dek: string;
    };

/** A standalone Walrus blob, represented on-chain by its u256 blob ID. */
export interface WalrusBlob {
  /** Canonical decimal representation of the Walrus blob ID. */
  blobId: string;
  confidentiality: WalrusConfidentiality;
}

/** A Walrus quilt as a whole, represented on-chain by its u256 blob ID. */
export interface WalrusQuilt {
  /** Canonical decimal representation of the quilt's Walrus blob ID. */
  quiltId: string;
}

/** A single patch within a Walrus quilt. */
export interface WalrusQuiltPatch {
  /** Canonical, unpadded base64url representation of the opaque patch ID bytes. */
  quiltPatchId: string;
  confidentiality: WalrusConfidentiality;
}

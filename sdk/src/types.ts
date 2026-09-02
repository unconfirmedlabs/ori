// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

/** Mirrors the composed `ori::confidentiality::Confidentiality` value. */
export type Confidentiality =
  | { type: "Unencrypted" }
  | {
      type: "Encrypted";
      /** A Seal-encrypted data-encryption key, as lowercase unprefixed hex. */
      sealedDek: string;
    };

/** A standalone Walrus blob with composed confidentiality metadata. */
export interface WalrusBlob {
  /** Canonical decimal representation of the Walrus blob ID. */
  blobId: string;
  confidentiality: Confidentiality;
}

/** A Walrus quilt as a whole, represented on-chain by its u256 blob ID. */
export interface WalrusQuilt {
  /** Canonical decimal representation of the quilt's Walrus blob ID. */
  quiltId: string;
}

/** A single quilt patch with composed confidentiality metadata. */
export interface WalrusQuiltPatch {
  /** Canonical, unpadded base64url representation of the opaque patch ID bytes. */
  quiltPatchId: string;
  confidentiality: Confidentiality;
}

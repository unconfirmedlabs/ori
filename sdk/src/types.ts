// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

/**
 * Confidentiality of a standalone blob: cleartext, or encrypted. Only blobs can
 * be encrypted (a quilt patch is a slice of a shared quilt blob, never the
 * direct product of an encryption).
 */
export type Confidentiality =
  | { type: "Unencrypted" }
  | {
      type: "Encrypted";
      /**
       * Seal-sealed AES data-encryption key, as a hex string. This is a Seal
       * `EncryptedObject`, which itself encodes the decryption-policy package.
       */
      dek: string;
    };

/** Reference to data stored on Walrus — either a standalone blob or a quilt patch. */
export type WalrusData =
  | {
      type: "Blob";
      blobId: string;
      /** Confidentiality of the blob. Absent ⇒ treat as unencrypted. */
      confidentiality?: Confidentiality;
    }
  | { type: "QuiltPatch"; quiltId: string; version: number; startIndex: number; endIndex: number };

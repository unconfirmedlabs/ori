module ori::data;

// === Types ===

/// Confidentiality metadata for referenced data.
public enum Confidentiality has copy, drop, store {
    /// The referenced data is stored in the clear.
    Unencrypted,
    /// The referenced data is encrypted. `sealed_dek` is its Seal-sealed
    /// data-encryption key, not the plaintext key.
    Encrypted { sealed_dek: vector<u8> },
}

/// A standalone Walrus blob.
public struct WalrusBlob has copy, drop, store {
    blob_id: u256,
    confidentiality: Confidentiality,
}

/// A complete Walrus quilt.
public struct WalrusQuilt has copy, drop, store {
    quilt_id: u256,
}

/// A patch within a Walrus quilt.
///
/// The patch ID is opaque and is preserved exactly as supplied.
public struct WalrusQuiltPatch has copy, drop, store {
    quilt_patch_id: vector<u8>,
    confidentiality: Confidentiality,
}

// === Errors ===

#[error]
const EEmptySealedDek: vector<u8> = b"Encrypted data must have a non-empty sealed DEK";

#[error]
const EEmptyQuiltPatchId: vector<u8> = b"A Walrus quilt patch ID must not be empty";

#[error]
const ENotEncrypted: vector<u8> = b"The Walrus reference is not encrypted";

// === Constructors ===

/// Creates unencrypted confidentiality metadata.
public fun new_unencrypted(): Confidentiality {
    Confidentiality::Unencrypted
}

/// Creates encrypted confidentiality metadata with a Seal-sealed data-encryption key.
public fun new_encrypted(sealed_dek: vector<u8>): Confidentiality {
    assert!(!sealed_dek.is_empty(), EEmptySealedDek);
    Confidentiality::Encrypted { sealed_dek }
}

/// Creates a reference to an unencrypted standalone Walrus blob.
public fun new_blob(blob_id: u256): WalrusBlob {
    WalrusBlob {
        blob_id,
        confidentiality: new_unencrypted(),
    }
}

/// Creates a reference to an encrypted standalone Walrus blob.
public fun new_encrypted_blob(blob_id: u256, sealed_dek: vector<u8>): WalrusBlob {
    WalrusBlob {
        blob_id,
        confidentiality: new_encrypted(sealed_dek),
    }
}

/// Creates a reference to a complete Walrus quilt.
public fun new_quilt(quilt_id: u256): WalrusQuilt {
    WalrusQuilt { quilt_id }
}

/// Creates a reference to an unencrypted patch within a Walrus quilt.
public fun new_quilt_patch(quilt_patch_id: vector<u8>): WalrusQuiltPatch {
    assert!(!quilt_patch_id.is_empty(), EEmptyQuiltPatchId);
    WalrusQuiltPatch {
        quilt_patch_id,
        confidentiality: new_unencrypted(),
    }
}

/// Creates a reference to an encrypted patch within a Walrus quilt.
public fun new_encrypted_quilt_patch(
    quilt_patch_id: vector<u8>,
    sealed_dek: vector<u8>,
): WalrusQuiltPatch {
    assert!(!quilt_patch_id.is_empty(), EEmptyQuiltPatchId);
    WalrusQuiltPatch {
        quilt_patch_id,
        confidentiality: new_encrypted(sealed_dek),
    }
}

// === Accessors ===

/// Returns the standalone blob ID.
public fun blob_id(self: &WalrusBlob): u256 {
    self.blob_id
}

/// Returns the standalone blob's confidentiality metadata.
public fun blob_confidentiality(self: &WalrusBlob): &Confidentiality {
    &self.confidentiality
}

/// Returns the quilt ID.
public fun quilt_id(self: &WalrusQuilt): u256 {
    self.quilt_id
}

/// Returns the opaque quilt patch ID.
public fun quilt_patch_id(self: &WalrusQuiltPatch): &vector<u8> {
    &self.quilt_patch_id
}

/// Returns the quilt patch's confidentiality metadata.
public fun quilt_patch_confidentiality(
    self: &WalrusQuiltPatch,
): &Confidentiality {
    &self.confidentiality
}

/// Returns whether the confidentiality metadata marks the data as encrypted.
public fun is_encrypted(self: &Confidentiality): bool {
    match (self) {
        Confidentiality::Unencrypted => false,
        Confidentiality::Encrypted { .. } => true,
    }
}

/// Returns the Seal-sealed data-encryption key.
///
/// Aborts when the data is unencrypted.
public fun sealed_dek(self: &Confidentiality): &vector<u8> {
    match (self) {
        Confidentiality::Encrypted { sealed_dek } => sealed_dek,
        Confidentiality::Unencrypted => abort ENotEncrypted,
    }
}

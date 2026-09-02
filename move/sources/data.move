module ori::data;

use ori::confidentiality::Confidentiality;

// === Types ===

/// A standalone Walrus blob.
///
/// Its confidentiality is composed by the caller and preserved by value.
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
/// The patch ID is opaque and is preserved exactly as supplied. Its
/// confidentiality is composed by the caller and preserved by value.
public struct WalrusQuiltPatch has copy, drop, store {
    quilt_patch_id: vector<u8>,
    confidentiality: Confidentiality,
}

// === Errors ===

#[error]
const EEmptyQuiltPatchId: vector<u8> = b"A Walrus quilt patch ID must not be empty";

// === Constructors ===

/// Creates a standalone Walrus blob reference with composed confidentiality.
public fun new_blob(
    blob_id: u256,
    confidentiality: Confidentiality,
): WalrusBlob {
    WalrusBlob {
        blob_id,
        confidentiality,
    }
}

/// Creates a reference to a complete Walrus quilt.
public fun new_quilt(quilt_id: u256): WalrusQuilt {
    WalrusQuilt { quilt_id }
}

/// Creates a Walrus quilt patch reference with composed confidentiality.
public fun new_quilt_patch(
    quilt_patch_id: vector<u8>,
    confidentiality: Confidentiality,
): WalrusQuiltPatch {
    assert!(!quilt_patch_id.is_empty(), EEmptyQuiltPatchId);
    WalrusQuiltPatch {
        quilt_patch_id,
        confidentiality,
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

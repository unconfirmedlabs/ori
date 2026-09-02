module ori::confidentiality;

// === Types ===

/// Confidentiality metadata for referenced data.
///
/// Variants can only be constructed in this module, so encrypted values always
/// carry a non-empty Seal-sealed data-encryption key.
public enum Confidentiality has copy, drop, store {
    /// The referenced data is stored in the clear.
    Unencrypted,
    /// The referenced data is encrypted. `sealed_dek` is its Seal-sealed
    /// data-encryption key, not the plaintext key.
    Encrypted { sealed_dek: vector<u8> },
}

// === Errors ===

#[error]
const EEmptySealedDek: vector<u8> = b"Encrypted data must have a non-empty sealed DEK";

#[error]
const ENotEncrypted: vector<u8> = b"The data is not encrypted";

// === Constructors ===

/// Creates unencrypted confidentiality metadata.
public fun new_unencrypted(): Confidentiality {
    Confidentiality::Unencrypted
}

/// Creates encrypted confidentiality metadata with a non-empty Seal-sealed
/// data-encryption key.
public fun new_encrypted(sealed_dek: vector<u8>): Confidentiality {
    assert!(!sealed_dek.is_empty(), EEmptySealedDek);
    Confidentiality::Encrypted { sealed_dek }
}

// === Accessors ===

/// Returns whether the confidentiality metadata marks the data as encrypted.
public fun is_encrypted(self: &Confidentiality): bool {
    match (self) {
        Confidentiality::Unencrypted => false,
        Confidentiality::Encrypted { .. } => true,
    }
}

/// Returns the Seal-sealed data-encryption key.
///
/// Aborts with `ENotEncrypted` when the data is unencrypted.
public fun sealed_dek(self: &Confidentiality): &vector<u8> {
    match (self) {
        Confidentiality::Encrypted { sealed_dek } => sealed_dek,
        Confidentiality::Unencrypted => abort ENotEncrypted,
    }
}

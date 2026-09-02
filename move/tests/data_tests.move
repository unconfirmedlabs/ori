#[test_only]
module ori::data_tests;

use ori::{confidentiality, data};
use std::unit_test::assert_eq;

const MAX_U256: u256 =
    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

// === Blob Tests ===

#[test]
fun blob_preserves_unencrypted_confidentiality() {
    let blob = data::new_blob(
        42,
        confidentiality::new_unencrypted(),
    );

    assert_eq!(blob.blob_id(), 42);
    assert!(!blob.blob_confidentiality().is_encrypted());
}

#[test]
fun blob_preserves_encrypted_confidentiality() {
    let blob = data::new_blob(
        7,
        confidentiality::new_encrypted(b"sealed-dek"),
    );
    let value = blob.blob_confidentiality();

    assert_eq!(blob.blob_id(), 7);
    assert!(value.is_encrypted());
    assert_eq!(*value.sealed_dek(), b"sealed-dek");
}

#[test]
fun blob_preserves_boundary_ids() {
    let zero = data::new_blob(0, confidentiality::new_unencrypted());
    let max = data::new_blob(MAX_U256, confidentiality::new_unencrypted());

    assert_eq!(zero.blob_id(), 0);
    assert_eq!(max.blob_id(), MAX_U256);
}

// === Quilt Tests ===

#[test]
fun quilt_preserves_boundary_ids() {
    let zero = data::new_quilt(0);
    let max = data::new_quilt(MAX_U256);

    assert_eq!(zero.quilt_id(), 0);
    assert_eq!(max.quilt_id(), MAX_U256);
}

// === Quilt Patch Tests ===

#[test]
fun quilt_patch_preserves_unencrypted_confidentiality() {
    let patch = data::new_quilt_patch(
        vector[0xff, 0x00, 0x42, 0x80, 0x01],
        confidentiality::new_unencrypted(),
    );

    assert_eq!(
        *patch.quilt_patch_id(),
        vector[0xff, 0x00, 0x42, 0x80, 0x01],
    );
    assert!(!patch.quilt_patch_confidentiality().is_encrypted());
}

#[test]
fun quilt_patch_preserves_encrypted_confidentiality() {
    let patch = data::new_quilt_patch(
        vector[0x01, 0x02, 0x03],
        confidentiality::new_encrypted(b"sealed-patch-dek"),
    );
    let value = patch.quilt_patch_confidentiality();

    assert_eq!(*patch.quilt_patch_id(), vector[0x01, 0x02, 0x03]);
    assert!(value.is_encrypted());
    assert_eq!(*value.sealed_dek(), b"sealed-patch-dek");
}

#[test]
fun quilt_patch_preserves_real_37_byte_id() {
    let patch_id = vector[
        0x87, 0xc2, 0xb4, 0x0c, 0x74, 0x2d, 0x72, 0x81,
        0xc3, 0xc1, 0x75, 0x7d, 0x9a, 0xe2, 0x19, 0xab,
        0xee, 0x15, 0x71, 0x7e, 0x9c, 0x6b, 0xfe, 0x6d,
        0x62, 0xde, 0x36, 0x0c, 0x0b, 0xcf, 0x4b, 0x1a,
        0x01, 0x00, 0x00, 0x84, 0x00,
    ];
    let patch = data::new_quilt_patch(
        patch_id,
        confidentiality::new_unencrypted(),
    );

    assert_eq!(patch.quilt_patch_id().length(), 37);
}

#[test, expected_failure(abort_code = data::EEmptyQuiltPatchId, location = data)]
fun quilt_patch_rejects_empty_id() {
    data::new_quilt_patch(
        vector[],
        confidentiality::new_unencrypted(),
    );
}

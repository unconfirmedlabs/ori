#[test_only]
module ori::data_tests;

use ori::data;
use std::unit_test::assert_eq;

const MAX_U256: u256 =
    0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;

// === Confidentiality Tests ===

#[test]
fun unencrypted_confidentiality_is_unencrypted() {
    let confidentiality = data::new_unencrypted();

    assert!(!confidentiality.is_encrypted());
}

#[test]
fun encrypted_confidentiality_preserves_sealed_dek() {
    let confidentiality = data::new_encrypted(b"sealed-dek");

    assert!(confidentiality.is_encrypted());
    assert_eq!(*confidentiality.sealed_dek(), b"sealed-dek");
}

#[test, expected_failure(abort_code = data::EEmptySealedDek, location = data)]
fun encrypted_confidentiality_rejects_empty_sealed_dek() {
    data::new_encrypted(b"");
}

// === Blob Tests ===

#[test]
fun plain_blob_preserves_id_and_is_unencrypted() {
    let blob = data::new_blob(42);

    assert_eq!(blob.blob_id(), 42);
    assert!(!blob.blob_confidentiality().is_encrypted());
}

#[test]
fun blob_preserves_zero_id() {
    let blob = data::new_blob(0);

    assert_eq!(blob.blob_id(), 0);
}

#[test]
fun blob_preserves_max_id() {
    let blob = data::new_blob(MAX_U256);

    assert_eq!(blob.blob_id(), MAX_U256);
}

#[test]
fun encrypted_blob_preserves_id_and_dek() {
    let blob = data::new_encrypted_blob(7, b"sealed-dek");
    let confidentiality = blob.blob_confidentiality();

    assert_eq!(blob.blob_id(), 7);
    assert!(confidentiality.is_encrypted());
    assert_eq!(*confidentiality.sealed_dek(), b"sealed-dek");
}

#[test, expected_failure(abort_code = data::EEmptySealedDek, location = data)]
fun encrypted_blob_rejects_empty_dek() {
    data::new_encrypted_blob(7, b"");
}

#[test, expected_failure(abort_code = data::ENotEncrypted, location = data)]
fun plain_blob_has_no_sealed_dek() {
    data::new_blob(7).blob_confidentiality().sealed_dek();
}

// === Quilt Tests ===

#[test]
fun quilt_preserves_zero_id() {
    let quilt = data::new_quilt(0);

    assert_eq!(quilt.quilt_id(), 0);
}

#[test]
fun quilt_preserves_max_id() {
    let quilt = data::new_quilt(MAX_U256);

    assert_eq!(quilt.quilt_id(), MAX_U256);
}

// === Quilt Patch Tests ===

#[test]
fun plain_quilt_patch_preserves_arbitrary_bytes() {
    let patch_id = vector[0xff, 0x00, 0x42, 0x80, 0x01];
    let patch = data::new_quilt_patch(patch_id);

    assert_eq!(*patch.quilt_patch_id(), vector[0xff, 0x00, 0x42, 0x80, 0x01]);
    assert!(!patch.quilt_patch_confidentiality().is_encrypted());
}

#[test, expected_failure(abort_code = data::EEmptyQuiltPatchId, location = data)]
fun plain_quilt_patch_rejects_empty_id() {
    data::new_quilt_patch(vector[]);
}

#[test]
fun plain_quilt_patch_preserves_real_37_byte_id() {
    let patch_id = vector[
        0x87, 0xc2, 0xb4, 0x0c, 0x74, 0x2d, 0x72, 0x81,
        0xc3, 0xc1, 0x75, 0x7d, 0x9a, 0xe2, 0x19, 0xab,
        0xee, 0x15, 0x71, 0x7e, 0x9c, 0x6b, 0xfe, 0x6d,
        0x62, 0xde, 0x36, 0x0c, 0x0b, 0xcf, 0x4b, 0x1a,
        0x01, 0x00, 0x00, 0x84, 0x00,
    ];
    let patch = data::new_quilt_patch(patch_id);

    assert_eq!(patch.quilt_patch_id().length(), 37);
    assert_eq!(
        *patch.quilt_patch_id(),
        vector[
            0x87, 0xc2, 0xb4, 0x0c, 0x74, 0x2d, 0x72, 0x81,
            0xc3, 0xc1, 0x75, 0x7d, 0x9a, 0xe2, 0x19, 0xab,
            0xee, 0x15, 0x71, 0x7e, 0x9c, 0x6b, 0xfe, 0x6d,
            0x62, 0xde, 0x36, 0x0c, 0x0b, 0xcf, 0x4b, 0x1a,
            0x01, 0x00, 0x00, 0x84, 0x00,
        ],
    );
}

#[test]
fun encrypted_quilt_patch_preserves_id_and_dek() {
    let patch = data::new_encrypted_quilt_patch(
        vector[0x01, 0x02, 0x03],
        b"sealed-patch-dek",
    );
    let confidentiality = patch.quilt_patch_confidentiality();

    assert_eq!(*patch.quilt_patch_id(), vector[0x01, 0x02, 0x03]);
    assert!(confidentiality.is_encrypted());
    assert_eq!(*confidentiality.sealed_dek(), b"sealed-patch-dek");
}

#[test, expected_failure(abort_code = data::EEmptyQuiltPatchId, location = data)]
fun encrypted_quilt_patch_rejects_empty_id() {
    data::new_encrypted_quilt_patch(vector[], b"sealed-dek");
}

#[test, expected_failure(abort_code = data::EEmptySealedDek, location = data)]
fun encrypted_quilt_patch_rejects_empty_dek() {
    data::new_encrypted_quilt_patch(vector[0x01], b"");
}

#[test, expected_failure(abort_code = data::ENotEncrypted, location = data)]
fun plain_quilt_patch_has_no_sealed_dek() {
    data::new_quilt_patch(vector[0x01])
        .quilt_patch_confidentiality()
        .sealed_dek();
}

#[test_only]
module walrus_data::walrus_data_tests;

use walrus_data::walrus_data;
use std::unit_test::assert_eq;

// === Blob Tests ===

#[test]
fun test_new_blob() {
    let data = walrus_data::new_blob(42);
    assert!(data.is_blob());
    assert!(!data.is_quilt_patch());
    assert_eq!(data.blob_id(), 42);
}

#[test]
fun test_blob_zero() {
    let data = walrus_data::new_blob(0);
    assert_eq!(data.blob_id(), 0);
}

#[test]
fun test_blob_max_u256() {
    let max: u256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    let data = walrus_data::new_blob(max);
    assert_eq!(data.blob_id(), max);
}

// === QuiltPatch Tests ===

#[test]
fun test_new_quilt_patch() {
    let data = walrus_data::new_quilt_patch(100, 1, 256, 512);
    assert!(data.is_quilt_patch());
    assert!(!data.is_blob());
    assert_eq!(data.quilt_id(), 100);
    assert_eq!(data.quilt_patch_version(), 1);
    assert_eq!(data.quilt_patch_start_index(), 256);
    assert_eq!(data.quilt_patch_end_index(), 512);
}

#[test]
fun test_quilt_patch_zero_fields() {
    let data = walrus_data::new_quilt_patch(0, 0, 0, 0);
    assert_eq!(data.quilt_id(), 0);
    assert_eq!(data.quilt_patch_version(), 0);
    assert_eq!(data.quilt_patch_start_index(), 0);
    assert_eq!(data.quilt_patch_end_index(), 0);
}

#[test]
fun test_quilt_patch_max_fields() {
    let max_u256: u256 = 0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff;
    let data = walrus_data::new_quilt_patch(max_u256, 255, 65535, 65535);
    assert_eq!(data.quilt_id(), max_u256);
    assert_eq!(data.quilt_patch_version(), 255);
    assert_eq!(data.quilt_patch_start_index(), 65535);
    assert_eq!(data.quilt_patch_end_index(), 65535);
}

// === Quilt Patch ID Tests ===

#[test]
fun test_quilt_patch_id_length() {
    let data = walrus_data::new_quilt_patch(0, 1, 1, 208);
    let patch_id = data.quilt_patch_id();
    // 32 bytes (quilt_id) + 1 byte (version) + 2 bytes (start_index) + 2 bytes (end_index) = 37 bytes
    assert_eq!(patch_id.length(), 37);
}

#[test]
fun test_quilt_patch_id_quilt_id_bytes() {
    // quilt_id = 1 → BCS LE = 0x01 followed by 31 zero bytes
    let data = walrus_data::new_quilt_patch(1, 0, 0, 0);
    let patch_id = data.quilt_patch_id();
    assert_eq!(patch_id[0], 1);
    let mut i = 1;
    while (i < 32) {
        assert_eq!(patch_id[i], 0);
        i = i + 1;
    };
}

/// Test against a real quilt dry run.
///
/// Quilt blob ID: h8K0DHQtcoHDwXV9muIZq-4VcX6ca_5tYt42DAvPSxo
/// Quilt blob ID (hex LE): 87c2b40c742d7281c3c1757d9ae219abee15717e9c6bfe6d62de360c0bcf4b1a
/// u256 (LE): 0x1a4bcf0b0c36de626dfe6b9c7e7115eeab19e29a7d75c1c381722d740cb4c287
///
/// Patches:
///   random_1.bin: start=0,   end=132
///   random_2.bin: start=132, end=263
///   random_3.bin: start=263, end=394
///   random_4.bin: start=394, end=525
///   random_5.bin: start=525, end=656
#[test]
fun test_quilt_patch_id_first_patch() {
    let quilt_id: u256 = 0x1a4bcf0b0c36de626dfe6b9c7e7115eeab19e29a7d75c1c381722d740cb4c287;
    let data = walrus_data::new_quilt_patch(quilt_id, 1, 0, 132);
    let patch_id = data.quilt_patch_id();
    assert_eq!(patch_id.length(), 37);
    // First byte of quilt_id (LE) = 0x87
    assert_eq!(patch_id[0], 0x87);
    assert_eq!(patch_id[1], 0xc2);
    assert_eq!(patch_id[31], 0x1a);
    // Trailer
    assert_eq!(patch_id[32], 1); // version
    assert_eq!(patch_id[33], 0); // start_index low byte
    assert_eq!(patch_id[34], 0); // start_index high byte
    assert_eq!(patch_id[35], 132); // end_index low byte
    assert_eq!(patch_id[36], 0); // end_index high byte
}

#[test]
fun test_quilt_patch_id_second_patch() {
    let quilt_id: u256 = 0x1a4bcf0b0c36de626dfe6b9c7e7115eeab19e29a7d75c1c381722d740cb4c287;
    let data = walrus_data::new_quilt_patch(quilt_id, 1, 132, 263);
    let patch_id = data.quilt_patch_id();
    assert_eq!(patch_id[32], 1); // version
    assert_eq!(patch_id[33], 132); // start_index low byte (132 = 0x84)
    assert_eq!(patch_id[34], 0); // start_index high byte
    assert_eq!(patch_id[35], 7); // end_index low byte (263 = 0x0107)
    assert_eq!(patch_id[36], 1); // end_index high byte
}

#[test]
fun test_quilt_patch_id_fifth_patch() {
    let quilt_id: u256 = 0x1a4bcf0b0c36de626dfe6b9c7e7115eeab19e29a7d75c1c381722d740cb4c287;
    let data = walrus_data::new_quilt_patch(quilt_id, 1, 525, 656);
    let patch_id = data.quilt_patch_id();
    assert_eq!(patch_id[32], 1); // version
    assert_eq!(patch_id[33], 13); // start_index low byte (525 = 0x020D)
    assert_eq!(patch_id[34], 2); // start_index high byte
    assert_eq!(patch_id[35], 144); // end_index low byte (656 = 0x0290)
    assert_eq!(patch_id[36], 2); // end_index high byte
}

// === Assert Tests ===

#[test]
fun test_assert_is_blob_success() {
    let data = walrus_data::new_blob(1);
    data.assert_is_blob();
}

#[test, expected_failure]
fun test_assert_is_blob_failure() {
    let data = walrus_data::new_quilt_patch(1, 1, 0, 10);
    data.assert_is_blob();
}

#[test]
fun test_assert_is_quilt_patch_success() {
    let data = walrus_data::new_quilt_patch(1, 1, 0, 10);
    data.assert_is_quilt_patch();
}

#[test, expected_failure]
fun test_assert_is_quilt_patch_failure() {
    let data = walrus_data::new_blob(1);
    data.assert_is_quilt_patch();
}

// === Cross-variant Abort Tests ===

#[test, expected_failure]
fun test_blob_id_on_quilt_patch_aborts() {
    let data = walrus_data::new_quilt_patch(1, 1, 0, 10);
    data.blob_id();
}

#[test, expected_failure]
fun test_quilt_id_on_blob_aborts() {
    let data = walrus_data::new_blob(1);
    data.quilt_id();
}

#[test, expected_failure]
fun test_quilt_patch_version_on_blob_aborts() {
    let data = walrus_data::new_blob(1);
    data.quilt_patch_version();
}

#[test, expected_failure]
fun test_quilt_patch_start_index_on_blob_aborts() {
    let data = walrus_data::new_blob(1);
    data.quilt_patch_start_index();
}

#[test, expected_failure]
fun test_quilt_patch_end_index_on_blob_aborts() {
    let data = walrus_data::new_blob(1);
    data.quilt_patch_end_index();
}

#[test, expected_failure]
fun test_quilt_patch_id_on_blob_aborts() {
    let data = walrus_data::new_blob(1);
    data.quilt_patch_id();
}

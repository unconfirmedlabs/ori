#[test_only]
module ori::confidentiality_tests;

use ori::confidentiality;
use std::unit_test::assert_eq;

#[test]
fun unencrypted_value_is_not_encrypted() {
    let value = confidentiality::new_unencrypted();

    assert!(!value.is_encrypted());
}

#[test]
fun encrypted_value_preserves_sealed_dek() {
    let value = confidentiality::new_encrypted(b"sealed-dek");

    assert!(value.is_encrypted());
    assert_eq!(*value.sealed_dek(), b"sealed-dek");
}

#[test, expected_failure(abort_code = confidentiality::EEmptySealedDek, location = confidentiality)]
fun encrypted_value_rejects_empty_sealed_dek() {
    confidentiality::new_encrypted(b"");
}

#[test, expected_failure(abort_code = confidentiality::ENotEncrypted, location = confidentiality)]
fun unencrypted_value_has_no_sealed_dek() {
    confidentiality::new_unencrypted().sealed_dek();
}

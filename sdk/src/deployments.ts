// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

/**
 * Immutable package IDs for the pre-split `ori::data` API. These packages do
 * not contain `ori::confidentiality`.
 */
export const LEGACY_ORI_PACKAGE_IDS = {
  mainnet: "0xe9b70375353ec0ed99e9ef2a4e51e70087db042ceba4631430cc2d7217b7fdcf",
  testnet: "0x3013ca910b7571a5d19b215cce1037ea0061ba844831ea7013ce1b37303ec0ca",
} as const;

export type OriNetwork = keyof typeof LEGACY_ORI_PACKAGE_IDS;
export type OriPackageIds = Record<OriNetwork, string>;

export interface OriDeployment {
  readonly packageId: string;
  readonly publishTransactionDigest: string;
  /** SHA-256 of the canonicalized module bytecode and dependency IDs published by the PTB. */
  readonly packageArtifactSha256: string;
}

export type OriDeployments = Record<OriNetwork, OriDeployment>;

/**
 * SHA-256 identity of the audited module bytecode produced by this source tree.
 *
 * The release verifier requires each publication transaction to contain these
 * exact module bytes. Dependencies and the immutable-publication flow are
 * verified separately from the transaction itself.
 */
export const AUDITED_ORI_PACKAGE_ARTIFACT_SHA256 =
  "1915ee941fd1b1ae797f064c9fa0aee52b8014015c8542391176ce5071fbb51f";

/**
 * Deployment proofs for the current module-split API.
 *
 * Release validation verifies every field against the corresponding network.
 */
export const ORI_DEPLOYMENTS: Readonly<OriDeployments> = {
  mainnet: {
    packageId: "0xadefbe1aeb900807ed03144bddd80dc6478030c28ede3b2990f8e792606f317a",
    publishTransactionDigest: "FA2s1EKiapuUfhSeaKYBTVEwdNABBk1w86bcn3YrXoc6",
    packageArtifactSha256: AUDITED_ORI_PACKAGE_ARTIFACT_SHA256,
  },
  testnet: {
    packageId: "0x51792b9adb9a5d05d7c4d74d7d0cb5aefc5639afa80c0089399cab8b99752e60",
    publishTransactionDigest: "ErQxNA2coFkf8Fg9DtmGDU4GtCeb4Gs4GhPNchUjUyeY",
    packageArtifactSha256: AUDITED_ORI_PACKAGE_ARTIFACT_SHA256,
  },
};

/**
 * Package-ID-only view for SDK consumers.
 *
 * Derived from the fully verified deployment map above.
 */
export const ORI_PACKAGE_IDS: Readonly<OriPackageIds> = Object.freeze({
  mainnet: ORI_DEPLOYMENTS.mainnet.packageId,
  testnet: ORI_DEPLOYMENTS.testnet.packageId,
});

/** Return the current immutable Ori package ID for a supported Sui network. */
export function oriPackageId(network: OriNetwork): string {
  return ORI_PACKAGE_IDS[network];
}

export type LegacyOriNetwork = OriNetwork;

/** Return a pre-split Ori package ID for a supported Sui network. */
export function legacyOriPackageId(
  network: LegacyOriNetwork,
): (typeof LEGACY_ORI_PACKAGE_IDS)[LegacyOriNetwork] {
  return LEGACY_ORI_PACKAGE_IDS[network];
}

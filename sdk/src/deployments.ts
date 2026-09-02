// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

/** Immutable Ori package IDs for the supported Sui networks. */
export const ORI_PACKAGE_IDS = {
  mainnet: "0xe9b70375353ec0ed99e9ef2a4e51e70087db042ceba4631430cc2d7217b7fdcf",
  testnet: "0x3013ca910b7571a5d19b215cce1037ea0061ba844831ea7013ce1b37303ec0ca",
} as const;

export type OriNetwork = keyof typeof ORI_PACKAGE_IDS;

/** Return the immutable Ori package ID for a supported Sui network. */
export function oriPackageId(network: OriNetwork): (typeof ORI_PACKAGE_IDS)[OriNetwork] {
  return ORI_PACKAGE_IDS[network];
}

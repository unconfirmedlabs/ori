// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

import { isValidTransactionDigest } from "@mysten/sui/utils";
import {
  AUDITED_ORI_PACKAGE_ARTIFACT_SHA256,
  type OriDeployment,
  type OriDeployments,
  type OriNetwork,
  type OriPackageIds,
} from "./deployments.js";

const NETWORKS = ["mainnet", "testnet"] as const;
const PACKAGE_ID_PATTERN = /^0x[0-9a-f]{64}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const ZERO_PACKAGE_ID = `0x${"0".repeat(64)}`;
const SUI_FRAMEWORK_PACKAGE_ID = `0x${"0".repeat(63)}2`;
const ARTIFACT_HASH_DOMAIN = new TextEncoder().encode("ori-sui-package-artifact-v1\0");

export const RELEASE_NETWORKS = {
  mainnet: {
    endpoint: "https://fullnode.mainnet.sui.io:443",
    chainIdentifier: "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S",
  },
  testnet: {
    endpoint: "https://fullnode.testnet.sui.io:443",
    chainIdentifier: "69WiPg3DAQiwdxfncX6wYQ2siKwAe6L9BZthQea3JNMD",
  },
} as const;

export interface MoveFieldAbi { name: string; type: string }
export interface MoveVariantAbi { name: string; fields: MoveFieldAbi[] }
export interface MoveDatatypeAbi {
  name: string;
  kind: "struct" | "enum" | "unknown";
  abilities: string[];
  typeParameterCount: number;
  fields: MoveFieldAbi[];
  variants: MoveVariantAbi[];
}
export interface MoveFunctionAbi {
  name: string;
  visibility: "public" | "private" | "friend" | "unknown";
  isEntry: boolean;
  typeParameterCount: number;
  parameters: string[];
  returns: string[];
}
export interface MoveModuleAbi {
  name: string;
  datatypes: MoveDatatypeAbi[];
  functions: MoveFunctionAbi[];
}
export interface MovePackageAbi {
  storageId: string;
  originalId: string;
  version: bigint;
  modules: MoveModuleAbi[];
}

export interface PublishCommandAbi {
  kind: "publish";
  modules: Uint8Array[];
  dependencies: string[];
}
export interface MoveCallCommandAbi {
  kind: "moveCall";
  packageId: string;
  module: string;
  function: string;
  typeArguments: string[];
  arguments: TransactionArgumentAbi[];
}
export interface OtherCommandAbi { kind: "other" }
export type PublicationCommandAbi = PublishCommandAbi | MoveCallCommandAbi | OtherCommandAbi;
export type TransactionArgumentAbi =
  | { kind: "result"; commandIndex: number }
  | { kind: "nestedResult"; commandIndex: number; resultIndex: number }
  | { kind: "other" };
export interface ChangedObjectAbi {
  objectId: string;
  inputState: string;
  outputState: string;
  idOperation: string;
}
export interface PublicationTransactionAbi {
  digest: string;
  success: boolean;
  commands: PublicationCommandAbi[];
  changedObjects: ChangedObjectAbi[];
}

export interface ReleaseVerificationClient {
  getChainIdentifier(signal: AbortSignal): Promise<string>;
  getPackage(packageId: string, signal: AbortSignal): Promise<MovePackageAbi | null>;
  getPublicationTransaction(
    digest: string,
    signal: AbortSignal,
  ): Promise<PublicationTransactionAbi | null>;
}
export type ReleaseVerificationClientFactory = (
  network: OriNetwork,
  endpoint: string,
) => ReleaseVerificationClient;

/** Pure structural validation for configured deployment proofs. */
export function assertReleaseReady(
  current: unknown,
  legacy: Readonly<OriPackageIds>,
): asserts current is OriDeployments {
  if (current === null || typeof current !== "object" || Array.isArray(current)) {
    throw new Error("Current Ori deployments must be an object");
  }
  const deployments = current as Record<string, unknown>;
  const keys = Object.keys(deployments).sort();
  if (keys.length !== NETWORKS.length || keys[0] !== "mainnet" || keys[1] !== "testnet") {
    throw new Error("Current Ori deployments must contain exactly mainnet and testnet");
  }
  for (const network of NETWORKS) assertDeploymentShape(deployments[network], network);

  const values = NETWORKS.map((network) => deployments[network] as OriDeployment);
  if (values[0]?.packageId === values[1]?.packageId) {
    throw new Error("Current Ori Mainnet and Testnet package IDs must be distinct");
  }
  if (values[0]?.publishTransactionDigest === values[1]?.publishTransactionDigest) {
    throw new Error("Current Ori Mainnet and Testnet publication transactions must be distinct");
  }
  const legacyIds = new Set(Object.values(legacy));
  for (const network of NETWORKS) {
    if (legacyIds.has((deployments[network] as OriDeployment).packageId)) {
      throw new Error(`Current Ori ${network} package ID is a legacy deployment`);
    }
  }
}

function assertDeploymentShape(value: unknown, network: OriNetwork): asserts value is OriDeployment {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Current Ori ${network} deployment is missing or malformed`);
  }
  const deployment = value as Record<string, unknown>;
  const keys = Object.keys(deployment).sort();
  if (
    keys.length !== 3 ||
    keys[0] !== "packageArtifactSha256" ||
    keys[1] !== "packageId" ||
    keys[2] !== "publishTransactionDigest"
  ) {
    throw new Error(`Current Ori ${network} deployment fields are missing or malformed`);
  }
  if (
    typeof deployment.packageId !== "string" ||
    !PACKAGE_ID_PATTERN.test(deployment.packageId) ||
    deployment.packageId === ZERO_PACKAGE_ID
  ) {
    throw new Error(`Current Ori ${network} package ID is missing or malformed`);
  }
  if (
    typeof deployment.publishTransactionDigest !== "string" ||
    !isValidTransactionDigest(deployment.publishTransactionDigest)
  ) {
    throw new Error(`Current Ori ${network} publication transaction digest is malformed`);
  }
  if (
    typeof deployment.packageArtifactSha256 !== "string" ||
    !SHA256_PATTERN.test(deployment.packageArtifactSha256) ||
    deployment.packageArtifactSha256 !== AUDITED_ORI_PACKAGE_ARTIFACT_SHA256
  ) {
    throw new Error(`Current Ori ${network} package artifact digest is not the audited build`);
  }
}

/** Verify both deployment proofs against their fixed corresponding Sui networks. */
export async function verifyReleaseDeployments(
  deployments: Readonly<OriDeployments>,
  createClient: ReleaseVerificationClientFactory,
  timeoutMs = 15_000,
): Promise<void> {
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Release verification timeout must be a positive integer");
  }
  await Promise.all(
    NETWORKS.map((network) =>
      verifyNetworkDeployment(network, deployments[network], createClient, timeoutMs),
    ),
  );
}

async function verifyNetworkDeployment(
  network: OriNetwork,
  deployment: Readonly<OriDeployment>,
  createClient: ReleaseVerificationClientFactory,
  timeoutMs: number,
): Promise<void> {
  const expected = RELEASE_NETWORKS[network];
  const client = createClient(network, expected.endpoint);
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`Timed out verifying Ori ${network} deployment`));
    }, timeoutMs);
  });

  try {
    await Promise.race([
      (async () => {
        const chainIdentifier = await client.getChainIdentifier(controller.signal);
        if (chainIdentifier !== expected.chainIdentifier) {
          throw new Error(
            `Ori ${network} endpoint returned unexpected chain identifier ${chainIdentifier}`,
          );
        }
        const packageAbi = await client.getPackage(deployment.packageId, controller.signal);
        if (packageAbi === null) {
          throw new Error(`Ori ${network} package ${deployment.packageId} was not found`);
        }
        assertExpectedPackageAbi(packageAbi, deployment.packageId, network);
        const transaction = await client.getPublicationTransaction(
          deployment.publishTransactionDigest,
          controller.signal,
        );
        if (transaction === null) {
          throw new Error(
            `Ori ${network} publication transaction ${deployment.publishTransactionDigest} was not found`,
          );
        }
        await assertPublicationProof(transaction, deployment, network);
      })(),
      deadline,
    ]);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Ori ")) throw error;
    if (error instanceof Error && error.message.startsWith("Timed out ")) throw error;
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Ori ${network} on-chain verification failed: ${reason}`, { cause: error });
  } finally {
    if (timeout !== undefined) clearTimeout(timeout);
    controller.abort();
  }
}

async function assertPublicationProof(
  transaction: PublicationTransactionAbi,
  deployment: Readonly<OriDeployment>,
  network: OriNetwork,
): Promise<void> {
  if (transaction.digest !== deployment.publishTransactionDigest || !transaction.success) {
    throw new Error(`Ori ${network} publication transaction is missing or unsuccessful`);
  }
  const publishes = transaction.commands
    .map((command, index) => ({ command, index }))
    .filter((item): item is { command: PublishCommandAbi; index: number } =>
      item.command.kind === "publish"
    );
  if (publishes.length !== 1) {
    throw new Error(`Ori ${network} publication transaction must contain exactly one Publish command`);
  }
  const publication = publishes[0];
  if (!publication) throw new Error(`Ori ${network} publication command is missing`);
  const artifactDigest = await packageArtifactSha256(
    publication.command.modules,
    publication.command.dependencies,
  );
  if (artifactDigest !== deployment.packageArtifactSha256) {
    throw new Error(`Ori ${network} publication bytecode does not match the audited package artifact`);
  }
  if (!transaction.changedObjects.some(
    (change) =>
      change.objectId === deployment.packageId &&
      change.inputState === "DoesNotExist" &&
      change.outputState === "PackageWrite" &&
      change.idOperation === "Created",
  )) {
    throw new Error(`Ori ${network} publication transaction did not create the configured package`);
  }

  const madeImmutable = transaction.commands.some((command, index) => {
    if (
      index <= publication.index ||
      command.kind !== "moveCall" ||
      command.packageId !== SUI_FRAMEWORK_PACKAGE_ID ||
      command.module !== "package" ||
      command.function !== "make_immutable" ||
      command.typeArguments.length !== 0 ||
      command.arguments.length !== 1
    ) return false;
    const argument = command.arguments[0];
    return (
      argument?.kind === "result" && argument.commandIndex === publication.index
    ) || (
      argument?.kind === "nestedResult" &&
      argument.commandIndex === publication.index &&
      argument.resultIndex === 0
    );
  });
  if (!madeImmutable) {
    throw new Error(
      `Ori ${network} publication did not consume its UpgradeCap with 0x2::package::make_immutable`,
    );
  }
}

export async function packageArtifactSha256(
  modules: readonly Uint8Array[],
  dependencies: readonly string[],
): Promise<string> {
  const chunks: Uint8Array[] = [ARTIFACT_HASH_DOMAIN, encodeU32(modules.length)];
  for (const module of modules) chunks.push(encodeU64(module.length), module);
  chunks.push(encodeU32(dependencies.length));
  for (const dependency of dependencies) {
    const bytes = new TextEncoder().encode(dependency);
    chunks.push(encodeU32(bytes.length), bytes);
  }
  const canonical = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    canonical.set(chunk, offset);
    offset += chunk.length;
  }
  const digest = await crypto.subtle.digest("SHA-256", canonical);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function encodeU32(value: number): Uint8Array {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, false);
  return bytes;
}

function encodeU64(value: number): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, BigInt(value), false);
  return bytes;
}

function assertExpectedPackageAbi(
  packageAbi: MovePackageAbi,
  packageId: string,
  network: OriNetwork,
): void {
  if (packageAbi.storageId !== packageId || packageAbi.originalId !== packageId || packageAbi.version !== 1n) {
    throw new Error(`Ori ${network} object is not the configured fresh Move package`);
  }
  const confidentialityType = `${packageId}::confidentiality::Confidentiality`;
  const blobType = `${packageId}::data::WalrusBlob`;
  const quiltType = `${packageId}::data::WalrusQuilt`;
  const patchType = `${packageId}::data::WalrusQuiltPatch`;
  const vectorU8 = "vector<u8>";
  const confidentiality = requireModule(packageAbi, "confidentiality", network);
  const data = requireModule(packageAbi, "data", network);

  assertDatatype(confidentiality, {
    name: "Confidentiality", kind: "enum", abilities: ["copy", "drop", "store"], fields: [],
    variants: [
      { name: "Unencrypted", fields: [] },
      { name: "Encrypted", fields: [{ name: "sealed_dek", type: vectorU8 }] },
    ],
  }, network);
  assertDatatype(data, {
    name: "WalrusBlob", kind: "struct", abilities: ["copy", "drop", "store"],
    fields: [
      { name: "blob_id", type: "u256" },
      { name: "confidentiality", type: confidentialityType },
    ], variants: [],
  }, network);
  assertDatatype(data, {
    name: "WalrusQuilt", kind: "struct", abilities: ["copy", "drop", "store"],
    fields: [{ name: "quilt_id", type: "u256" }], variants: [],
  }, network);
  assertDatatype(data, {
    name: "WalrusQuiltPatch", kind: "struct", abilities: ["copy", "drop", "store"],
    fields: [
      { name: "quilt_patch_id", type: vectorU8 },
      { name: "confidentiality", type: confidentialityType },
    ], variants: [],
  }, network);

  const confidentialityFunctions: Array<[string, string[], string[]]> = [
    ["new_unencrypted", [], [confidentialityType]],
    ["new_encrypted", [vectorU8], [confidentialityType]],
    ["is_encrypted", [`&${confidentialityType}`], ["bool"]],
    ["sealed_dek", [`&${confidentialityType}`], [`&${vectorU8}`]],
  ];
  const dataFunctions: Array<[string, string[], string[]]> = [
    ["new_blob", ["u256", confidentialityType], [blobType]],
    ["new_quilt", ["u256"], [quiltType]],
    ["new_quilt_patch", [vectorU8, confidentialityType], [patchType]],
    ["blob_id", [`&${blobType}`], ["u256"]],
    ["blob_confidentiality", [`&${blobType}`], [`&${confidentialityType}`]],
    ["quilt_id", [`&${quiltType}`], ["u256"]],
    ["quilt_patch_id", [`&${patchType}`], [`&${vectorU8}`]],
    ["quilt_patch_confidentiality", [`&${patchType}`], [`&${confidentialityType}`]],
  ];
  assertPublicFunctionAllowlist(confidentiality, confidentialityFunctions.map(([name]) => name), network);
  assertPublicFunctionAllowlist(data, dataFunctions.map(([name]) => name), network);
  for (const [name, parameters, returns] of confidentialityFunctions) {
    assertFunction(confidentiality, name, parameters, returns, network);
  }
  for (const [name, parameters, returns] of dataFunctions) {
    assertFunction(data, name, parameters, returns, network);
  }
}

function assertPublicFunctionAllowlist(module: MoveModuleAbi, names: string[], network: OriNetwork): void {
  const actual = module.functions
    .filter((fn) => fn.visibility === "public" || fn.isEntry)
    .map((fn) => fn.name)
    .sort();
  if (!sameStrings(actual, [...names].sort())) {
    throw new Error(`Ori ${network} module ${module.name} has unexpected public or entry functions`);
  }
}

function requireModule(packageAbi: MovePackageAbi, name: string, network: OriNetwork): MoveModuleAbi {
  const module = packageAbi.modules.find((candidate) => candidate.name === name);
  if (!module) throw new Error(`Ori ${network} package is missing module ${name}`);
  return module;
}

interface ExpectedDatatype {
  name: string;
  kind: "struct" | "enum";
  abilities: string[];
  fields: MoveFieldAbi[];
  variants: MoveVariantAbi[];
}
function assertDatatype(module: MoveModuleAbi, expected: ExpectedDatatype, network: OriNetwork): void {
  const actual = module.datatypes.find((datatype) => datatype.name === expected.name);
  if (
    !actual || actual.kind !== expected.kind || actual.typeParameterCount !== 0 ||
    !sameStrings(actual.abilities, expected.abilities) ||
    !sameFields(actual.fields, expected.fields) || !sameVariants(actual.variants, expected.variants)
  ) {
    throw new Error(`Ori ${network} module ${module.name} has mismatched datatype ${expected.name}`);
  }
}
function assertFunction(
  module: MoveModuleAbi,
  name: string,
  parameters: string[],
  returns: string[],
  network: OriNetwork,
): void {
  const actual = module.functions.find((fn) => fn.name === name);
  if (
    !actual || actual.visibility !== "public" || actual.isEntry || actual.typeParameterCount !== 0 ||
    !sameStrings(actual.parameters, parameters) || !sameStrings(actual.returns, returns)
  ) throw new Error(`Ori ${network} module ${module.name} has mismatched function ${name}`);
}
function sameStrings(actual: string[], expected: string[]): boolean {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}
function sameFields(actual: MoveFieldAbi[], expected: MoveFieldAbi[]): boolean {
  return actual.length === expected.length && actual.every(
    (field, index) => field.name === expected[index]?.name && field.type === expected[index]?.type,
  );
}
function sameVariants(actual: MoveVariantAbi[], expected: MoveVariantAbi[]): boolean {
  return actual.length === expected.length && actual.every(
    (variant, index) => variant.name === expected[index]?.name &&
      sameFields(variant.fields, expected[index]?.fields ?? []),
  );
}

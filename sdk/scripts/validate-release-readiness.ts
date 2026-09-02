// Copyright (c) Unconfirmed Labs, Inc.
// SPDX-License-Identifier: MIT

import { SuiGrpcClient } from "@mysten/sui/grpc";
import { fromBase64 } from "@mysten/sui/utils";
import { LEGACY_ORI_PACKAGE_IDS, ORI_DEPLOYMENTS } from "../src/deployments.js";
import {
  assertReleaseReady,
  verifyReleaseDeployments,
} from "../src/release-readiness.js";
import type {
  MoveDatatypeAbi,
  MoveFunctionAbi,
  MovePackageAbi,
  PublicationCommandAbi,
  PublicationTransactionAbi,
  ReleaseVerificationClient,
  TransactionArgumentAbi,
} from "../src/release-readiness.js";

const RPC_TIMEOUT_MS = 15_000;

assertReleaseReady(ORI_DEPLOYMENTS, LEGACY_ORI_PACKAGE_IDS);

await verifyReleaseDeployments(
  ORI_DEPLOYMENTS,
  (network, endpoint) => new GrpcReleaseVerificationClient(network, endpoint),
  RPC_TIMEOUT_MS,
);

console.log("Ori release readiness verified on Sui Mainnet and Testnet.");

class GrpcReleaseVerificationClient implements ReleaseVerificationClient {
  readonly #client: SuiGrpcClient;

  constructor(network: "mainnet" | "testnet", endpoint: string) {
    this.#client = new SuiGrpcClient({ network, baseUrl: endpoint });
  }

  async getChainIdentifier(signal: AbortSignal): Promise<string> {
    const { chainIdentifier } = await this.#client.core.getChainIdentifier({ signal });
    return chainIdentifier;
  }

  async getPackage(packageId: string, signal: AbortSignal): Promise<MovePackageAbi | null> {
    const call = this.#client.movePackageService.getPackage(
      { packageId },
      { abort: signal, timeout: RPC_TIMEOUT_MS },
    );
    const { package: movePackage } = await call.response;
    if (!movePackage) return null;

    return {
      storageId: movePackage.storageId ?? "",
      originalId: movePackage.originalId ?? "",
      version: movePackage.version ?? 0n,
      modules: movePackage.modules.map((module) => ({
        name: module.name ?? "",
        datatypes: module.datatypes.map(normalizeDatatype),
        functions: module.functions.map(normalizeFunction),
      })),
    };
  }

  async getPublicationTransaction(
    digest: string,
    signal: AbortSignal,
  ): Promise<PublicationTransactionAbi | null> {
    const result = await this.#client.core.getTransaction({
      digest,
      include: { transaction: true, effects: true },
      signal,
    });
    const executed = result.Transaction ?? result.FailedTransaction;
    if (!executed?.transaction || !executed.effects) return null;

    return {
      digest: executed.digest,
      success: result.$kind === "Transaction" && executed.status.success,
      commands: executed.transaction.commands.map(normalizeCommand),
      changedObjects: executed.effects.changedObjects.map((change) => ({
        objectId: change.objectId,
        inputState: change.inputState,
        outputState: change.outputState,
        idOperation: change.idOperation,
      })),
    };
  }
}

function normalizeCommand(value: unknown): PublicationCommandAbi {
  const command = value as RawCommand;
  if (command.$kind === "Publish" && command.Publish) {
    return {
      kind: "publish",
      modules: command.Publish.modules.map(fromBase64),
      dependencies: command.Publish.dependencies,
    };
  }
  if (command.$kind === "MoveCall" && command.MoveCall) {
    return {
      kind: "moveCall",
      packageId: command.MoveCall.package,
      module: command.MoveCall.module,
      function: command.MoveCall.function,
      typeArguments: command.MoveCall.typeArguments,
      arguments: command.MoveCall.arguments.map(normalizeArgument),
    };
  }
  return { kind: "other" };
}

function normalizeArgument(value: unknown): TransactionArgumentAbi {
  const argument = value as RawArgument;
  if (argument.$kind === "Result" && typeof argument.Result === "number") {
    return { kind: "result", commandIndex: argument.Result };
  }
  if (argument.$kind === "NestedResult" && argument.NestedResult) {
    return {
      kind: "nestedResult",
      commandIndex: argument.NestedResult[0],
      resultIndex: argument.NestedResult[1],
    };
  }
  return { kind: "other" };
}

function normalizeDatatype(datatype: RawDatatype): MoveDatatypeAbi {
  return {
    name: datatype.name ?? "",
    kind: datatype.kind === 1 ? "struct" : datatype.kind === 2 ? "enum" : "unknown",
    abilities: datatype.abilities.map(normalizeAbility).sort(),
    typeParameterCount: datatype.typeParameters.length,
    fields: datatype.fields.map((field) => ({
      name: field.name ?? "",
      type: normalizeType(field.type),
    })),
    variants: datatype.variants.map((variant) => ({
      name: variant.name ?? "",
      fields: variant.fields.map((field) => ({
        name: field.name ?? "",
        type: normalizeType(field.type),
      })),
    })),
  };
}

function normalizeFunction(fn: RawFunction): MoveFunctionAbi {
  return {
    name: fn.name ?? "",
    visibility:
      fn.visibility === 2
        ? "public"
        : fn.visibility === 1
          ? "private"
          : fn.visibility === 3
            ? "friend"
            : "unknown",
    isEntry: fn.isEntry ?? false,
    typeParameterCount: fn.typeParameters.length,
    parameters: fn.parameters.map(normalizeSignature),
    returns: fn.returns.map(normalizeSignature),
  };
}

function normalizeSignature(signature: RawSignature): string {
  const body = normalizeType(signature.body);
  if (signature.reference === 1) return `&${body}`;
  if (signature.reference === 2) return `&mut ${body}`;
  return body;
}

function normalizeType(body: RawType | undefined): string {
  if (!body) throw new Error("Move ABI contains a signature without a type");
  switch (body.type) {
    case 1:
      return "address";
    case 2:
      return "bool";
    case 3:
      return "u8";
    case 4:
      return "u16";
    case 5:
      return "u32";
    case 6:
      return "u64";
    case 7:
      return "u128";
    case 8:
      return "u256";
    case 9: {
      const [element, ...extra] = body.typeParameterInstantiation;
      if (!element || extra.length !== 0) throw new Error("Move ABI contains an invalid vector type");
      return `vector<${normalizeType(element)}>`;
    }
    case 10:
      if (!body.typeName || body.typeParameterInstantiation.length !== 0) {
        throw new Error("Move ABI contains an unsupported datatype signature");
      }
      return body.typeName;
    default:
      throw new Error("Move ABI contains an unsupported signature type");
  }
}

function normalizeAbility(ability: number): string {
  switch (ability) {
    case 1:
      return "copy";
    case 2:
      return "drop";
    case 3:
      return "store";
    case 4:
      return "key";
    default:
      return "unknown";
  }
}

interface RawType {
  type?: number;
  typeName?: string;
  typeParameterInstantiation: RawType[];
}

interface RawField {
  name?: string;
  type?: RawType;
}

interface RawDatatype {
  name?: string;
  kind?: number;
  abilities: number[];
  typeParameters: unknown[];
  fields: RawField[];
  variants: Array<{ name?: string; fields: RawField[] }>;
}

interface RawSignature {
  reference?: number;
  body?: RawType;
}

interface RawFunction {
  name?: string;
  visibility?: number;
  isEntry?: boolean;
  typeParameters: unknown[];
  parameters: RawSignature[];
  returns: RawSignature[];
}

interface RawArgument {
  $kind?: string;
  Result?: number;
  NestedResult?: [number, number];
}

interface RawCommand {
  $kind?: string;
  Publish?: { modules: string[]; dependencies: string[] };
  MoveCall?: {
    package: string;
    module: string;
    function: string;
    typeArguments: string[];
    arguments: RawArgument[];
  };
}

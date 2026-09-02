import { describe, expect, test } from "bun:test";
import {
  packageArtifactSha256,
  RELEASE_NETWORKS,
  verifyReleaseDeployments,
} from "./release-readiness.js";
import type {
  MoveDatatypeAbi,
  MoveFunctionAbi,
  MoveModuleAbi,
  MovePackageAbi,
  PublicationTransactionAbi,
  ReleaseVerificationClient,
} from "./release-readiness.js";
import type { OriDeployments, OriNetwork } from "./deployments.js";

const MODULES = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];
const DEPENDENCIES = [`0x${"0".repeat(63)}1`];
const ARTIFACT_DIGEST = await packageArtifactSha256(MODULES, DEPENDENCIES);
const DEPLOYMENTS: OriDeployments = {
  mainnet: {
    packageId: `0x${"1".repeat(64)}`,
    publishTransactionDigest: "2FumWeQAu3uMgynnPHJu1NGfx2t5zprF3vrx12Wg4W9R",
    packageArtifactSha256: ARTIFACT_DIGEST,
  },
  testnet: {
    packageId: `0x${"2".repeat(64)}`,
    publishTransactionDigest: "4bi48n3Nxfk8qf7EdiQPfVdkTSonoR9FVdZBHJKwc29m",
    packageArtifactSha256: ARTIFACT_DIGEST,
  },
};

describe("on-chain release verification", () => {
  test("verifies fixed networks, audited publication, immutability, and exact ABI", async () => {
    const calls: Array<{ network: OriNetwork; endpoint: string; packageId: string; tx: string }> = [];
    await verifyReleaseDeployments(DEPLOYMENTS, (network, endpoint) => ({
      async getChainIdentifier() {
        return RELEASE_NETWORKS[network].chainIdentifier;
      },
      async getPackage(packageId) {
        calls.push({ network, endpoint, packageId, tx: DEPLOYMENTS[network].publishTransactionDigest });
        return validPackage(packageId);
      },
      async getPublicationTransaction(digest) {
        expect(digest).toBe(DEPLOYMENTS[network].publishTransactionDigest);
        return validPublication(DEPLOYMENTS[network]);
      },
    }));
    expect(calls).toHaveLength(2);
    expect(calls.find((call) => call.network === "mainnet")?.endpoint).toBe(
      RELEASE_NETWORKS.mainnet.endpoint,
    );
    expect(calls.find((call) => call.network === "testnet")?.endpoint).toBe(
      RELEASE_NETWORKS.testnet.endpoint,
    );
  });

  test("fails when a package is not found", async () => {
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) =>
      mockClient(network, network === "mainnet" ? null : validPackage(DEPLOYMENTS.testnet.packageId)),
    )).rejects.toThrow("was not found");
  });

  test("fails when the publication transaction is not found", async () => {
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) => ({
      ...mockClient(network, validPackage(DEPLOYMENTS[network].packageId)),
      async getPublicationTransaction() { return null; },
    }))).rejects.toThrow("publication transaction");
  });

  test("fails when an endpoint reports the wrong chain", async () => {
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) => ({
      ...mockClient(network, validPackage(DEPLOYMENTS[network].packageId)),
      async getChainIdentifier() { return "wrong-chain"; },
    }))).rejects.toThrow("unexpected chain identifier");
  });

  test("fails when a required module is missing", async () => {
    const broken = validPackage(DEPLOYMENTS.mainnet.packageId);
    broken.modules = broken.modules.filter((module) => module.name !== "confidentiality");
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) =>
      mockClient(network, network === "mainnet" ? broken : validPackage(DEPLOYMENTS.testnet.packageId)),
    )).rejects.toThrow("missing module confidentiality");
  });

  test("fails when a datatype ABI is mismatched", async () => {
    const broken = validPackage(DEPLOYMENTS.mainnet.packageId);
    requireDatatype(broken, "data", "WalrusBlob").fields[0] = { name: "blob_id", type: "u64" };
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) =>
      mockClient(network, network === "mainnet" ? broken : validPackage(DEPLOYMENTS.testnet.packageId)),
    )).rejects.toThrow("mismatched datatype WalrusBlob");
  });

  test("rejects a cross-product blob constructor", async () => {
    const broken = validPackage(DEPLOYMENTS.mainnet.packageId);
    requireModule(broken, "data").functions.push(fn("new_encrypted_blob", [], []));
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) =>
      mockClient(network, network === "mainnet" ? broken : validPackage(DEPLOYMENTS.testnet.packageId)),
    )).rejects.toThrow("unexpected public or entry functions");
  });

  test("rejects an extra entry function even when private", async () => {
    const broken = validPackage(DEPLOYMENTS.mainnet.packageId);
    requireModule(broken, "data").functions.push({
      ...fn("hidden_entry", [], []), visibility: "private", isEntry: true,
    });
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) =>
      mockClient(network, network === "mainnet" ? broken : validPackage(DEPLOYMENTS.testnet.packageId)),
    )).rejects.toThrow("unexpected public or entry functions");
  });

  test("rejects an unsafe confidentiality constructor", async () => {
    const broken = validPackage(DEPLOYMENTS.testnet.packageId);
    requireModule(broken, "confidentiality").functions.push(fn("from_raw", ["vector<u8>"], [
      `${DEPLOYMENTS.testnet.packageId}::confidentiality::Confidentiality`,
    ]));
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) =>
      mockClient(network, network === "testnet" ? broken : validPackage(DEPLOYMENTS.mainnet.packageId)),
    )).rejects.toThrow("unexpected public or entry functions");
  });

  test("allows additional private non-entry implementation helpers", async () => {
    const extended = validPackage(DEPLOYMENTS.mainnet.packageId);
    requireModule(extended, "data").functions.push({
      ...fn("validate_patch", [], []), visibility: "private",
    });
    await verifyReleaseDeployments(DEPLOYMENTS, (network) =>
      mockClient(network, network === "mainnet" ? extended : validPackage(DEPLOYMENTS.testnet.packageId)),
    );
  });

  test("rejects a v1 original package whose UpgradeCap survives", async () => {
    const transaction = validPublication(DEPLOYMENTS.mainnet);
    transaction.commands = transaction.commands.filter((command) => command.kind !== "moveCall");
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) => ({
      ...mockClient(network, validPackage(DEPLOYMENTS[network].packageId)),
      async getPublicationTransaction() {
        return network === "mainnet" ? transaction : validPublication(DEPLOYMENTS.testnet);
      },
    }))).rejects.toThrow("did not consume its UpgradeCap");
  });

  test("rejects make_immutable applied to a different command result", async () => {
    const transaction = validPublication(DEPLOYMENTS.mainnet);
    const call = transaction.commands[1];
    if (call?.kind !== "moveCall") throw new Error("Missing fixture call");
    call.arguments = [{ kind: "nestedResult", commandIndex: 2, resultIndex: 0 }];
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) => ({
      ...mockClient(network, validPackage(DEPLOYMENTS[network].packageId)),
      async getPublicationTransaction() {
        return network === "mainnet" ? transaction : validPublication(DEPLOYMENTS.testnet);
      },
    }))).rejects.toThrow("did not consume its UpgradeCap");
  });

  test("rejects publication bytecode that does not match the pinned artifact", async () => {
    const transaction = validPublication(DEPLOYMENTS.mainnet);
    const publish = transaction.commands[0];
    if (publish?.kind !== "publish") throw new Error("Missing fixture publish");
    publish.modules[0] = new Uint8Array([9]);
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) => ({
      ...mockClient(network, validPackage(DEPLOYMENTS[network].packageId)),
      async getPublicationTransaction() {
        return network === "mainnet" ? transaction : validPublication(DEPLOYMENTS.testnet);
      },
    }))).rejects.toThrow("does not match the audited package artifact");
  });

  test("rejects a transaction that did not create the configured package", async () => {
    const transaction = validPublication(DEPLOYMENTS.mainnet);
    transaction.changedObjects[0]!.objectId = DEPLOYMENTS.testnet.packageId;
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) => ({
      ...mockClient(network, validPackage(DEPLOYMENTS[network].packageId)),
      async getPublicationTransaction() {
        return network === "mainnet" ? transaction : validPublication(DEPLOYMENTS.testnet);
      },
    }))).rejects.toThrow("did not create the configured package");
  });

  test("fails closed on RPC errors", async () => {
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) => ({
      ...mockClient(network, validPackage(DEPLOYMENTS[network].packageId)),
      async getPackage() { throw new Error("transport unavailable"); },
    }))).rejects.toThrow("on-chain verification failed: transport unavailable");
  });

  test("fails closed when verification times out", async () => {
    await expect(verifyReleaseDeployments(DEPLOYMENTS, (network) => ({
      ...mockClient(network, validPackage(DEPLOYMENTS[network].packageId)),
      async getChainIdentifier() {
        if (network === "mainnet") await new Promise(() => {});
        return RELEASE_NETWORKS[network].chainIdentifier;
      },
    }), 10)).rejects.toThrow("Timed out verifying Ori mainnet deployment");
  });
});

function mockClient(network: OriNetwork, packageAbi: MovePackageAbi | null): ReleaseVerificationClient {
  return {
    async getChainIdentifier() { return RELEASE_NETWORKS[network].chainIdentifier; },
    async getPackage() { return packageAbi; },
    async getPublicationTransaction() { return validPublication(DEPLOYMENTS[network]); },
  };
}

function validPublication(deployment: OriDeployments[OriNetwork]): PublicationTransactionAbi {
  return {
    digest: deployment.publishTransactionDigest,
    success: true,
    commands: [
      { kind: "publish", modules: MODULES.map((module) => module.slice()), dependencies: [...DEPENDENCIES] },
      {
        kind: "moveCall",
        packageId: `0x${"0".repeat(63)}2`,
        module: "package",
        function: "make_immutable",
        typeArguments: [],
        arguments: [{ kind: "nestedResult", commandIndex: 0, resultIndex: 0 }],
      },
    ],
    changedObjects: [{
      objectId: deployment.packageId,
      inputState: "DoesNotExist",
      outputState: "PackageWrite",
      idOperation: "Created",
    }],
  };
}

function validPackage(packageId: string): MovePackageAbi {
  const confidentiality = `${packageId}::confidentiality::Confidentiality`;
  const blob = `${packageId}::data::WalrusBlob`;
  const quilt = `${packageId}::data::WalrusQuilt`;
  const patch = `${packageId}::data::WalrusQuiltPatch`;
  const vectorU8 = "vector<u8>";
  return {
    storageId: packageId, originalId: packageId, version: 1n,
    modules: [
      {
        name: "confidentiality",
        datatypes: [{
          name: "Confidentiality", kind: "enum", abilities: ["copy", "drop", "store"],
          typeParameterCount: 0, fields: [], variants: [
            { name: "Unencrypted", fields: [] },
            { name: "Encrypted", fields: [{ name: "sealed_dek", type: vectorU8 }] },
          ],
        }],
        functions: [
          fn("new_unencrypted", [], [confidentiality]),
          fn("new_encrypted", [vectorU8], [confidentiality]),
          fn("is_encrypted", [`&${confidentiality}`], ["bool"]),
          fn("sealed_dek", [`&${confidentiality}`], [`&${vectorU8}`]),
        ],
      },
      {
        name: "data",
        datatypes: [
          struct("WalrusBlob", [{ name: "blob_id", type: "u256" }, { name: "confidentiality", type: confidentiality }]),
          struct("WalrusQuilt", [{ name: "quilt_id", type: "u256" }]),
          struct("WalrusQuiltPatch", [{ name: "quilt_patch_id", type: vectorU8 }, { name: "confidentiality", type: confidentiality }]),
        ],
        functions: [
          fn("new_blob", ["u256", confidentiality], [blob]),
          fn("new_quilt", ["u256"], [quilt]),
          fn("new_quilt_patch", [vectorU8, confidentiality], [patch]),
          fn("blob_id", [`&${blob}`], ["u256"]),
          fn("blob_confidentiality", [`&${blob}`], [`&${confidentiality}`]),
          fn("quilt_id", [`&${quilt}`], ["u256"]),
          fn("quilt_patch_id", [`&${patch}`], [`&${vectorU8}`]),
          fn("quilt_patch_confidentiality", [`&${patch}`], [`&${confidentiality}`]),
        ],
      },
    ],
  };
}

function struct(name: string, fields: MoveDatatypeAbi["fields"]): MoveDatatypeAbi {
  return { name, kind: "struct", abilities: ["copy", "drop", "store"], typeParameterCount: 0, fields, variants: [] };
}
function fn(name: string, parameters: string[], returns: string[]): MoveFunctionAbi {
  return { name, visibility: "public", isEntry: false, typeParameterCount: 0, parameters, returns };
}
function requireModule(packageAbi: MovePackageAbi, name: string): MoveModuleAbi {
  const module = packageAbi.modules.find((candidate) => candidate.name === name);
  if (!module) throw new Error(`Missing fixture module ${name}`);
  return module;
}
function requireDatatype(packageAbi: MovePackageAbi, moduleName: string, name: string): MoveDatatypeAbi {
  const datatype = requireModule(packageAbi, moduleName).datatypes.find((candidate) => candidate.name === name);
  if (!datatype) throw new Error(`Missing fixture datatype ${name}`);
  return datatype;
}

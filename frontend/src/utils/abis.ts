import type { Abi } from "viem";
import jobMarketplaceArtifact from "../abi/JobMarketplace.json";
import mockErc20Artifact from "../abi/MockERC20.json";
import multisigArtifact from "../abi/Multisig.json";

export const jobMarketplaceAbi = jobMarketplaceArtifact.abi as Abi;
export const erc20Abi = mockErc20Artifact.abi as Abi;
export const multisigAbi = multisigArtifact.abi as Abi;

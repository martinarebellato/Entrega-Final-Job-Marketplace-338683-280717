import { ethers } from "hardhat";

function parseSigners(value: string): string[] {
  const signers = value
    .split(",")
    .map((signer) => signer.trim())
    .filter((signer) => signer.length > 0);

  if (signers.length === 0) {
    throw new Error("MULTISIG_SIGNERS must include at least one address");
  }

  for (const signer of signers) {
    if (!ethers.isAddress(signer)) {
      throw new Error(`Invalid signer address: ${signer}`);
    }
  }

  return signers;
}

function readMultisigConfig() {
  const signersValue = process.env.MULTISIG_SIGNERS;
  const thresholdValue = process.env.MULTISIG_THRESHOLD;

  if (!signersValue) {
    throw new Error("MULTISIG_SIGNERS is required");
  }

  if (!thresholdValue) {
    throw new Error("MULTISIG_THRESHOLD is required");
  }

  const signers = parseSigners(signersValue);
  const threshold = BigInt(thresholdValue);

  if (threshold === 0n || threshold > BigInt(signers.length)) {
    throw new Error("MULTISIG_THRESHOLD must be between 1 and the number of signers");
  }

  return { signers, threshold };
}

async function main() {
  const { signers, threshold } = readMultisigConfig();

  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = await MockERC20.deploy();
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();

  const Multisig = await ethers.getContractFactory("Multisig");
  const multisig = await Multisig.deploy(signers, threshold);
  await multisig.waitForDeployment();
  const multisigAddress = await multisig.getAddress();

  const JobMarketplace = await ethers.getContractFactory("JobMarketplace");
  const marketplace = await JobMarketplace.deploy(tokenAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();
  const marketplaceReceipt = await marketplace.deploymentTransaction()?.wait();
  const marketplaceDeployBlock = marketplaceReceipt?.blockNumber;

  console.log("Sepolia deploy complete");
  console.log("=======================");
  console.log("PAYMENT_TOKEN_ADDRESS=", tokenAddress);
  console.log("MULTISIG_ADDRESS=", multisigAddress);
  console.log("JOB_MARKETPLACE_ADDRESS=", marketplaceAddress);
  console.log("MARKETPLACE_DEPLOY_BLOCK=", marketplaceDeployBlock ?? "");
  console.log("");
  console.log("Copy into frontend/.env");
  console.log("=======================");
  console.log("VITE_WALLETCONNECT_PROJECT_ID=<your-walletconnect-project-id>");
  console.log(`VITE_JOB_MARKETPLACE_ADDRESS=${marketplaceAddress}`);
  console.log(`VITE_PAYMENT_TOKEN_ADDRESS=${tokenAddress}`);
  console.log(`VITE_MULTISIG_ADDRESS=${multisigAddress}`);
  console.log(`VITE_MARKETPLACE_DEPLOY_BLOCK=${marketplaceDeployBlock ?? ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

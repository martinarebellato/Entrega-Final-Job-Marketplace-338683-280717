import { ethers } from "hardhat";

function parseSigners(value: string): string[] {
  return value
    .split(",")
    .map((signer) => signer.trim())
    .filter((signer) => signer.length > 0);
}

async function main() {
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

  const Multisig = await ethers.getContractFactory("Multisig");
  const multisig = await Multisig.deploy(signers, threshold);

  await multisig.waitForDeployment();

  console.log("Multisig deployed to:", await multisig.getAddress());
  console.log("Signers:", signers.join(", "));
  console.log("Threshold:", threshold.toString());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

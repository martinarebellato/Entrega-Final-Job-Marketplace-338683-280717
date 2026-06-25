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

  if (threshold === 0n || threshold > BigInt(signers.length)) {
    throw new Error("MULTISIG_THRESHOLD must be between 1 and the number of signers");
  }

  const Multisig = await ethers.getContractFactory("Multisig");
  const multisig = await Multisig.deploy(signers, threshold);

  await multisig.waitForDeployment();
  const multisigAddress = await multisig.getAddress();

  console.log("Multisig deployed to:", multisigAddress);
  console.log("Signers:", signers.join(", "));
  console.log("Threshold:", threshold.toString());
  console.log("");
  console.log("Frontend .env value:");
  console.log(`VITE_MULTISIG_ADDRESS=${multisigAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { ethers } from "hardhat";

async function main() {
  const paymentTokenAddress = process.env.PAYMENT_TOKEN_ADDRESS;

  if (!paymentTokenAddress || !ethers.isAddress(paymentTokenAddress)) {
    throw new Error("PAYMENT_TOKEN_ADDRESS is required and must be a valid address");
  }

  const JobMarketplace = await ethers.getContractFactory("JobMarketplace");
  const marketplace = await JobMarketplace.deploy(paymentTokenAddress);

  await marketplace.waitForDeployment();
  const deploymentReceipt = await marketplace.deploymentTransaction()?.wait();
  const deployBlock = deploymentReceipt?.blockNumber;
  const marketplaceAddress = await marketplace.getAddress();

  console.log("JobMarketplace deployed to:", marketplaceAddress);
  console.log("Payment token:", paymentTokenAddress);
  console.log("MARKETPLACE_DEPLOY_BLOCK:", deployBlock ?? "unknown");
  console.log("");
  console.log("Frontend .env values:");
  console.log(`VITE_JOB_MARKETPLACE_ADDRESS=${marketplaceAddress}`);
  console.log(`VITE_PAYMENT_TOKEN_ADDRESS=${paymentTokenAddress}`);
  console.log(`VITE_MARKETPLACE_DEPLOY_BLOCK=${deployBlock ?? ""}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

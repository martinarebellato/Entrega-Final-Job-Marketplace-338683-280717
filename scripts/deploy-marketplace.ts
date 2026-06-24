import { ethers } from "hardhat";

async function main() {
  const paymentTokenAddress = process.env.PAYMENT_TOKEN_ADDRESS;

  if (!paymentTokenAddress) {
    throw new Error("PAYMENT_TOKEN_ADDRESS is required");
  }

  const JobMarketplace = await ethers.getContractFactory("JobMarketplace");
  const marketplace = await JobMarketplace.deploy(paymentTokenAddress);

  await marketplace.waitForDeployment();

  console.log("JobMarketplace deployed to:", await marketplace.getAddress());
  console.log("Payment token:", paymentTokenAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

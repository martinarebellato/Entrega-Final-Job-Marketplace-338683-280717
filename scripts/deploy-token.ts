import { ethers } from "hardhat";
import type { MockERC20 } from "../typechain-types";

async function main() {
  const MockERC20 = await ethers.getContractFactory("MockERC20");
  const token = (await MockERC20.deploy()) as unknown as MockERC20;

  await token.waitForDeployment();

  const tokenAddress = await token.getAddress();
  const initialSupply = await token.INITIAL_SUPPLY();

  console.log("MockERC20 deployed to:", tokenAddress);
  console.log("Initial supply minted to deployer:", ethers.formatUnits(initialSupply, 18), "MPT");
  console.log("");
  console.log("Root .env value:");
  console.log(`PAYMENT_TOKEN_ADDRESS=${tokenAddress}`);
  console.log("");
  console.log("Frontend .env value:");
  console.log(`VITE_PAYMENT_TOKEN_ADDRESS=${tokenAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

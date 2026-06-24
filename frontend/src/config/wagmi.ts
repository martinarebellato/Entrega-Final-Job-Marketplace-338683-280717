import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia } from "wagmi/chains";
import { WALLETCONNECT_PROJECT_ID } from "./contracts";

export const wagmiConfig = getDefaultConfig({
  appName: "Job Marketplace",
  projectId: WALLETCONNECT_PROJECT_ID || "missing-project-id",
  chains: [sepolia],
  ssr: false
});

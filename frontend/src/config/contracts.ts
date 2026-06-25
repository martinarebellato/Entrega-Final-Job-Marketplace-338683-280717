import { isAddress, type Address } from "viem";

function readAddress(key: string): Address | undefined {
  const value = import.meta.env[key] as string | undefined;

  if (!value || !isAddress(value)) {
    return undefined;
  }

  return value;
}

function readDeployBlock(): bigint | undefined {
  const value = import.meta.env.VITE_MARKETPLACE_DEPLOY_BLOCK as string | undefined;

  if (!value) {
    return undefined;
  }

  try {
    return BigInt(value);
  } catch {
    return undefined;
  }
}

export const JOB_MARKETPLACE_ADDRESS = readAddress("VITE_JOB_MARKETPLACE_ADDRESS");
export const PAYMENT_TOKEN_ADDRESS = readAddress("VITE_PAYMENT_TOKEN_ADDRESS");
export const MULTISIG_ADDRESS = readAddress("VITE_MULTISIG_ADDRESS");
export const MARKETPLACE_DEPLOY_BLOCK = readDeployBlock();
export const WALLETCONNECT_PROJECT_ID =
  (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string | undefined) ?? "";

export const configurationIssues = [
  !WALLETCONNECT_PROJECT_ID ? "Falta VITE_WALLETCONNECT_PROJECT_ID." : undefined,
  !JOB_MARKETPLACE_ADDRESS ? "Falta VITE_JOB_MARKETPLACE_ADDRESS o no es valida." : undefined,
  !PAYMENT_TOKEN_ADDRESS ? "Falta VITE_PAYMENT_TOKEN_ADDRESS o no es valida." : undefined,
  MARKETPLACE_DEPLOY_BLOCK === undefined
    ? "Falta VITE_MARKETPLACE_DEPLOY_BLOCK o no es un numero valido."
    : undefined
].filter((issue): issue is string => issue !== undefined);

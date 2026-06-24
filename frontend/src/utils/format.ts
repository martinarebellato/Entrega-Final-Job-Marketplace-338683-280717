import { formatUnits, isAddress, zeroAddress, type Address } from "viem";

export function shortAddress(address?: Address): string {
  if (!address || !isAddress(address)) {
    return "-";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function formatTokenAmount(value: bigint, decimals: number): string {
  return formatUnits(value, decimals);
}

export function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleString();
}

export function isZeroAddress(address: Address): boolean {
  return address.toLowerCase() === zeroAddress;
}

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address, Hex } from "viem";
import {
  JOB_MARKETPLACE_ADDRESS,
  MARKETPLACE_DEPLOY_BLOCK
} from "../config/contracts";
import { jobMarketplaceAbi } from "../utils/abis";

export interface JobCreatedEvent {
  jobId: bigint;
  client: Address;
  evaluator: Address;
  provider: Address;
  description: string;
  budget: bigint;
  expiresAt: bigint;
  transactionHash: Hex;
  logIndex: number;
}

interface JobCreatedArgs {
  jobId?: bigint;
  client?: Address;
  evaluator?: Address;
  provider?: Address;
  description?: string;
  budget?: bigint;
  expiresAt?: bigint;
}

interface JobCreatedLog {
  args: JobCreatedArgs;
  transactionHash: Hex;
  logIndex: number;
}

function hasJobCreatedArgs(args: JobCreatedArgs): args is Required<JobCreatedArgs> {
  return (
    args.jobId !== undefined &&
    args.client !== undefined &&
    args.evaluator !== undefined &&
    args.provider !== undefined &&
    args.description !== undefined &&
    args.budget !== undefined &&
    args.expiresAt !== undefined
  );
}

export function useJobs() {
  const publicClient = usePublicClient();
  const enabled =
    publicClient !== undefined &&
    JOB_MARKETPLACE_ADDRESS !== undefined &&
    MARKETPLACE_DEPLOY_BLOCK !== undefined;

  return useQuery({
    queryKey: ["jobs", JOB_MARKETPLACE_ADDRESS, MARKETPLACE_DEPLOY_BLOCK?.toString()],
    enabled,
    queryFn: async () => {
      if (!publicClient || !JOB_MARKETPLACE_ADDRESS || MARKETPLACE_DEPLOY_BLOCK === undefined) {
        return [];
      }

      const logs = (await publicClient.getContractEvents({
        address: JOB_MARKETPLACE_ADDRESS,
        abi: jobMarketplaceAbi,
        eventName: "JobCreated",
        fromBlock: MARKETPLACE_DEPLOY_BLOCK,
        toBlock: "latest"
      })) as JobCreatedLog[];

      return logs
        .filter((log) => hasJobCreatedArgs(log.args))
        .map((log): JobCreatedEvent => {
          const args = log.args as Required<JobCreatedArgs>;

          return {
            jobId: args.jobId,
            client: args.client,
            evaluator: args.evaluator,
            provider: args.provider,
            description: args.description,
            budget: args.budget,
            expiresAt: args.expiresAt,
            transactionHash: log.transactionHash,
            logIndex: log.logIndex
          };
        })
        .sort((left, right) => Number(right.jobId - left.jobId));
    }
  });
}

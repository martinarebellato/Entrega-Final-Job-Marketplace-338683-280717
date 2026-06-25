import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { JOB_MARKETPLACE_ADDRESS } from "../config/contracts";
import { jobMarketplaceAbi } from "../utils/abis";
import type { JobStatus } from "../utils/jobStatus";

export interface Job {
  client: Address;
  evaluator: Address;
  provider: Address;
  description: string;
  budget: bigint;
  expiresAt: bigint;
  status: JobStatus;
  deliverableRef: `0x${string}`;
}

type JobContractResult = readonly [
  Address,
  Address,
  Address,
  string,
  bigint,
  bigint,
  JobStatus,
  `0x${string}`
] & {
  client: Address;
  evaluator: Address;
  provider: Address;
  description: string;
  budget: bigint;
  expiresAt: bigint;
  status: JobStatus;
  deliverableRef: `0x${string}`;
};

export function useJob(jobId?: bigint) {
  const publicClient = usePublicClient();
  const enabled =
    publicClient !== undefined && JOB_MARKETPLACE_ADDRESS !== undefined && jobId !== undefined;

  return useQuery({
    queryKey: ["job", JOB_MARKETPLACE_ADDRESS, jobId?.toString()],
    enabled,
    queryFn: async (): Promise<Job | undefined> => {
      if (!publicClient || !JOB_MARKETPLACE_ADDRESS || jobId === undefined) {
        return undefined;
      }

      const job = (await publicClient.readContract({
        address: JOB_MARKETPLACE_ADDRESS,
        abi: jobMarketplaceAbi,
        functionName: "getJob",
        args: [jobId]
      })) as JobContractResult;

      return {
        client: job.client,
        evaluator: job.evaluator,
        provider: job.provider,
        description: job.description,
        budget: job.budget,
        expiresAt: job.expiresAt,
        status: job.status,
        deliverableRef: job.deliverableRef
      };
    }
  });
}

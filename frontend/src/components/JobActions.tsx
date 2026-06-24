import { useAccount } from "wagmi";
import type { Job } from "../hooks/useJob";
import { isZeroAddress } from "../utils/format";
import { JobStatus } from "../utils/jobStatus";

interface JobActionsProps {
  jobId: bigint;
  job: Job;
}

export function JobActions({ jobId, job }: JobActionsProps) {
  const { address } = useAccount();
  const normalizedAddress = address?.toLowerCase();
  const isClient = normalizedAddress === job.client.toLowerCase();
  const isProvider = normalizedAddress === job.provider.toLowerCase();
  const isEvaluator = normalizedAddress === job.evaluator.toLowerCase();
  const isExpired = Date.now() / 1000 > Number(job.expiresAt);
  const canAssignProvider = isClient && job.status === JobStatus.Open && isZeroAddress(job.provider);
  const canFund = isClient && job.status === JobStatus.Open;
  const canSubmit = isProvider && job.status === JobStatus.Funded;
  const canReview = isEvaluator && job.status === JobStatus.Submitted;
  const canRejectOpen = isClient && job.status === JobStatus.Open;
  const canClaimRefund =
    isExpired && (job.status === JobStatus.Funded || job.status === JobStatus.Submitted);

  return (
    <div className="actions-panel" data-job-id={jobId.toString()}>
      <button disabled={!canAssignProvider}>Asignar proveedor</button>
      <button disabled={!canFund}>Fondear trabajo</button>
      <button disabled={!canSubmit}>Enviar entrega</button>
      <button disabled={!canReview}>Aprobar</button>
      <button disabled={!canReview && !canRejectOpen}>Rechazar</button>
      <button disabled={!canClaimRefund}>Reclamar reembolso</button>
    </div>
  );
}

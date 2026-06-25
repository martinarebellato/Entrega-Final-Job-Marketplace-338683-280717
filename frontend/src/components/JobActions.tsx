import { useMemo, useState } from "react";
import { isAddress, keccak256, toBytes, type Address } from "viem";
import { useAccount } from "wagmi";
import type { Job } from "../hooks/useJob";
import { useJobActions } from "../hooks/useJobActions";
import { readDeliverableDraft, saveDeliverableDraft } from "../utils/deliverables";
import { isZeroAddress } from "../utils/format";
import { JobStatus } from "../utils/jobStatus";

interface JobActionsProps {
  jobId: bigint;
  job: Job;
}

function reasonHash(reason: string, fallback: string): `0x${string}` {
  const value = reason.trim() || fallback;
  return keccak256(toBytes(value));
}

export function JobActions({ jobId, job }: JobActionsProps) {
  const { address } = useAccount();
  const actions = useJobActions(jobId);
  const normalizedAddress = address?.toLowerCase();
  const isClient = normalizedAddress === job.client.toLowerCase();
  const isProvider = normalizedAddress === job.provider.toLowerCase();
  const isEvaluator = normalizedAddress === job.evaluator.toLowerCase();
  const isExpired = Date.now() / 1000 > Number(job.expiresAt);
  const canAssignProvider = isClient && job.status === JobStatus.Open && isZeroAddress(job.provider);
  const canFund = isClient && job.status === JobStatus.Open;
  const canRejectOpen = isClient && job.status === JobStatus.Open;
  const canSubmit = isProvider && job.status === JobStatus.Funded;
  const canReview = isEvaluator && job.status === JobStatus.Submitted;
  const canClaimRefund =
    isExpired && (job.status === JobStatus.Funded || job.status === JobStatus.Submitted);
  const hasVisibleAction =
    canAssignProvider || canFund || canRejectOpen || canSubmit || canReview || canClaimRefund;

  if (!address) {
    return <p className="muted">Conecta una wallet para ver acciones disponibles.</p>;
  }

  return (
    <section className="job-actions" data-job-id={jobId.toString()}>
      <h3>Acciones</h3>

      {!hasVisibleAction && <p className="muted">No hay acciones disponibles para esta wallet.</p>}

      {canAssignProvider && (
        <AssignProviderAction disabled={actions.isPending} onAssign={actions.setProvider} />
      )}

      {canFund && (
        <button type="button" disabled={actions.isPending} onClick={() => void actions.fund(job.budget)}>
          Fondear trabajo
        </button>
      )}

      {canRejectOpen && (
        <RejectAction
          disabled={actions.isPending}
          label="Rechazar trabajo"
          fallbackReason={`client-reject:${jobId.toString()}`}
          onReject={actions.reject}
        />
      )}

      {canSubmit && (
        <SubmitAction jobId={jobId} disabled={actions.isPending} onSubmit={actions.submit} />
      )}

      {canReview && (
        <ReviewAction
          disabled={actions.isPending}
          onComplete={actions.complete}
          onReject={actions.reject}
          jobId={jobId}
        />
      )}

      {canClaimRefund && (
        <button type="button" disabled={actions.isPending} onClick={() => void actions.claimRefund()}>
          Reclamar reembolso
        </button>
      )}

      {actions.state.message && (
        <p className={actions.state.status === "error" ? "error" : "success"}>
          {actions.state.message}
        </p>
      )}
    </section>
  );
}

function AssignProviderAction({
  disabled,
  onAssign
}: {
  disabled: boolean;
  onAssign: (provider: Address) => Promise<void>;
}) {
  const [provider, setProvider] = useState("");
  const [error, setError] = useState("");

  function submitProvider(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!isAddress(provider)) {
      setError("La direccion del proveedor no es valida.");
      return;
    }

    void onAssign(provider);
  }

  return (
    <form className="inline-form" onSubmit={submitProvider}>
      <input
        value={provider}
        onChange={(event) => setProvider(event.target.value)}
        placeholder="Proveedor 0x..."
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        Asignar proveedor
      </button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}

function SubmitAction({
  jobId,
  disabled,
  onSubmit
}: {
  jobId: bigint;
  disabled: boolean;
  onSubmit: (deliverableContent: string) => Promise<void>;
}) {
  const [content, setContent] = useState(() => readDeliverableDraft(jobId));
  const previewHash = useMemo(
    () => (content.trim() ? keccak256(toBytes(content.trim())) : undefined),
    [content]
  );

  function submitDeliverable(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveDeliverableDraft(jobId, content);
    void onSubmit(content);
  }

  return (
    <form className="stack-form" onSubmit={submitDeliverable}>
      <textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          saveDeliverableDraft(jobId, event.target.value);
        }}
        rows={4}
        placeholder="Contenido o referencia off-chain del deliverable"
        disabled={disabled}
      />
      {previewHash && <span className="hash">Ref: {previewHash}</span>}
      <button type="submit" disabled={disabled || !content.trim()}>
        Enviar entrega
      </button>
    </form>
  );
}

function ReviewAction({
  disabled,
  onComplete,
  onReject,
  jobId
}: {
  disabled: boolean;
  onComplete: (reason: `0x${string}`) => Promise<void>;
  onReject: (reason: `0x${string}`) => Promise<void>;
  jobId: bigint;
}) {
  const [reason, setReason] = useState("");

  return (
    <div className="stack-form">
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Razon o atestacion"
        disabled={disabled}
      />
      <div className="actions-panel">
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onComplete(reasonHash(reason, `approved:${jobId.toString()}`))}
        >
          Aprobar
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => void onReject(reasonHash(reason, `rejected:${jobId.toString()}`))}
        >
          Rechazar
        </button>
      </div>
    </div>
  );
}

function RejectAction({
  disabled,
  label,
  fallbackReason,
  onReject
}: {
  disabled: boolean;
  label: string;
  fallbackReason: string;
  onReject: (reason: `0x${string}`) => Promise<void>;
}) {
  const [reason, setReason] = useState("");

  return (
    <form
      className="inline-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onReject(reasonHash(reason, fallbackReason));
      }}
    >
      <input
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Razon"
        disabled={disabled}
      />
      <button type="submit" disabled={disabled}>
        {label}
      </button>
    </form>
  );
}

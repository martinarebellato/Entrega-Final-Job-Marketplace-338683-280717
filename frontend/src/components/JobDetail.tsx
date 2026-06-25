import { useJob } from "../hooks/useJob";
import { formatDate, formatTokenAmount } from "../utils/format";
import { DeliverablePanel } from "./DeliverablePanel";
import { JobActions } from "./JobActions";
import { MultisigPanel } from "./MultisigPanel";
import { StatusBadge } from "./StatusBadge";

export function JobDetail({ jobId }: { jobId?: bigint }) {
  const jobQuery = useJob(jobId);

  if (jobId === undefined) {
    return <section className="panel detail-panel empty-state">Selecciona un trabajo.</section>;
  }

  if (jobQuery.isLoading) {
    return <section className="panel detail-panel">Cargando detalle...</section>;
  }

  if (jobQuery.isError || !jobQuery.data) {
    return <section className="panel detail-panel error">No se pudo leer el trabajo.</section>;
  }

  const job = jobQuery.data;

  return (
    <section className="panel detail-panel">
      <div className="section-heading">
        <h2>Trabajo #{jobId.toString()}</h2>
        <StatusBadge status={job.status} />
      </div>
      <p className="description">{job.description}</p>
      <dl className="detail-grid">
        <div>
          <dt>Cliente</dt>
          <dd className="address">{job.client}</dd>
        </div>
        <div>
          <dt>Evaluador</dt>
          <dd className="address">{job.evaluator}</dd>
        </div>
        <div>
          <dt>Proveedor</dt>
          <dd className="address">{job.provider}</dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>{formatTokenAmount(job.budget, 18)} tokens</dd>
        </div>
        <div>
          <dt>Expira</dt>
          <dd>{formatDate(job.expiresAt)}</dd>
        </div>
        <div>
          <dt>Deliverable ref</dt>
          <dd className="hash">{job.deliverableRef}</dd>
        </div>
      </dl>
      <JobActions jobId={jobId} job={job} />
      <MultisigPanel jobId={jobId} job={job} />
      <DeliverablePanel jobId={jobId} deliverableRef={job.deliverableRef} />
    </section>
  );
}

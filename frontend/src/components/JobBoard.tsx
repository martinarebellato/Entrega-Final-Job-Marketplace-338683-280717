import type { JobCreatedEvent } from "../hooks/useJobs";
import { useJob } from "../hooks/useJob";
import { useJobs } from "../hooks/useJobs";
import { formatDate, formatTokenAmount, shortAddress } from "../utils/format";
import { StatusBadge } from "./StatusBadge";

interface JobBoardProps {
  selectedJobId?: bigint;
  onSelectJob: (jobId: bigint) => void;
}

export function JobBoard({ selectedJobId, onSelectJob }: JobBoardProps) {
  const jobsQuery = useJobs();

  if (jobsQuery.isLoading) {
    return <section className="panel">Cargando trabajos...</section>;
  }

  if (jobsQuery.isError) {
    return <section className="panel error">No se pudieron leer los eventos JobCreated.</section>;
  }

  const jobs = jobsQuery.data ?? [];

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Trabajos</h2>
        <span>{jobs.length}</span>
      </div>

      {jobs.length === 0 ? (
        <p className="empty-state">No hay trabajos creados para este contrato.</p>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <JobRow
              key={`${job.transactionHash}-${job.logIndex}`}
              job={job}
              isSelected={selectedJobId === job.jobId}
              onSelect={() => onSelectJob(job.jobId)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function JobRow({
  job,
  isSelected,
  onSelect
}: {
  job: JobCreatedEvent;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const jobQuery = useJob(job.jobId);

  return (
    <button className={`job-row ${isSelected ? "selected" : ""}`} onClick={onSelect}>
      <span className="job-row-title">#{job.jobId.toString()} {job.description}</span>
      {jobQuery.data ? (
        <StatusBadge status={jobQuery.data.status} />
      ) : (
        <span className="muted">Estado...</span>
      )}
      <span>{formatTokenAmount(job.budget, 18)} tokens</span>
      <span>Cliente {shortAddress(job.client)}</span>
      <span>Expira {formatDate(job.expiresAt)}</span>
    </button>
  );
}

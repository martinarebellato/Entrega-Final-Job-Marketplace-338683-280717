import { JobStatus, jobStatusLabels } from "../utils/jobStatus";

const statusClassNames: Record<JobStatus, string> = {
  [JobStatus.Open]: "status-open",
  [JobStatus.Funded]: "status-funded",
  [JobStatus.Submitted]: "status-submitted",
  [JobStatus.Completed]: "status-completed",
  [JobStatus.Rejected]: "status-rejected",
  [JobStatus.Expired]: "status-expired"
};

export function StatusBadge({ status }: { status: JobStatus }) {
  return (
    <span className={`status-badge ${statusClassNames[status]}`}>
      {jobStatusLabels[status]}
    </span>
  );
}

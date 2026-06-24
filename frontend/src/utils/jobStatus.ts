export enum JobStatus {
  Open,
  Funded,
  Submitted,
  Completed,
  Rejected,
  Expired
}

export const jobStatusLabels: Record<JobStatus, string> = {
  [JobStatus.Open]: "Open",
  [JobStatus.Funded]: "Funded",
  [JobStatus.Submitted]: "Submitted",
  [JobStatus.Completed]: "Completed",
  [JobStatus.Rejected]: "Rejected",
  [JobStatus.Expired]: "Expired"
};

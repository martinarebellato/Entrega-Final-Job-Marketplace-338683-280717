import { keccak256, toBytes } from "viem";

export function getDeliverableDraftKey(jobId: bigint): string {
  return `job-marketplace:deliverable:draft:${jobId.toString()}`;
}

export function getDeliverableContentKey(jobId: bigint, deliverableRef: `0x${string}`): string {
  return `job-marketplace:deliverable:content:${jobId.toString()}:${deliverableRef}`;
}

export function hashDeliverable(content: string): `0x${string}` {
  return keccak256(toBytes(content));
}

export function saveDeliverableDraft(jobId: bigint, content: string): void {
  localStorage.setItem(getDeliverableDraftKey(jobId), content);
}

export function readDeliverableDraft(jobId: bigint): string {
  return localStorage.getItem(getDeliverableDraftKey(jobId)) ?? "";
}

export function saveDeliverableContent(
  jobId: bigint,
  deliverableRef: `0x${string}`,
  content: string
): void {
  localStorage.setItem(getDeliverableContentKey(jobId, deliverableRef), content);
}

export function readDeliverableContent(jobId: bigint, deliverableRef: `0x${string}`): string {
  return localStorage.getItem(getDeliverableContentKey(jobId, deliverableRef)) ?? "";
}

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { encodeFunctionData, keccak256, toBytes, type Address, type Hex } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import {
  JOB_MARKETPLACE_ADDRESS,
  MULTISIG_ADDRESS
} from "../config/contracts";
import type { Job } from "../hooks/useJob";
import { getErrorMessage } from "../utils/errors";
import { jobMarketplaceAbi, multisigAbi } from "../utils/abis";
import { JobStatus } from "../utils/jobStatus";

interface MultisigPanelProps {
  jobId: bigint;
  job: Job;
}

interface MultisigInfo {
  signers: Address[];
  threshold: bigint;
  proposalCount: bigint;
  isConnectedSigner: boolean;
}

interface ProposalInfo {
  proposer: Address;
  destination: Address;
  value: bigint;
  data: Hex;
  approvals: bigint;
  executed: boolean;
  cancelled: boolean;
  connectedSignerApproved: boolean;
}

type ActionStatus = "idle" | "pending" | "success" | "error";

interface ActionState {
  status: ActionStatus;
  message: string;
}

const idleState: ActionState = {
  status: "idle",
  message: ""
};

function reasonHash(reason: string, jobId: bigint): Hex {
  return keccak256(toBytes(reason.trim() || `multisig-approved:${jobId.toString()}`));
}

function parseProposalId(value: string): bigint | undefined {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return undefined;
  }

  try {
    return BigInt(trimmedValue);
  } catch {
    return undefined;
  }
}

export function MultisigPanel({ jobId, job }: MultisigPanelProps) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [proposalIdInput, setProposalIdInput] = useState("");
  const [actionState, setActionState] = useState<ActionState>(idleState);

  const isMultisigJob =
    MULTISIG_ADDRESS !== undefined &&
    job.evaluator.toLowerCase() === MULTISIG_ADDRESS.toLowerCase();
  const proposalId = useMemo(() => parseProposalId(proposalIdInput), [proposalIdInput]);
  const isPending = actionState.status === "pending";

  const multisigQuery = useQuery({
    queryKey: ["multisig", MULTISIG_ADDRESS, address],
    enabled: isMultisigJob && publicClient !== undefined && MULTISIG_ADDRESS !== undefined,
    queryFn: async (): Promise<MultisigInfo> => {
      if (!publicClient || !MULTISIG_ADDRESS) {
        throw new Error("Falta configurar el Multisig.");
      }

      const [signers, threshold, proposalCount, isConnectedSigner] = await Promise.all([
        publicClient.readContract({
          address: MULTISIG_ADDRESS,
          abi: multisigAbi,
          functionName: "getSigners"
        }) as Promise<Address[]>,
        publicClient.readContract({
          address: MULTISIG_ADDRESS,
          abi: multisigAbi,
          functionName: "threshold"
        }) as Promise<bigint>,
        publicClient.readContract({
          address: MULTISIG_ADDRESS,
          abi: multisigAbi,
          functionName: "proposalCount"
        }) as Promise<bigint>,
        address
          ? (publicClient.readContract({
              address: MULTISIG_ADDRESS,
              abi: multisigAbi,
              functionName: "isSigner",
              args: [address]
            }) as Promise<boolean>)
          : Promise.resolve(false)
      ]);

      return {
        signers,
        threshold,
        proposalCount,
        isConnectedSigner
      };
    }
  });

  const proposalQuery = useQuery({
    queryKey: ["multisigProposal", MULTISIG_ADDRESS, proposalId?.toString(), address],
    enabled:
      isMultisigJob &&
      publicClient !== undefined &&
      MULTISIG_ADDRESS !== undefined &&
      proposalId !== undefined,
    queryFn: async (): Promise<ProposalInfo> => {
      if (!publicClient || !MULTISIG_ADDRESS || proposalId === undefined) {
        throw new Error("Falta indicar una propuesta.");
      }

      const [proposal, connectedSignerApproved] = await Promise.all([
        publicClient.readContract({
          address: MULTISIG_ADDRESS,
          abi: multisigAbi,
          functionName: "getProposal",
          args: [proposalId]
        }) as Promise<readonly [Address, Address, bigint, Hex, bigint, boolean, boolean]>,
        address
          ? (publicClient.readContract({
              address: MULTISIG_ADDRESS,
              abi: multisigAbi,
              functionName: "hasSignerApproved",
              args: [proposalId, address]
            }) as Promise<boolean>)
          : Promise.resolve(false)
      ]);

      return {
        proposer: proposal[0],
        destination: proposal[1],
        value: proposal[2],
        data: proposal[3],
        approvals: proposal[4],
        executed: proposal[5],
        cancelled: proposal[6],
        connectedSignerApproved
      };
    }
  });

  if (!isMultisigJob) {
    return null;
  }

  async function waitForHash(hash: Hex) {
    if (!publicClient) {
      throw new Error("No hay cliente público configurado.");
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      throw new Error("La transacción fue revertida.");
    }
  }

  async function refreshMultisigQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["multisig"] }),
      queryClient.invalidateQueries({ queryKey: ["multisigProposal"] }),
      queryClient.invalidateQueries({ queryKey: ["jobs"] }),
      queryClient.invalidateQueries({
        queryKey: ["job", JOB_MARKETPLACE_ADDRESS, jobId.toString()]
      })
    ]);
  }

  async function runAction(successMessage: string, action: () => Promise<void>) {
    try {
      if (!walletClient) {
        throw new Error("Conecta una wallet para ejecutar esta acción.");
      }

      if (!MULTISIG_ADDRESS || !JOB_MARKETPLACE_ADDRESS) {
        throw new Error("Falta configurar contratos.");
      }

      if (!multisigQuery.data?.isConnectedSigner) {
        throw new Error("La wallet conectada no es signer del Multisig.");
      }

      setActionState({ status: "pending", message: "Esperando confirmación..." });
      await action();
      await refreshMultisigQueries();
      setActionState({ status: "success", message: successMessage });
    } catch (error) {
      setActionState({ status: "error", message: getErrorMessage(error) });
    }
  }

  async function createApprovalProposal() {
    await runAction("Propuesta de aprobación creada.", async () => {
      if (job.status !== JobStatus.Submitted) {
        throw new Error("El trabajo debe estar Submitted para crear la propuesta.");
      }

      const nextProposalId = multisigQuery.data?.proposalCount;
      const data = encodeFunctionData({
        abi: jobMarketplaceAbi,
        functionName: "complete",
        args: [jobId, reasonHash(reason, jobId)]
      });

      const hash = await walletClient!.writeContract({
        address: MULTISIG_ADDRESS!,
        abi: multisigAbi,
        functionName: "createProposal",
        args: [JOB_MARKETPLACE_ADDRESS!, 0n, data]
      });

      await waitForHash(hash);

      if (nextProposalId !== undefined) {
        setProposalIdInput(nextProposalId.toString());
      }
    });
  }

  async function approveProposal() {
    await runAction("Propuesta aprobada.", async () => {
      if (proposalId === undefined) {
        throw new Error("Ingresa un ID de propuesta válido.");
      }

      const hash = await walletClient!.writeContract({
        address: MULTISIG_ADDRESS!,
        abi: multisigAbi,
        functionName: "approveProposal",
        args: [proposalId]
      });

      await waitForHash(hash);
    });
  }

  async function executeProposal() {
    await runAction("Propuesta ejecutada.", async () => {
      if (proposalId === undefined) {
        throw new Error("Ingresa un ID de propuesta válido.");
      }

      const hash = await walletClient!.writeContract({
        address: MULTISIG_ADDRESS!,
        abi: multisigAbi,
        functionName: "executeProposal",
        args: [proposalId]
      });

      await waitForHash(hash);
    });
  }

  return (
    <section className="multisig-panel">
      <h3>Multisig</h3>
      <dl className="detail-grid compact-grid">
        <div>
          <dt>Contrato</dt>
          <dd className="address">{MULTISIG_ADDRESS}</dd>
        </div>
        <div>
          <dt>Threshold</dt>
          <dd>
            {multisigQuery.data
              ? `${multisigQuery.data.threshold.toString()} de ${multisigQuery.data.signers.length}`
              : "Cargando..."}
          </dd>
        </div>
        <div>
          <dt>Propuestas</dt>
          <dd>{multisigQuery.data?.proposalCount.toString() ?? "Cargando..."}</dd>
        </div>
        <div>
          <dt>Wallet conectada</dt>
          <dd>{multisigQuery.data?.isConnectedSigner ? "Signer" : "No signer"}</dd>
        </div>
      </dl>

      {multisigQuery.data && (
        <div className="signer-list">
          <span className="muted">Signers</span>
          {multisigQuery.data.signers.map((signer) => (
            <code key={signer}>{signer}</code>
          ))}
        </div>
      )}

      <div className="stack-form">
        <label>
          Razón de aprobación
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Aprobado por multisig"
            disabled={isPending}
          />
        </label>
        <button
          type="button"
          disabled={isPending || !multisigQuery.data?.isConnectedSigner || job.status !== JobStatus.Submitted}
          onClick={() => void createApprovalProposal()}
        >
          Crear propuesta de aprobación
        </button>
      </div>

      <div className="inline-form">
        <input
          value={proposalIdInput}
          onChange={(event) => setProposalIdInput(event.target.value)}
          inputMode="numeric"
          placeholder="ID de propuesta"
          disabled={isPending}
        />
        <button
          type="button"
          disabled={isPending || !multisigQuery.data?.isConnectedSigner || proposalId === undefined}
          onClick={() => void approveProposal()}
        >
          Aprobar propuesta
        </button>
        <button
          type="button"
          disabled={isPending || !multisigQuery.data?.isConnectedSigner || proposalId === undefined}
          onClick={() => void executeProposal()}
        >
          Ejecutar
        </button>
      </div>

      {proposalQuery.data && (
        <dl className="detail-grid compact-grid">
          <div>
            <dt>Propuesta</dt>
            <dd>#{proposalId?.toString()}</dd>
          </div>
          <div>
            <dt>Aprobaciones</dt>
            <dd>
              {proposalQuery.data.approvals.toString()} /{" "}
              {multisigQuery.data?.threshold.toString() ?? "-"}
            </dd>
          </div>
          <div>
            <dt>Ejecutada</dt>
            <dd>{proposalQuery.data.executed ? "Sí" : "No"}</dd>
          </div>
          <div>
            <dt>Cancelada</dt>
            <dd>{proposalQuery.data.cancelled ? "Sí" : "No"}</dd>
          </div>
          <div>
            <dt>Tu aprobación</dt>
            <dd>{proposalQuery.data.connectedSignerApproved ? "Sí" : "No"}</dd>
          </div>
          <div>
            <dt>Destino</dt>
            <dd className="address">{proposalQuery.data.destination}</dd>
          </div>
        </dl>
      )}

      {proposalQuery.isError && proposalId !== undefined && (
        <p className="error">No se pudo leer la propuesta indicada.</p>
      )}

      {actionState.message && (
        <p className={actionState.status === "error" ? "error" : "success"}>
          {actionState.message}
        </p>
      )}
    </section>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Address, Hex } from "viem";
import { usePublicClient, useWalletClient } from "wagmi";
import { JOB_MARKETPLACE_ADDRESS, PAYMENT_TOKEN_ADDRESS } from "../config/contracts";
import { erc20Abi, jobMarketplaceAbi } from "../utils/abis";
import { hashDeliverable, saveDeliverableContent, saveDeliverableDraft } from "../utils/deliverables";
import { getErrorMessage } from "../utils/errors";

type ActionStatus = "idle" | "pending" | "success" | "error";

interface ActionState {
  status: ActionStatus;
  message: string;
}

const idleState: ActionState = {
  status: "idle",
  message: ""
};

interface ActionRunnerOptions {
  successMessage: string;
  action: () => Promise<void>;
}

export function useJobActions(jobId: bigint) {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const [state, setState] = useState<ActionState>(idleState);

  const isPending = state.status === "pending";

  async function waitForHash(hash: Hex) {
    if (!publicClient) {
      throw new Error("No hay cliente publico configurado.");
    }

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "reverted") {
      throw new Error("La transaccion fue revertida.");
    }
  }

  async function refreshQueries() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["jobs"] }),
      queryClient.invalidateQueries({ queryKey: ["job", JOB_MARKETPLACE_ADDRESS, jobId.toString()] })
    ]);
  }

  async function runAction({ successMessage, action }: ActionRunnerOptions) {
    try {
      if (!walletClient) {
        throw new Error("Conecta una wallet para ejecutar esta accion.");
      }

      if (!JOB_MARKETPLACE_ADDRESS) {
        throw new Error("Falta configurar la direccion del JobMarketplace.");
      }

      setState({ status: "pending", message: "Esperando confirmacion..." });
      await action();
      await refreshQueries();
      setState({ status: "success", message: successMessage });
    } catch (error) {
      setState({ status: "error", message: getErrorMessage(error) });
    }
  }

  async function setProvider(provider: Address) {
    await runAction({
      successMessage: "Proveedor asignado.",
      action: async () => {
        const hash = await walletClient!.writeContract({
          address: JOB_MARKETPLACE_ADDRESS!,
          abi: jobMarketplaceAbi,
          functionName: "setProvider",
          args: [jobId, provider]
        });
        await waitForHash(hash);
      }
    });
  }

  async function fund(budget: bigint) {
    await runAction({
      successMessage: "Trabajo fondeado.",
      action: async () => {
        if (!PAYMENT_TOKEN_ADDRESS) {
          throw new Error("Falta configurar la direccion del token ERC-20.");
        }

        setState({ status: "pending", message: "Aprobando token..." });
        const approveHash = await walletClient!.writeContract({
          address: PAYMENT_TOKEN_ADDRESS,
          abi: erc20Abi,
          functionName: "approve",
          args: [JOB_MARKETPLACE_ADDRESS!, budget]
        });
        await waitForHash(approveHash);

        setState({ status: "pending", message: "Fondeando trabajo..." });
        const fundHash = await walletClient!.writeContract({
          address: JOB_MARKETPLACE_ADDRESS!,
          abi: jobMarketplaceAbi,
          functionName: "fund",
          args: [jobId]
        });
        await waitForHash(fundHash);
      }
    });
  }

  async function submit(deliverableContent: string) {
    await runAction({
      successMessage: "Entrega enviada.",
      action: async () => {
        const trimmedContent = deliverableContent.trim();

        if (!trimmedContent) {
          throw new Error("El deliverable no puede estar vacio.");
        }

        const deliverableRef = hashDeliverable(trimmedContent);
        saveDeliverableDraft(jobId, trimmedContent);
        saveDeliverableContent(jobId, deliverableRef, trimmedContent);

        const hash = await walletClient!.writeContract({
          address: JOB_MARKETPLACE_ADDRESS!,
          abi: jobMarketplaceAbi,
          functionName: "submit",
          args: [jobId, deliverableRef]
        });
        await waitForHash(hash);
      }
    });
  }

  async function complete(reason: `0x${string}`) {
    await runAction({
      successMessage: "Trabajo aprobado.",
      action: async () => {
        const hash = await walletClient!.writeContract({
          address: JOB_MARKETPLACE_ADDRESS!,
          abi: jobMarketplaceAbi,
          functionName: "complete",
          args: [jobId, reason]
        });
        await waitForHash(hash);
      }
    });
  }

  async function reject(reason: `0x${string}`) {
    await runAction({
      successMessage: "Trabajo rechazado.",
      action: async () => {
        const hash = await walletClient!.writeContract({
          address: JOB_MARKETPLACE_ADDRESS!,
          abi: jobMarketplaceAbi,
          functionName: "reject",
          args: [jobId, reason]
        });
        await waitForHash(hash);
      }
    });
  }

  async function claimRefund() {
    await runAction({
      successMessage: "Reembolso reclamado.",
      action: async () => {
        const hash = await walletClient!.writeContract({
          address: JOB_MARKETPLACE_ADDRESS!,
          abi: jobMarketplaceAbi,
          functionName: "claimRefund",
          args: [jobId]
        });
        await waitForHash(hash);
      }
    });
  }

  return {
    state,
    isPending,
    setProvider,
    fund,
    submit,
    complete,
    reject,
    claimRefund
  };
}

import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { isAddress, parseUnits, zeroAddress } from "viem";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { JOB_MARKETPLACE_ADDRESS } from "../config/contracts";
import { jobMarketplaceAbi } from "../utils/abis";
import { getErrorMessage } from "../utils/errors";

interface CreateJobFormProps {
  disabled: boolean;
}

export function CreateJobForm({ disabled }: CreateJobFormProps) {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [evaluator, setEvaluator] = useState("");
  const [provider, setProvider] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [formError, setFormError] = useState("");
  const { data: hash, error, isPending, writeContract } = useWriteContract();

  const receipt = useWaitForTransactionReceipt({ hash });

  const transactionState = useMemo(() => {
    if (isPending) {
      return "Confirmando en wallet...";
    }

    if (receipt.isLoading) {
      return "Esperando confirmacion...";
    }

    if (receipt.isSuccess) {
      void queryClient.invalidateQueries({ queryKey: ["jobs"] });
      return "Trabajo creado.";
    }

    return "";
  }, [isPending, queryClient, receipt.isLoading, receipt.isSuccess]);

  function submitForm(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!JOB_MARKETPLACE_ADDRESS) {
      setFormError("Falta configurar la direccion del JobMarketplace.");
      return;
    }

    if (!isAddress(evaluator)) {
      setFormError("La direccion del evaluador no es valida.");
      return;
    }

    if (provider.trim() !== "" && !isAddress(provider)) {
      setFormError("La direccion del proveedor no es valida.");
      return;
    }

    const expirationSeconds = Math.floor(new Date(expiresAt).getTime() / 1000);

    if (!Number.isFinite(expirationSeconds) || expirationSeconds <= Math.floor(Date.now() / 1000)) {
      setFormError("La expiracion debe ser una fecha futura.");
      return;
    }

    try {
      writeContract({
        address: JOB_MARKETPLACE_ADDRESS,
        abi: jobMarketplaceAbi,
        functionName: "createJob",
        args: [
          description.trim(),
          parseUnits(budget, 18),
          evaluator,
          provider.trim() === "" ? zeroAddress : provider,
          BigInt(expirationSeconds)
        ]
      });
    } catch (submitError) {
      setFormError(getErrorMessage(submitError));
    }
  }

  return (
    <section className="panel">
      <h2>Publicar trabajo</h2>
      <form className="form-grid" onSubmit={submitForm}>
        <label>
          Descripcion
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            required
            disabled={disabled || isPending || receipt.isLoading}
          />
        </label>
        <label>
          Budget
          <input
            value={budget}
            onChange={(event) => setBudget(event.target.value)}
            inputMode="decimal"
            placeholder="100"
            required
            disabled={disabled || isPending || receipt.isLoading}
          />
        </label>
        <label>
          Evaluador
          <input
            value={evaluator}
            onChange={(event) => setEvaluator(event.target.value)}
            placeholder="0x..."
            required
            disabled={disabled || isPending || receipt.isLoading}
          />
        </label>
        <label>
          Proveedor
          <input
            value={provider}
            onChange={(event) => setProvider(event.target.value)}
            placeholder="0x..."
            disabled={disabled || isPending || receipt.isLoading}
          />
        </label>
        <label>
          Expira
          <input
            type="datetime-local"
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            required
            disabled={disabled || isPending || receipt.isLoading}
          />
        </label>
        <button type="submit" disabled={disabled || isPending || receipt.isLoading}>
          Crear
        </button>
      </form>
      {(formError || error) && <p className="error">{formError || getErrorMessage(error)}</p>}
      {transactionState && <p className="success">{transactionState}</p>}
    </section>
  );
}

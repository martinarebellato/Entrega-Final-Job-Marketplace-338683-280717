import { useAccount, useBalance, useBlockNumber } from "wagmi";
import { sepolia } from "wagmi/chains";
import { shortAddress } from "../utils/format";

export function AccountPanel() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address, chainId: sepolia.id });
  const { data: blockNumber } = useBlockNumber({ chainId: sepolia.id, watch: true });

  if (!isConnected || !address) {
    return <section className="panel muted">Conecta una wallet para operar.</section>;
  }

  return (
    <section className="panel account-grid">
      <div>
        <span>Wallet</span>
        <strong>{shortAddress(address)}</strong>
      </div>
      <div>
        <span>Balance</span>
        <strong>
          {balance ? `${Number(balance.formatted).toFixed(4)} ${balance.symbol}` : "Cargando"}
        </strong>
      </div>
      <div>
        <span>Bloque</span>
        <strong>{blockNumber ? blockNumber.toString() : "Cargando"}</strong>
      </div>
    </section>
  );
}

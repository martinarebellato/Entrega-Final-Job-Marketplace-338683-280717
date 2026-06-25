import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useState } from "react";
import { AccountPanel } from "./components/AccountPanel";
import { CreateJobForm } from "./components/CreateJobForm";
import { JobBoard } from "./components/JobBoard";
import { JobDetail } from "./components/JobDetail";
import { configurationIssues } from "./config/contracts";

function App() {
  const [selectedJobId, setSelectedJobId] = useState<bigint | undefined>();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>Job Marketplace</h1>
          <p>Sepolia escrow marketplace</p>
        </div>
        <ConnectButton showBalance={false} />
      </header>

      {configurationIssues.length > 0 && (
        <section className="notice" role="status">
          <strong>Configuracion pendiente</strong>
          {configurationIssues.map((issue) => (
            <span key={issue}>{issue}</span>
          ))}
        </section>
      )}

      <AccountPanel />

      <section className="workspace">
        <div className="left-column">
          <CreateJobForm disabled={configurationIssues.length > 0} />
          <JobBoard selectedJobId={selectedJobId} onSelectJob={setSelectedJobId} />
        </div>
        <JobDetail jobId={selectedJobId} />
      </section>
    </main>
  );
}

export default App;

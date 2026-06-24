import { useMemo, useState } from "react";

interface DeliverablePanelProps {
  jobId: bigint;
  deliverableRef: `0x${string}`;
}

export function DeliverablePanel({ jobId, deliverableRef }: DeliverablePanelProps) {
  const storageKey = useMemo(() => `job-marketplace:deliverable:${jobId.toString()}`, [jobId]);
  const [content, setContent] = useState(() => localStorage.getItem(storageKey) ?? "");
  const [saved, setSaved] = useState(false);

  function saveDeliverable() {
    localStorage.setItem(storageKey, content);
    setSaved(true);
  }

  return (
    <section className="deliverable-panel">
      <h3>Deliverable local</h3>
      <p className="hash">{deliverableRef}</p>
      <textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          setSaved(false);
        }}
        rows={5}
      />
      <button type="button" onClick={saveDeliverable}>
        Guardar local
      </button>
      {saved && <span className="success">Guardado en este navegador.</span>}
    </section>
  );
}

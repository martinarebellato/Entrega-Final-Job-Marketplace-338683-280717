import { useEffect, useMemo, useState } from "react";
import {
  hashDeliverable,
  readDeliverableContent,
  readDeliverableDraft,
  saveDeliverableContent,
  saveDeliverableDraft
} from "../utils/deliverables";

interface DeliverablePanelProps {
  jobId: bigint;
  deliverableRef: `0x${string}`;
}

export function DeliverablePanel({ jobId, deliverableRef }: DeliverablePanelProps) {
  const storedSubmittedContent = useMemo(
    () => readDeliverableContent(jobId, deliverableRef),
    [deliverableRef, jobId]
  );
  const [content, setContent] = useState(() => storedSubmittedContent || readDeliverableDraft(jobId));
  const [saved, setSaved] = useState(false);
  const previewRef = content.trim() ? hashDeliverable(content.trim()) : undefined;

  useEffect(() => {
    setContent(storedSubmittedContent || readDeliverableDraft(jobId));
    setSaved(false);
  }, [jobId, storedSubmittedContent]);

  function saveDeliverable() {
    saveDeliverableDraft(jobId, content);

    if (previewRef) {
      saveDeliverableContent(jobId, previewRef, content);
    }

    setSaved(true);
  }

  return (
    <section className="deliverable-panel">
      <h3>Deliverable local</h3>
      <p className="hash">{deliverableRef}</p>
      {previewRef && <p className="hash">Hash local: {previewRef}</p>}
      <textarea
        value={content}
        onChange={(event) => {
          setContent(event.target.value);
          saveDeliverableDraft(jobId, event.target.value);
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

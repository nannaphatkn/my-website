import { AlertTriangle } from "lucide-react";

export default function ConfirmDialog({ open, title, body, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="dialogBackdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <div className="dialogIcon">
          <AlertTriangle size={22} />
        </div>
        <h2 id="confirm-title">{title}</h2>
        <p>{body}</p>
        <div className="dialogActions">
          <button className="button secondary" onClick={onCancel} type="button">
            Cancel
          </button>
          <button className="button danger" onClick={onConfirm} type="button">
            Confirm Delete
          </button>
        </div>
      </section>
    </div>
  );
}

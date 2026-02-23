import { useState, useEffect, useRef } from 'react';
import { AlertTriangle, X, Trash2, Loader2 } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  leadName: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function DeleteConfirmModal({ isOpen, leadName, onConfirm, onCancel }: DeleteConfirmModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setDeleting(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !deleting) onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onCancel, deleting]);

  if (!isOpen) return null;

  const canDelete = confirmText === 'DELETE';

  const handleConfirm = async () => {
    if (!canDelete || deleting) return;
    setDeleting(true);
    try {
      await onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => !deleting && onCancel()}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md animate-modal-in border border-gray-200">
        <button
          onClick={() => !deleting && onCancel()}
          disabled={deleting}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
        >
          <X size={18} />
        </button>

        <div className="p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full bg-red-50 border border-red-100 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={22} className="text-red-500" />
            </div>
            <div>
              <h2 className="font-heading text-lg text-gray-900">Delete Lead</h2>
              <p className="font-body text-sm text-gray-500 mt-0.5">This action cannot be undone</p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-100 rounded-xl p-4 mb-5">
            <p className="font-body text-sm text-red-700">
              This will permanently delete the lead{' '}
              <span className="font-semibold text-red-800">"{leadName}"</span>{' '}
              and remove it from GoHighLevel. This action cannot be undone.
            </p>
          </div>

          <div className="mb-5">
            <label className="block font-body text-sm font-medium text-gray-700 mb-2">
              Type <span className="font-mono font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">DELETE</span> to confirm
            </label>
            <input
              ref={inputRef}
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirm()}
              placeholder="Type DELETE to confirm"
              disabled={deleting}
              className={`w-full font-body text-sm border rounded-lg px-4 py-3 focus:outline-none focus:ring-2 transition-colors disabled:opacity-50 ${
                confirmText && !canDelete
                  ? 'border-red-300 focus:ring-red-200 bg-red-50/30'
                  : canDelete
                  ? 'border-green-300 focus:ring-green-200 bg-green-50/30'
                  : 'border-gray-300 focus:ring-blue-200'
              }`}
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => !deleting && onCancel()}
              disabled={deleting}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-body font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canDelete || deleting}
              className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-body font-medium text-sm transition-all ${
                canDelete && !deleting
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm shadow-red-200 cursor-pointer'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              {deleting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 size={15} />
                  Delete Lead
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

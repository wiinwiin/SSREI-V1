import { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface ToastProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

export function Toast({ message, type, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className={`fixed bottom-6 right-6 z-50 flex items-start gap-3 px-5 py-4 rounded-xl shadow-xl border max-w-sm animate-slide-up font-body ${
      type === 'success'
        ? 'bg-white border-green-200 text-green-800'
        : 'bg-white border-red-200 text-red-800'
    }`}>
      {type === 'success' ? (
        <CheckCircle size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
      ) : (
        <XCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
      )}
      <p className="text-sm flex-1">{message}</p>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 flex-shrink-0">
        <X size={16} />
      </button>
    </div>
  );
}

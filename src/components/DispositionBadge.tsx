import { Disposition } from '../types';

const styles: Record<Disposition, string> = {
  'Customer Reached': 'bg-green-100 text-green-700 border-green-200',
  'No Answer': 'bg-gray-100 text-gray-500 border-gray-200',
  'Left Voicemail': 'bg-sky-100 text-sky-700 border-sky-200',
  'Callback Requested': 'bg-blue-100 text-blue-700 border-blue-200',
  'Follow Up': 'bg-blue-100 text-blue-700 border-blue-200',
  'Not Interested': 'bg-gray-100 text-gray-600 border-gray-200',
  'Wrong Number': 'bg-orange-100 text-orange-700 border-orange-200',
  'Bad Email': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  'DNC': 'bg-red-100 text-red-700 border-red-200',
};

export function DispositionBadge({ disposition }: { disposition: Disposition }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-body font-medium border ${styles[disposition] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {disposition}
    </span>
  );
}

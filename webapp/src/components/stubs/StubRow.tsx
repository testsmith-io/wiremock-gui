import type { StubMapping } from '../../types/wiremock';
import { MethodBadge, StatusBadge } from '../shared/badges';
import { getUrl } from '../../utils/stub';

export function StubRow({
  mapping: m,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
  canWrite,
}: {
  mapping: StubMapping;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  canWrite: boolean;
}) {
  return (
    <tr
      onClick={onSelect}
      className={`border-b border-gray-100 cursor-pointer transition-colors ${
        isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'
      }`}
    >
      <td className="px-4 py-2.5">
        <MethodBadge method={m.request?.method} />
      </td>
      <td className="px-4 py-2.5 font-mono text-xs truncate max-w-xs" title={getUrl(m)}>
        {getUrl(m)}
      </td>
      <td className="px-4 py-2.5">
        <StatusBadge status={m.response?.status} />
      </td>
      <td className="px-4 py-2.5 text-gray-600 truncate max-w-[150px]" title={m.name || m.id}>
        {m.name || <span className="text-gray-300 text-xs">{m.id?.slice(0, 8)}</span>}
      </td>
      <td className="px-4 py-2.5 text-gray-500">
        {m.priority || '-'}
      </td>
      {canWrite && (
        <td className="px-4 py-2.5 text-right">
          <button
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="text-brand-500 hover:text-brand-700 text-xs mr-2"
          >
            Edit
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="text-red-600 hover:text-red-800 text-xs"
          >
            Delete
          </button>
        </td>
      )}
    </tr>
  );
}

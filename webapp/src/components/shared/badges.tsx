export function MethodBadge({ method }: { method?: string }) {
  const m = (method || 'ANY').toUpperCase();
  const cls =
    m === 'GET' ? 'badge-get' :
    m === 'POST' ? 'badge-post' :
    m === 'PUT' ? 'badge-put' :
    m === 'DELETE' ? 'badge-delete' :
    m === 'PATCH' ? 'badge-patch' :
    'badge-any';
  return <span className={cls}>{m}</span>;
}

export function StatusBadge({ status }: { status?: number }) {
  if (!status) return <span className="text-gray-400 text-xs">-</span>;
  const cls =
    status < 300 ? 'text-green-700 bg-green-50' :
    status < 400 ? 'text-amber-700 bg-amber-50' :
    status < 500 ? 'text-orange-700 bg-orange-50' :
    'text-red-700 bg-red-50';
  return <span className={`badge ${cls}`}>{status}</span>;
}

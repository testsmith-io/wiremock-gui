import { useState, useEffect, useCallback } from 'react';
import { useWireMock } from '../App';
import { useAuth } from '../auth/AuthContext';
import type { LoggedRequest } from '../types/wiremock';
import { MethodBadge, StatusBadge } from './shared/badges';
import { formatDate, tryFormatJson } from '../utils/formatting';

type ViewMode = 'all' | 'unmatched';

export function RequestJournal() {
  const { client } = useWireMock();
  const { canWrite } = useAuth();
  const [requests, setRequests] = useState<LoggedRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selected, setSelected] = useState<LoggedRequest | null>(null);
  const [limit, setLimit] = useState(50);
  const [journalDisabled, setJournalDisabled] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = viewMode === 'all'
        ? await client.getAllRequests(limit)
        : await client.getUnmatchedRequests();
      setRequests(data.requests || []);
      setTotal(data.meta?.total ?? 0);
      setJournalDisabled(!!data.requestJournalDisabled);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [client, viewMode, limit]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const handleClearAll = async () => {
    if (!confirm('Delete all requests from the journal?')) return;
    try {
      await client.deleteAllRequests();
      await loadRequests();
      setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Clear failed');
    }
  };

  const handleDeleteOne = async (id: string) => {
    try {
      await client.deleteRequest(id);
      await loadRequests();
      if (selected?.id === id) setSelected(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  if (journalDisabled) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-700">Request Journal Disabled</h2>
          <p className="text-sm text-gray-500 mt-1">
            The request journal is disabled on this WireMock server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Left: list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Request Journal</h2>
            <p className="text-sm text-gray-500">
              {total} request{total !== 1 ? 's' : ''} logged
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value))}
              className="select text-sm w-24"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
            <button onClick={loadRequests} className="btn-secondary">Refresh</button>
            {canWrite && <button onClick={handleClearAll} className="btn-danger">Clear All</button>}
          </div>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => setViewMode('all')}
            className={`btn text-xs ${viewMode === 'all' ? 'bg-brand-100 text-brand-700 border border-brand-200' : 'btn-secondary'}`}
          >
            All Requests
          </button>
          <button
            onClick={() => setViewMode('unmatched')}
            className={`btn text-xs ${viewMode === 'unmatched' ? 'bg-amber-100 text-amber-800 border border-amber-200' : 'btn-secondary'}`}
          >
            Unmatched Only
          </button>
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            No requests logged
          </div>
        ) : (
          <div className="card overflow-hidden flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Time</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Method</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">URL</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Response</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Matched</th>
                  {canWrite && <th className="text-right px-4 py-2 font-medium text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className={`border-b border-gray-100 cursor-pointer transition-colors ${
                      selected?.id === r.id ? 'bg-brand-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                      {formatDate(r.request.loggedDateString)}
                    </td>
                    <td className="px-4 py-2.5">
                      <MethodBadge method={r.request.method} />
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs truncate max-w-xs" title={r.request.url}>
                      {r.request.url}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={r.responseDefinition?.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      {r.responseDefinition?.fromConfiguredStub === false ? (
                        <span className="badge bg-amber-100 text-amber-800">No</span>
                      ) : (
                        <span className="badge bg-green-100 text-green-800">Yes</span>
                      )}
                    </td>
                    {canWrite && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteOne(r.id); }}
                          className="text-red-600 hover:text-red-800 text-xs"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="w-[450px] flex-shrink-0 card p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Request Detail</h3>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
          </div>
          <div className="space-y-3">
            <div>
              <span className="label">ID</span>
              <p className="text-xs font-mono text-gray-600">{selected.id}</p>
            </div>
            <div>
              <span className="label">Time</span>
              <p className="text-sm text-gray-700">{selected.request.loggedDateString}</p>
            </div>
            <div>
              <span className="label">Method & URL</span>
              <p className="text-sm font-mono break-all">
                <span className="font-bold">{selected.request.method}</span>{' '}
                {selected.request.absoluteUrl || selected.request.url}
              </p>
            </div>
            {selected.request.clientIp && (
              <div>
                <span className="label">Client IP</span>
                <p className="text-sm text-gray-700">{selected.request.clientIp}</p>
              </div>
            )}
            <div>
              <span className="label">Request Headers</span>
              <div className="text-xs bg-gray-50 p-2 rounded-md max-h-40 overflow-auto">
                {Object.entries(selected.request.headers || {}).map(([k, v]) => (
                  <div key={k} className="flex gap-2 py-0.5">
                    <span className="font-semibold text-gray-600 shrink-0">{k}:</span>
                    <span className="text-gray-700 break-all">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            {selected.request.body && (
              <div>
                <span className="label">Request Body</span>
                <pre className="text-xs bg-gray-50 p-2 rounded-md overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                  {tryFormatJson(selected.request.body)}
                </pre>
              </div>
            )}
            <div>
              <span className="label">Response Status</span>
              <p className="text-sm">
                <StatusBadge status={selected.responseDefinition?.status} />
                {selected.responseDefinition?.fromConfiguredStub === false && (
                  <span className="ml-2 text-xs text-amber-600">(unmatched - default response)</span>
                )}
              </p>
            </div>
            {selected.responseDefinition?.headers && (
              <div>
                <span className="label">Response Headers</span>
                <div className="text-xs bg-gray-50 p-2 rounded-md max-h-32 overflow-auto">
                  {Object.entries(selected.responseDefinition.headers).map(([k, v]) => (
                    <div key={k} className="flex gap-2 py-0.5">
                      <span className="font-semibold text-gray-600 shrink-0">{k}:</span>
                      <span className="text-gray-700 break-all">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selected.responseDefinition?.body && (
              <div>
                <span className="label">Response Body</span>
                <pre className="text-xs bg-gray-50 p-2 rounded-md overflow-auto max-h-48 font-mono whitespace-pre-wrap">
                  {tryFormatJson(selected.responseDefinition.body)}
                </pre>
              </div>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(JSON.stringify(selected, null, 2))}
              className="btn-secondary flex-1"
            >
              Copy JSON
            </button>
            {canWrite && (
              <button
                onClick={() => handleDeleteOne(selected.id)}
                className="btn-danger flex-1"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


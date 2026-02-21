import { useState, useEffect, useCallback } from 'react';
import { useWireMock } from '../App';
import type { RecordingStatus, StubMapping } from '../types/wiremock';

export function Recordings() {
  const { client } = useWireMock();
  const [status, setStatus] = useState<RecordingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [recordedMappings, setRecordedMappings] = useState<StubMapping[]>([]);
  const [operating, setOperating] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const s = await client.getRecordingStatus();
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to get recording status');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleStart = async () => {
    if (!targetUrl.trim()) {
      setError('Please enter a target base URL');
      return;
    }
    setOperating(true);
    setError('');
    try {
      await client.startRecording(targetUrl.trim());
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start recording');
    } finally {
      setOperating(false);
    }
  };

  const handleStop = async () => {
    setOperating(true);
    setError('');
    try {
      const result = await client.stopRecording();
      setRecordedMappings(result.mappings || []);
      await loadStatus();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to stop recording');
    } finally {
      setOperating(false);
    }
  };

  const handleSnapshot = async () => {
    setOperating(true);
    setError('');
    try {
      const result = await client.snapshotRecording();
      setRecordedMappings(result.mappings || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Snapshot failed');
    } finally {
      setOperating(false);
    }
  };

  const isRecording = status?.status === 'Recording';
  const statusColor = isRecording ? 'text-red-600' : 'text-gray-600';
  const statusBg = isRecording ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200';

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Recordings</h2>
          <p className="text-sm text-gray-500">Record and playback API traffic as stub mappings</p>
        </div>
        <button onClick={loadStatus} className="btn-secondary">Refresh</button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
      ) : (
        <div className="space-y-4">
          {/* Status */}
          <div className={`card p-4 border ${statusBg}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
              <div>
                <h3 className={`font-semibold ${statusColor}`}>
                  {status?.status === 'NeverStarted' ? 'Never Started' : status?.status || 'Unknown'}
                </h3>
                <p className="text-xs text-gray-500">
                  {isRecording
                    ? 'Recording API traffic to create stub mappings...'
                    : 'Not recording. Start recording to capture API traffic.'}
                </p>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Recording Controls</h3>
            {!isRecording ? (
              <div>
                <label className="label">Target Base URL</label>
                <div className="flex gap-2">
                  <input
                    value={targetUrl}
                    onChange={(e) => setTargetUrl(e.target.value)}
                    placeholder="https://api.example.com"
                    className="input flex-1 font-mono"
                  />
                  <button
                    onClick={handleStart}
                    className="btn-danger"
                    disabled={operating}
                  >
                    {operating ? 'Starting...' : 'Start Recording'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  WireMock will proxy requests to this URL and record the responses as stub mappings.
                </p>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={handleStop}
                  className="btn-primary"
                  disabled={operating}
                >
                  {operating ? 'Stopping...' : 'Stop Recording'}
                </button>
                <button
                  onClick={handleSnapshot}
                  className="btn-secondary"
                  disabled={operating}
                >
                  Take Snapshot
                </button>
              </div>
            )}
          </div>

          {/* Recorded mappings */}
          {recordedMappings.length > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Recorded Mappings ({recordedMappings.length})
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {recordedMappings.map((m, i) => (
                  <div key={m.id || i} className="p-3 bg-gray-50 rounded-md">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`badge ${getBadgeClass(m.request?.method)}`}>
                        {m.request?.method || 'ANY'}
                      </span>
                      <span className="font-mono text-xs text-gray-700 truncate">
                        {m.request?.url || m.request?.urlPath || '(any)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>Response: {m.response?.status || '?'}</span>
                      {m.name && <span>- {m.name}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getBadgeClass(method?: string): string {
  switch ((method || '').toUpperCase()) {
    case 'GET': return 'badge-get';
    case 'POST': return 'badge-post';
    case 'PUT': return 'badge-put';
    case 'DELETE': return 'badge-delete';
    case 'PATCH': return 'badge-patch';
    default: return 'badge-any';
  }
}

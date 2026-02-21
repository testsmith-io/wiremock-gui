import { useState, useEffect, useCallback } from 'react';
import { useWireMock } from '../App';

export function SystemInfo() {
  const { client, health, refreshHealth } = useWireMock();
  const [error, setError] = useState('');
  const [fixedDelay, setFixedDelay] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState('');

  const loadFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const f = await client.getAllFiles();
      setFiles(f || []);
    } catch {
      // Files endpoint may not be available
      setFiles([]);
    } finally {
      setLoadingFiles(false);
    }
  }, [client]);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const handleViewFile = async (name: string) => {
    try {
      const content = await client.getFile(name);
      setSelectedFile(name);
      setFileContent(content);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load file');
    }
  };

  const handleDeleteFile = async (name: string) => {
    if (!confirm(`Delete file "${name}"?`)) return;
    try {
      await client.deleteFile(name);
      await loadFiles();
      if (selectedFile === name) {
        setSelectedFile(null);
        setFileContent('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleUpdateSettings = async () => {
    setError('');
    try {
      const settings: Record<string, unknown> = {};
      if (fixedDelay) settings.fixedDelay = parseInt(fixedDelay, 10);
      await client.updateGlobalSettings(settings);
      alert('Settings updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update settings failed');
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset all mappings and the request journal to defaults? This cannot be undone.')) return;
    try {
      await client.resetAll();
      refreshHealth();
      alert('Reset complete.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  const handleShutdown = async () => {
    if (!confirm('Shut down the WireMock server? This will stop the server process.')) return;
    if (!confirm('Are you really sure? The server will be stopped.')) return;
    try {
      await client.shutdown();
      alert('Shutdown signal sent. The server will stop shortly.');
    } catch {
      // Expected - server shuts down
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">System</h2>
        <p className="text-sm text-gray-500">Server info, settings, and management</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Health */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Server Health</h3>
          {health ? (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Status</span>
                <span className={`badge ${health.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {health.status}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Version</span>
                <span className="text-sm font-mono">{health.version}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Uptime</span>
                <span className="text-sm font-mono">{formatUptime(health.uptimeInSeconds)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Message</span>
                <span className="text-sm text-gray-700">{health.message}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Timestamp</span>
                <span className="text-sm font-mono text-gray-500 text-xs">{health.timestamp}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not connected</p>
          )}
          <button onClick={refreshHealth} className="btn-secondary text-xs mt-3 w-full">Refresh Health</button>
        </div>

        {/* Global Settings */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Global Settings</h3>
          <div className="space-y-3">
            <div>
              <label className="label">Fixed Delay (ms)</label>
              <input
                value={fixedDelay}
                onChange={(e) => setFixedDelay(e.target.value)}
                type="number"
                min="0"
                className="input"
                placeholder="0 (no delay)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Add a fixed delay to all responses
              </p>
            </div>
            <button onClick={handleUpdateSettings} className="btn-primary w-full">
              Update Settings
            </button>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Server Actions</h3>
        <div className="flex gap-3">
          <button onClick={handleReset} className="btn-warning">
            Reset Mappings & Journal
          </button>
          <button
            onClick={async () => {
              try {
                await client.persistStubMappings();
                alert('Mappings persisted to backing store.');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Persist failed');
              }
            }}
            className="btn-primary"
          >
            Persist Mappings
          </button>
          <button
            onClick={async () => {
              try {
                await client.resetStubMappings();
                alert('Stub mappings reset to defaults.');
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Reset failed');
              }
            }}
            className="btn-secondary"
          >
            Reset Stubs to Defaults
          </button>
          <div className="flex-1" />
          <button onClick={handleShutdown} className="btn-danger">
            Shutdown Server
          </button>
        </div>
      </div>

      {/* Files */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Body Files</h3>
          <button onClick={loadFiles} className="btn-secondary text-xs">Refresh</button>
        </div>
        {loadingFiles ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : files.length === 0 ? (
          <p className="text-sm text-gray-400">No files found</p>
        ) : (
          <div className="flex gap-4">
            <div className="w-64 max-h-60 overflow-y-auto border border-gray-200 rounded-md">
              {files.map((f) => (
                <div
                  key={f}
                  className={`flex items-center justify-between px-3 py-2 text-sm border-b border-gray-100 cursor-pointer ${
                    selectedFile === f ? 'bg-brand-50' : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleViewFile(f)}
                >
                  <span className="font-mono text-xs truncate">{f}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFile(f); }}
                    className="text-red-500 hover:text-red-700 text-xs ml-2 shrink-0"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
            {selectedFile && (
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-600">{selectedFile}</span>
                  <button onClick={() => { setSelectedFile(null); setFileContent(''); }} className="text-gray-400 hover:text-gray-600 text-sm">
                    &times;
                  </button>
                </div>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto max-h-52 font-mono whitespace-pre-wrap border border-gray-200">
                  {fileContent}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  parts.push(`${s}s`);
  return parts.join(' ');
}

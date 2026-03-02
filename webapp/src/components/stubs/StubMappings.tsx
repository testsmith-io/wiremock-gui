import { useState, useEffect, useCallback } from 'react';
import { useWireMock } from '../../App';
import { useAuth } from '../../auth/AuthContext';
import type { StubMapping } from '../../types/wiremock';
import { StubEditor } from '../editor/StubEditor';
import { OpenApiImporter } from '../OpenApiImporter';
import { StubRow } from './StubRow';
import { getSection } from '../../utils/stub';
import { createZip } from '../../utils/zip';
import type { ZipEntry } from '../../utils/zip';

const UNSECTIONED = '(Unsectioned)';

export function StubMappings() {
  const { client } = useWireMock();
  const { canWrite } = useAuth();
  const [mappings, setMappings] = useState<StubMapping[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<StubMapping | null>(null);
  const [creating, setCreating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sectionFilter, setSectionFilter] = useState<string>('__all__');
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [importingOpenApi, setImportingOpenApi] = useState(false);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await client.getAllStubMappings();
      setMappings(data.mappings || []);
      setTotal(data.meta?.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { loadMappings(); }, [loadMappings]);

  // Derive sections from mappings
  const allSections = [...new Set(mappings.map(getSection))].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });
  const namedSections = allSections.filter(Boolean);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this stub mapping?')) return;
    try {
      await client.deleteStubMapping(id);
      await loadMappings();
      if (selectedId === id) setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Delete ALL stub mappings? This cannot be undone.')) return;
    try {
      await client.deleteAllStubMappings();
      await loadMappings();
      setSelectedId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete all failed');
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset stub mappings to defaults from backing store?')) return;
    try {
      await client.resetStubMappings();
      await loadMappings();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  const handleSave = async () => {
    try {
      await client.persistStubMappings();
      setError('');
      alert('Mappings persisted to backing store.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const handleEditorSave = async (mapping: StubMapping) => {
    try {
      if (editing?.id) {
        await client.updateStubMapping(editing.id, mapping);
      } else {
        await client.createStubMapping(mapping);
      }
      setEditing(null);
      setCreating(false);
      await loadMappings();
    } catch (e) {
      throw e;
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const mappingsToImport = data.mappings || [data];
        await client.importStubMappings({ mappings: mappingsToImport, meta: { total: mappingsToImport.length } });
        await loadMappings();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Import failed');
      }
    };
    input.click();
  };

  const handleExportJson = () => {
    const data = JSON.stringify({ mappings, meta: { total } }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    downloadBlob(blob, 'wiremock-mappings.json');
  };

  const handleExportZip = () => {
    const entries: ZipEntry[] = [];
    const nameCount = new Map<string, number>();

    for (const m of mappings) {
      const section = getSection(m);
      const baseName = sanitizeFilename(m.name || m.id || 'stub');

      const key = `${section}/${baseName}`;
      const count = nameCount.get(key) || 0;
      nameCount.set(key, count + 1);
      const fileName = count > 0 ? `${baseName}-${count}.json` : `${baseName}.json`;

      const path = section
        ? `mappings/${section}/${fileName}`
        : `mappings/${fileName}`;

      entries.push({ name: path, content: JSON.stringify(m, null, 2) });
    }

    const blob = createZip(entries);
    downloadBlob(blob, 'wiremock-mappings.zip');
  };

  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleOpenApiImport = async (mappings: StubMapping[]) => {
    await client.importStubMappings({ mappings, meta: { total: mappings.length } });
    setImportingOpenApi(false);
    await loadMappings();
  };

  const toggleSection = (sectionKey: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionKey)) next.delete(sectionKey);
      else next.add(sectionKey);
      return next;
    });
  };

  // Filter by search + section
  const filtered = mappings.filter((m) => {
    if (sectionFilter !== '__all__') {
      const ms = getSection(m);
      if (sectionFilter === '__none__' && ms) return false;
      if (sectionFilter !== '__none__' && ms !== sectionFilter) return false;
    }
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    const url = m.request?.url || m.request?.urlPath || m.request?.urlPattern || m.request?.urlPathPattern || '';
    return (
      url.toLowerCase().includes(s) ||
      (m.name || '').toLowerCase().includes(s) ||
      (m.request?.method || '').toLowerCase().includes(s) ||
      (m.id || '').toLowerCase().includes(s) ||
      getSection(m).toLowerCase().includes(s)
    );
  });

  // Group filtered mappings by section
  const grouped: { key: string; label: string; mappings: StubMapping[] }[] = [];
  const sectionMap = new Map<string, StubMapping[]>();
  for (const m of filtered) {
    const sec = getSection(m) || '';
    if (!sectionMap.has(sec)) sectionMap.set(sec, []);
    sectionMap.get(sec)!.push(m);
  }
  const sortedKeys = [...sectionMap.keys()].sort((a, b) => {
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  });
  for (const key of sortedKeys) {
    grouped.push({
      key: key || UNSECTIONED,
      label: key || UNSECTIONED,
      mappings: sectionMap.get(key)!,
    });
  }

  const hasSections = namedSections.length > 0;

  const selected = selectedId ? mappings.find((m) => m.id === selectedId) : null;

  if (importingOpenApi) {
    return (
      <OpenApiImporter
        onImport={handleOpenApiImport}
        onCancel={() => setImportingOpenApi(false)}
        existingSections={namedSections}
      />
    );
  }

  if (editing || creating) {
    return (
      <StubEditor
        mapping={editing || undefined}
        onSave={handleEditorSave}
        onCancel={() => { setEditing(null); setCreating(false); }}
        existingSections={namedSections}
      />
    );
  }

  return (
    <div className="flex gap-6 h-full">
      {/* Left: list */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Stub Mappings</h2>
            <p className="text-sm text-gray-500">
              {total} mapping{total !== 1 ? 's' : ''}
              {hasSections && ` in ${namedSections.length} section${namedSections.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canWrite && <button onClick={() => setCreating(true)} className="btn-primary">+ New Stub</button>}
            {canWrite && <button onClick={() => setImportingOpenApi(true)} className="btn-secondary">Import OpenAPI</button>}
            {canWrite && <button onClick={handleImport} className="btn-secondary">Import</button>}
            <div className="relative">
              <button
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="btn-secondary"
                disabled={mappings.length === 0}
              >
                Export &#9662;
              </button>
              {showExportMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-56">
                    <button
                      onClick={() => { handleExportZip(); setShowExportMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-800">Export as ZIP</div>
                      <div className="text-[11px] text-gray-400">Individual files grouped by section</div>
                    </button>
                    <button
                      onClick={() => { handleExportJson(); setShowExportMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                    >
                      <div className="font-medium text-gray-800">Export as JSON</div>
                      <div className="text-[11px] text-gray-400">Single file with all mappings</div>
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search stubs..."
            className="input flex-1"
          />
          {hasSections && (
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="select w-40 text-sm"
            >
              <option value="__all__">All sections</option>
              {namedSections.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
              <option value="__none__">Unsectioned</option>
            </select>
          )}
          <div className="flex gap-1">
            {canWrite && <button onClick={handleSave} className="btn-secondary text-xs">Persist</button>}
            {canWrite && <button onClick={handleReset} className="btn-secondary text-xs">Reset</button>}
            {canWrite && <button onClick={handleDeleteAll} className="btn-danger text-xs">Delete All</button>}
            <button onClick={loadMappings} className="btn-secondary text-xs">Refresh</button>
          </div>
        </div>

        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <p>No stub mappings found</p>
            <button onClick={() => setCreating(true)} className="mt-2 text-brand-500 text-sm hover:underline">
              Create your first stub
            </button>
          </div>
        ) : hasSections ? (
          /* Sectioned view */
          <div className="flex-1 overflow-y-auto space-y-3">
            {grouped.map((group) => {
              const isCollapsed = collapsedSections.has(group.key);
              return (
                <div key={group.key} className="card overflow-hidden">
                  <button
                    onClick={() => toggleSection(group.key)}
                    className="w-full flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left"
                  >
                    <svg
                      className={`w-3.5 h-3.5 text-gray-400 transition-transform shrink-0 ${isCollapsed ? '' : 'rotate-90'}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <span className={`text-sm font-semibold ${group.key === UNSECTIONED ? 'text-gray-400 italic' : 'text-gray-700'}`}>
                      {group.label}
                    </span>
                    <span className="text-xs text-gray-400 ml-1">
                      ({group.mappings.length})
                    </span>
                  </button>
                  {!isCollapsed && (
                    <table className="w-full text-sm">
                      <tbody>
                        {group.mappings.map((m) => (
                          <StubRow
                            key={m.id || m.uuid}
                            mapping={m}
                            isSelected={selectedId === m.id}
                            onSelect={() => setSelectedId(m.id || m.uuid || null)}
                            onEdit={() => setEditing(m)}
                            onDelete={() => handleDelete(m.id || m.uuid || '')}
                            canWrite={canWrite}
                          />
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          /* Flat table view */
          <div className="card overflow-hidden flex-1 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Method</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">URL</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Status</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Priority</th>
                  {canWrite && <th className="text-right px-4 py-2 font-medium text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <StubRow
                    key={m.id || m.uuid}
                    mapping={m}
                    isSelected={selectedId === m.id}
                    onSelect={() => setSelectedId(m.id || m.uuid || null)}
                    onEdit={() => setEditing(m)}
                    onDelete={() => handleDelete(m.id || m.uuid || '')}
                    canWrite={canWrite}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Right: detail panel */}
      {selected && (
        <div className="w-96 flex-shrink-0 card p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Stub Detail</h3>
            <button onClick={() => setSelectedId(null)} className="text-gray-400 hover:text-gray-600 text-lg">&times;</button>
          </div>
          <div className="space-y-3">
            <div>
              <span className="label">ID</span>
              <p className="text-xs font-mono text-gray-600">{selected.id}</p>
            </div>
            {selected.name && (
              <div>
                <span className="label">Name</span>
                <p className="text-sm text-gray-700">{selected.name}</p>
              </div>
            )}
            {getSection(selected) && (
              <div>
                <span className="label">Section</span>
                <p className="text-sm">
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded bg-brand-50 text-brand-700 border border-brand-200">
                    {getSection(selected)}
                  </span>
                </p>
              </div>
            )}
            {selected.scenarioName && (
              <div>
                <span className="label">Scenario</span>
                <p className="text-sm text-gray-700">
                  {selected.scenarioName}
                  {selected.requiredScenarioState && ` (requires: ${selected.requiredScenarioState})`}
                  {selected.newScenarioState && ` -> ${selected.newScenarioState}`}
                </p>
              </div>
            )}
            <div>
              <span className="label">Request</span>
              <pre className="text-xs bg-gray-50 p-2 rounded-md overflow-auto max-h-48 font-mono">
                {JSON.stringify(selected.request, null, 2)}
              </pre>
            </div>
            <div>
              <span className="label">Response</span>
              <pre className="text-xs bg-gray-50 p-2 rounded-md overflow-auto max-h-48 font-mono">
                {JSON.stringify(selected.response, null, 2)}
              </pre>
            </div>
            {selected.metadata && Object.keys(selected.metadata).length > 0 && (
              <div>
                <span className="label">Metadata</span>
                <pre className="text-xs bg-gray-50 p-2 rounded-md overflow-auto max-h-32 font-mono">
                  {JSON.stringify(selected.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            {canWrite && <button onClick={() => setEditing(selected)} className="btn-primary flex-1">Edit</button>}
            {canWrite && <button onClick={() => handleDelete(selected.id || '')} className="btn-danger flex-1">Delete</button>}
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(selected, null, 2));
              }}
              className="btn-secondary"
            >
              Copy JSON
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
    || 'stub';
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

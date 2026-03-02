import { useState, useRef } from 'react';
import type { StubMapping } from '../types/wiremock';
import { parseOpenApiSpec, generateStubMappings } from '../openapi/parser';
import type { ParsedEndpoint } from '../openapi/parser';
import { MethodBadge } from './shared/badges';

interface OpenApiImporterProps {
  onImport: (mappings: StubMapping[]) => Promise<void>;
  onCancel: () => void;
  existingSections: string[];
}

export function OpenApiImporter({ onImport, onCancel, existingSections }: OpenApiImporterProps) {
  const [step, setStep] = useState<'input' | 'select'>('input');
  const [specText, setSpecText] = useState('');
  const [specUrl, setSpecUrl] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [parseError, setParseError] = useState('');
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [endpoints, setEndpoints] = useState<ParsedEndpoint[]>([]);
  const [specTitle, setSpecTitle] = useState('');
  const [specVersion, setSpecVersion] = useState('');
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [section, setSection] = useState('');
  const [useTagsAsSection, setUseTagsAsSection] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasTags = endpoints.some(ep => ep.tags && ep.tags.length > 0);

  const processSpec = (text: string, source: string) => {
    setParseError('');
    setParseWarnings([]);
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      setParseError(`Invalid JSON from ${source}. Expected a valid OpenAPI specification in JSON format.`);
      return;
    }

    const result = parseOpenApiSpec(json);
    if (result.errors.length > 0 && result.endpoints.length === 0) {
      setParseError(result.errors.join('\n'));
      return;
    }

    setParseWarnings(result.errors);
    setEndpoints(result.endpoints);
    setSpecTitle(result.title);
    setSpecVersion(result.version);
    setSelected(new Set(result.endpoints.map((_, i) => i)));
    // Auto-enable tag sections if the spec has tags
    const specHasTags = result.endpoints.some(ep => ep.tags && ep.tags.length > 0);
    setUseTagsAsSection(specHasTags);
    setStep('select');
  };

  const handleParse = () => processSpec(specText, 'input');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setSpecText(text);
      processSpec(text, 'file');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleFetchUrl = async () => {
    const url = specUrl.trim();
    if (!url) return;
    setFetchingUrl(true);
    setParseError('');
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        setParseError(`Failed to fetch: ${resp.status} ${resp.statusText}`);
        return;
      }
      const text = await resp.text();
      setSpecText(text);
      processSpec(text, 'URL');
    } catch (e) {
      setParseError(`Failed to fetch URL: ${e instanceof Error ? e.message : 'Network error'}. Check that the URL is accessible and allows cross-origin requests.`);
    } finally {
      setFetchingUrl(false);
    }
  };

  const handleImportStubs = async () => {
    setImporting(true);
    setImportError('');
    try {
      const mappings = generateStubMappings(endpoints, selected, section, useTagsAsSection);
      await onImport(mappings);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
      setImporting(false);
    }
  };

  const toggleEndpoint = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(endpoints.map((_, i) => i)));
  const deselectAll = () => setSelected(new Set());

  const previewMapping = previewIdx !== null
    ? generateStubMappings(endpoints, new Set([previewIdx]), section, useTagsAsSection)[0]
    : null;

  // Collect unique tags for display
  const allTags = [...new Set(endpoints.flatMap(ep => ep.tags || []))].sort();

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Import from OpenAPI</h2>
          <p className="text-sm text-gray-500">
            {step === 'input'
              ? 'Paste, upload, or fetch an OpenAPI / Swagger JSON specification'
              : `${specTitle}${specVersion ? ` v${specVersion}` : ''} \u2014 select endpoints to import`}
          </p>
        </div>
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <div className="space-y-4">
          {/* URL fetch */}
          <div className="card p-4">
            <label className="label">Fetch from URL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={specUrl}
                onChange={(e) => setSpecUrl(e.target.value)}
                placeholder="https://petstore3.swagger.io/api/v3/openapi.json"
                className="input flex-1 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleFetchUrl()}
              />
              <button
                onClick={handleFetchUrl}
                className="btn-primary text-sm"
                disabled={!specUrl.trim() || fetchingUrl}
              >
                {fetchingUrl ? 'Fetching...' : 'Fetch'}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Enter the URL of an OpenAPI JSON specification.
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <div className="flex-1 border-t border-gray-200" />
            <span>or paste / upload</span>
            <div className="flex-1 border-t border-gray-200" />
          </div>

          {/* Paste / file upload */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-2">
              <label className="label mb-0">OpenAPI Specification (JSON)</label>
              <div className="flex gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary text-xs"
                >
                  Upload File
                </button>
              </div>
            </div>
            <textarea
              value={specText}
              onChange={(e) => setSpecText(e.target.value)}
              placeholder={'{\n  "openapi": "3.0.0",\n  "info": { "title": "My API", "version": "1.0" },\n  "paths": { ... }\n}'}
              className="input w-full font-mono text-xs"
              rows={12}
            />
          </div>

          {parseError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700 whitespace-pre-line">
              {parseError}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleParse}
              className="btn-primary"
              disabled={!specText.trim()}
            >
              Parse Specification
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Endpoints */}
      {step === 'select' && (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center gap-3 flex-wrap">
            <button onClick={selectAll} className="btn-secondary text-xs">Select All</button>
            <button onClick={deselectAll} className="btn-secondary text-xs">Deselect All</button>
            <span className="text-sm text-gray-500">
              {selected.size} of {endpoints.length} endpoint{endpoints.length !== 1 ? 's' : ''} selected
            </span>
          </div>

          {/* Section configuration */}
          <div className="card p-3">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="label mb-0 text-xs">Sections:</span>
              {hasTags && (
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="sectionMode"
                    checked={useTagsAsSection}
                    onChange={() => setUseTagsAsSection(true)}
                    className="rounded"
                  />
                  <span>Use OpenAPI tags</span>
                  <span className="text-[11px] text-gray-400 ml-1">
                    ({allTags.join(', ')})
                  </span>
                </label>
              )}
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="sectionMode"
                  checked={!useTagsAsSection}
                  onChange={() => setUseTagsAsSection(false)}
                  className="rounded"
                />
                <span>Custom section:</span>
              </label>
              {!useTagsAsSection && (
                <input
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="input w-40 text-sm"
                  placeholder="e.g. Imported API"
                  list="section-suggestions-openapi"
                />
              )}
              {!useTagsAsSection && existingSections.length > 0 && (
                <datalist id="section-suggestions-openapi">
                  {existingSections.map((s) => <option key={s} value={s} />)}
                </datalist>
              )}
            </div>
          </div>

          {parseWarnings.length > 0 && (
            <div className="p-2 bg-amber-50 border border-amber-200 rounded-md text-xs text-amber-700">
              {parseWarnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          )}

          {/* Endpoint table */}
          <div className="card overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-4 py-2 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === endpoints.length && endpoints.length > 0}
                        onChange={() => selected.size === endpoints.length ? deselectAll() : selectAll()}
                        className="rounded"
                      />
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 w-20">Method</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Path</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600">Description</th>
                    {hasTags && (
                      <th className="text-left px-4 py-2 font-medium text-gray-600 w-24">Tag</th>
                    )}
                    <th className="text-left px-4 py-2 font-medium text-gray-600 w-16">Status</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-600 w-20">Preview</th>
                  </tr>
                </thead>
                <tbody>
                  {endpoints.map((ep, i) => {
                    const isSelected = selected.has(i);
                    const bestResponse = ep.responses.find(r => r.statusCode >= 200 && r.statusCode < 300)
                      || ep.responses[0];
                    return (
                      <tr
                        key={`${ep.method}-${ep.path}`}
                        onClick={() => toggleEndpoint(i)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          isSelected ? 'bg-brand-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEndpoint(i)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded"
                          />
                        </td>
                        <td className="px-4 py-2.5">
                          <MethodBadge method={ep.method} />
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs">{ep.path}</td>
                        <td className="px-4 py-2.5 text-gray-600 text-xs truncate max-w-[220px]" title={ep.summary || ep.operationId || ''}>
                          {ep.summary || ep.operationId || ''}
                        </td>
                        {hasTags && (
                          <td className="px-4 py-2.5">
                            {ep.tags?.[0] && (
                              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium rounded bg-brand-50 text-brand-700 border border-brand-200">
                                {ep.tags[0]}
                              </span>
                            )}
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-gray-500 text-xs">
                          {bestResponse ? bestResponse.statusCode : '-'}
                        </td>
                        <td className="px-4 py-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewIdx(previewIdx === i ? null : i);
                            }}
                            className="text-brand-500 hover:text-brand-700 text-xs"
                          >
                            {previewIdx === i ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Preview panel */}
          {previewMapping && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="label mb-0">Stub Preview</span>
                <button onClick={() => setPreviewIdx(null)} className="text-gray-400 hover:text-gray-600 text-sm">&times;</button>
              </div>
              <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto max-h-60 font-mono">
                {JSON.stringify(previewMapping, null, 2)}
              </pre>
            </div>
          )}

          {/* Import error */}
          {importError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
              {importError}
              <button onClick={() => setImportError('')} className="ml-2 underline">dismiss</button>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <button onClick={() => setStep('input')} className="btn-secondary">Back</button>
            <button
              onClick={handleImportStubs}
              className="btn-primary"
              disabled={selected.size === 0 || importing}
            >
              {importing ? 'Importing...' : `Import ${selected.size} Stub${selected.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

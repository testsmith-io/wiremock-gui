import { useState, useRef, useMemo } from 'react';
import type { StubMapping, ContentPattern } from '../../types/wiremock';
import { TemplatePicker } from './TemplatePicker';

interface StubEditorProps {
  mapping?: StubMapping;
  onSave: (mapping: StubMapping) => Promise<void>;
  onCancel: () => void;
  existingSections?: string[];
}

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS', 'ANY'];
const URL_MATCH_TYPES = [
  { value: 'url', label: 'URL (exact match with query)' },
  { value: 'urlPath', label: 'URL Path (exact path)' },
  { value: 'urlPattern', label: 'URL Pattern (regex with query)' },
  { value: 'urlPathPattern', label: 'URL Path Pattern (regex path)' },
];

type EditorMode = 'form' | 'json';

// Match types the form can render for each kind of pattern.
const HEADER_QUERY_MATCHERS = [
  { value: 'equalTo', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'matches', label: 'Matches (regex)' },
  { value: 'doesNotMatch', label: "Doesn't match" },
  { value: 'absent', label: 'Absent' },
];
const BODY_MATCHERS = [
  { value: 'equalTo', label: 'Equals' },
  { value: 'contains', label: 'Contains' },
  { value: 'matches', label: 'Matches (regex)' },
  { value: 'doesNotMatch', label: "Doesn't match" },
  { value: 'equalToJson', label: 'Equal to JSON' },
  { value: 'equalToXml', label: 'Equal to XML' },
  { value: 'matchesJsonPath', label: 'Matches JSONPath' },
  { value: 'matchesXPath', label: 'Matches XPath' },
];
const HEADER_QUERY_MATCH_SET = new Set(HEADER_QUERY_MATCHERS.map((m) => m.value));
const BODY_MATCH_SET = new Set(BODY_MATCHERS.map((m) => m.value));

// Fields the form editor reads and rebuilds. Anything outside these sets is
// preserved verbatim by buildMapping() and (if present) triggers JSON mode so
// it is never silently dropped.
const MANAGED_REQUEST_KEYS = new Set([
  'method', 'url', 'urlPath', 'urlPattern', 'urlPathPattern', 'headers', 'queryParameters', 'bodyPatterns',
]);
const MANAGED_RESPONSE_KEYS = new Set([
  'status', 'headers', 'body', 'jsonBody', 'fixedDelayMilliseconds', 'transformers',
]);
const MANAGED_TOP_KEYS = new Set([
  'id', 'uuid', 'name', 'request', 'response', 'persistent', 'priority',
  'scenarioName', 'requiredScenarioState', 'newScenarioState', 'metadata',
]);

const DEFAULT_MAPPING: StubMapping = {
  request: {
    method: 'GET',
    urlPath: '/example',
  },
  response: {
    status: 200,
    body: '{"message": "Hello World"}',
    headers: {
      'Content-Type': 'application/json',
    },
  },
};

export function StubEditor({ mapping, onSave, onCancel, existingSections = [] }: StubEditorProps) {
  const isEdit = !!mapping?.id;
  // Detect fields the form can't represent; such stubs open in JSON mode so
  // their advanced matchers/response fields are never silently lost.
  const analysis = useMemo(() => analyzeMapping(mapping), [mapping]);
  const [mode, setMode] = useState<EditorMode>(analysis.representable ? 'form' : 'json');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState(mapping?.name || '');
  const [method, setMethod] = useState(mapping?.request?.method || 'GET');
  const [urlMatchType, setUrlMatchType] = useState(getUrlMatchType(mapping));
  const [urlValue, setUrlValue] = useState(getUrlValue(mapping));
  const [responseStatus, setResponseStatus] = useState(String(mapping?.response?.status || 200));
  const [responseBody, setResponseBody] = useState(
    mapping?.response?.jsonBody
      ? JSON.stringify(mapping.response.jsonBody, null, 2)
      : mapping?.response?.body || ''
  );
  const [responseContentType, setResponseContentType] = useState(
    mapping?.response?.headers?.['Content-Type'] || 'application/json'
  );
  const [priority, setPriority] = useState(String(mapping?.priority || ''));
  const [persistent, setPersistent] = useState(mapping?.persistent ?? false);
  const [scenarioName, setScenarioName] = useState(mapping?.scenarioName || '');
  const [requiredState, setRequiredState] = useState(mapping?.requiredScenarioState || '');
  const [newState, setNewState] = useState(mapping?.newScenarioState || '');
  const [fixedDelay, setFixedDelay] = useState(String(mapping?.response?.fixedDelayMilliseconds || ''));
  const [section, setSection] = useState(
    (mapping?.metadata as Record<string, unknown>)?.section as string || ''
  );

  // Textarea refs for cursor-position insertion
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const jsonRef = useRef<HTMLTextAreaElement>(null);

  // Request headers
  const [reqHeaders, setReqHeaders] = useState<Array<{ key: string; matchType: string; value: string }>>(
    parseRequestHeaders(mapping)
  );

  // Request query parameters
  const [queryParams, setQueryParams] = useState<Array<{ key: string; matchType: string; value: string }>>(
    parseQueryParams(mapping)
  );

  // Request body patterns (an array of matchers, no key)
  const [bodyPatterns, setBodyPatterns] = useState<Array<{ matchType: string; value: string }>>(
    parseBodyPatterns(mapping)
  );

  // Response headers
  const [respHeaders, setRespHeaders] = useState<Array<{ key: string; value: string }>>(
    parseResponseHeaders(mapping)
  );

  // JSON mode state
  const [jsonText, setJsonText] = useState(
    JSON.stringify(mapping || DEFAULT_MAPPING, null, 2)
  );

  // Enable response-template transformer checkbox
  const [useTemplating, setUseTemplating] = useState(
    mapping?.response?.transformers?.includes('response-template') ||
    !!(mapping?.response?.body?.includes('{{') || mapping?.response?.body?.includes('{{{'))
  );

  const insertAtCursor = (textareaRef: React.RefObject<HTMLTextAreaElement | null>, text: string, setter: (v: string) => void, currentValue: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setter(currentValue + text);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    setter(newValue);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + text.length;
    });
  };

  const buildMapping = (): StubMapping => {
    const m: StubMapping = {
      request: {
        method: method === 'ANY' ? undefined : method,
        [urlMatchType]: urlValue,
      },
      response: {
        status: parseInt(responseStatus, 10) || 200,
      },
    };

    if (name) m.name = name;
    if (priority) m.priority = parseInt(priority, 10);
    if (persistent) m.persistent = true;
    if (scenarioName) {
      m.scenarioName = scenarioName;
      if (requiredState) m.requiredScenarioState = requiredState;
      if (newState) m.newScenarioState = newState;
    }

    // Request headers
    const rh: Record<string, ContentPattern> = {};
    reqHeaders.forEach(({ key, matchType, value }) => {
      const p = buildPattern(matchType, value);
      if (key && p) rh[key] = p;
    });
    if (Object.keys(rh).length > 0) m.request.headers = rh;

    // Query parameters
    const qp: Record<string, ContentPattern> = {};
    queryParams.forEach(({ key, matchType, value }) => {
      const p = buildPattern(matchType, value);
      if (key && p) qp[key] = p;
    });
    if (Object.keys(qp).length > 0) m.request.queryParameters = qp;

    // Body patterns
    const bp: ContentPattern[] = [];
    bodyPatterns.forEach(({ matchType, value }) => {
      const p = buildPattern(matchType, value);
      if (p) bp.push(p);
    });
    if (bp.length > 0) m.request.bodyPatterns = bp;

    // Response body
    if (responseBody) {
      if (useTemplating || responseBody.includes('{{')) {
        m.response.body = responseBody;
      } else if (responseContentType.includes('json')) {
        try {
          m.response.jsonBody = JSON.parse(responseBody);
        } catch {
          m.response.body = responseBody;
        }
      } else {
        m.response.body = responseBody;
      }
    }

    // Response headers
    const headers: Record<string, string> = {};
    if (responseContentType) headers['Content-Type'] = responseContentType;
    respHeaders.forEach(({ key, value }) => {
      if (key && value) headers[key] = value;
    });
    if (Object.keys(headers).length > 0) m.response.headers = headers;

    if (fixedDelay) m.response.fixedDelayMilliseconds = parseInt(fixedDelay, 10);

    if (useTemplating || responseBody.includes('{{')) {
      m.response.transformers = ['response-template'];
    }

    // Metadata (section + any existing metadata)
    const meta: Record<string, unknown> = { ...(mapping?.metadata || {}) };
    if (section.trim()) {
      meta.section = section.trim();
    } else {
      delete meta.section;
    }
    if (Object.keys(meta).length > 0) m.metadata = meta;

    if (mapping?.id) m.id = mapping.id;
    if (mapping?.uuid) m.uuid = mapping.uuid;

    // Preserve any fields the form doesn't manage (e.g. request.cookies,
    // request.basicAuthCredentials, response.fault, response.proxyBaseUrl,
    // postServeActions) so editing/saving from the form never strips them.
    if (mapping) {
      const req = m.request as Record<string, unknown>;
      Object.entries(mapping.request || {}).forEach(([k, v]) => {
        if (!MANAGED_REQUEST_KEYS.has(k)) req[k] = v;
      });
      const res = m.response as Record<string, unknown>;
      Object.entries(mapping.response || {}).forEach(([k, v]) => {
        if (!MANAGED_RESPONSE_KEYS.has(k)) res[k] = v;
      });
      const top = m as unknown as Record<string, unknown>;
      Object.entries(mapping).forEach(([k, v]) => {
        if (!MANAGED_TOP_KEYS.has(k)) top[k] = v;
      });
    }

    return m;
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (mode === 'json') {
        const parsed = JSON.parse(jsonText);
        await onSave(parsed);
      } else {
        await onSave(buildMapping());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const switchToJson = () => {
    if (mode === 'form') {
      setJsonText(JSON.stringify(buildMapping(), null, 2));
    }
    setMode('json');
  };

  const switchToForm = () => {
    setMode('form');
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'Edit Stub Mapping' : 'New Stub Mapping'}
          </h2>
          <p className="text-sm text-gray-500">
            {isEdit ? `Editing ${mapping?.id?.slice(0, 8)}...` : 'Create a new stub mapping'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={mode === 'form' ? switchToJson : switchToForm}
            className="btn-secondary text-xs"
          >
            {mode === 'form' ? 'JSON Editor' : 'Form Editor'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {analysis.reasons.length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-md text-sm text-amber-800">
          {mode === 'json' ? (
            <>This stub uses fields the form editor can’t display, so it opened in the JSON editor to keep them intact:</>
          ) : (
            <>Heads up: this stub has advanced fields not shown in the form. They’re preserved on save, but edit them in the JSON editor to be safe:</>
          )}
          <span className="font-mono text-xs"> {analysis.reasons.join(', ')}</span>
        </div>
      )}

      {mode === 'json' ? (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500 font-mono">JSON</span>
            <TemplatePicker onInsert={(expr) => insertAtCursor(jsonRef, expr, setJsonText, jsonText)} />
          </div>
          <textarea
            ref={jsonRef}
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            className="w-full h-[500px] font-mono text-sm p-3 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-400 focus:border-brand-500"
            spellCheck={false}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Basic info */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Basic</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="label">Name (optional)</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="My Stub" />
                <p className="text-[11px] text-gray-400 mt-1">A human-readable label for this stub</p>
              </div>
              <div className="relative">
                <label className="label">Section (optional)</label>
                <input
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="input"
                  placeholder="e.g. Users, Orders"
                  list="section-suggestions"
                />
                {existingSections.length > 0 && (
                  <datalist id="section-suggestions">
                    {existingSections.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                )}
                <p className="text-[11px] text-gray-400 mt-1">Group stubs visually in the list</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Priority</label>
                  <input value={priority} onChange={(e) => setPriority(e.target.value)} className="input" type="number" min="1" placeholder="Default" />
                  <p className="text-[11px] text-gray-400 mt-1">Lower = matched first</p>
                </div>
                <div className="flex flex-col items-start">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer mt-6">
                    <input type="checkbox" checked={persistent} onChange={(e) => setPersistent(e.target.checked)} className="rounded" />
                    Persistent
                  </label>
                  <p className="text-[11px] text-gray-400 mt-1">Survives reset</p>
                </div>
              </div>
            </div>
          </div>

          {/* Request matching */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Request Matching</h3>
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div>
                <label className="label">Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className="select">
                  {HTTP_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="label">URL Match</label>
                <select value={urlMatchType} onChange={(e) => setUrlMatchType(e.target.value)} className="select">
                  {URL_MATCH_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">URL Value</label>
                <input value={urlValue} onChange={(e) => setUrlValue(e.target.value)} className="input font-mono text-sm" placeholder="/api/example" />
              </div>
            </div>

            {/* Request headers */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Request Headers</label>
                <button
                  onClick={() => setReqHeaders([...reqHeaders, { key: '', matchType: 'equalTo', value: '' }])}
                  className="text-xs text-brand-500 hover:text-brand-700"
                >
                  + Add Header
                </button>
              </div>
              {reqHeaders.map((h, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    value={h.key}
                    onChange={(e) => { const n = [...reqHeaders]; n[i].key = e.target.value; setReqHeaders(n); }}
                    className="input flex-1"
                    placeholder="Header name"
                  />
                  <select
                    value={h.matchType}
                    onChange={(e) => { const n = [...reqHeaders]; n[i].matchType = e.target.value; setReqHeaders(n); }}
                    className="select w-40"
                  >
                    {HEADER_QUERY_MATCHERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                    value={h.value}
                    onChange={(e) => { const n = [...reqHeaders]; n[i].value = e.target.value; setReqHeaders(n); }}
                    className="input flex-1"
                    placeholder="Value"
                    disabled={h.matchType === 'absent'}
                  />
                  <button
                    onClick={() => setReqHeaders(reqHeaders.filter((_, j) => j !== i))}
                    className="text-red-500 hover:text-red-700 px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            {/* Query parameters */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Query Parameters</label>
                <button
                  onClick={() => setQueryParams([...queryParams, { key: '', matchType: 'equalTo', value: '' }])}
                  className="text-xs text-brand-500 hover:text-brand-700"
                >
                  + Add Query Param
                </button>
              </div>
              {queryParams.length === 0 && (
                <p className="text-[11px] text-gray-400 mb-1">Match on <code className="font-mono bg-gray-100 px-1 rounded">?name=value</code> query string parameters.</p>
              )}
              {queryParams.map((q, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    value={q.key}
                    onChange={(e) => { const n = [...queryParams]; n[i].key = e.target.value; setQueryParams(n); }}
                    className="input flex-1"
                    placeholder="Parameter name"
                  />
                  <select
                    value={q.matchType}
                    onChange={(e) => { const n = [...queryParams]; n[i].matchType = e.target.value; setQueryParams(n); }}
                    className="select w-40"
                  >
                    {HEADER_QUERY_MATCHERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                    value={q.value}
                    onChange={(e) => { const n = [...queryParams]; n[i].value = e.target.value; setQueryParams(n); }}
                    className="input flex-1"
                    placeholder="Value"
                    disabled={q.matchType === 'absent'}
                  />
                  <button
                    onClick={() => setQueryParams(queryParams.filter((_, j) => j !== i))}
                    className="text-red-500 hover:text-red-700 px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>

            {/* Body patterns */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Body Patterns</label>
                <button
                  onClick={() => setBodyPatterns([...bodyPatterns, { matchType: 'equalToJson', value: '' }])}
                  className="text-xs text-brand-500 hover:text-brand-700"
                >
                  + Add Body Pattern
                </button>
              </div>
              {bodyPatterns.length === 0 && (
                <p className="text-[11px] text-gray-400 mb-1">Match on the request body (JSON, XML, regex, JSONPath, XPath).</p>
              )}
              {bodyPatterns.map((b, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <select
                    value={b.matchType}
                    onChange={(e) => { const n = [...bodyPatterns]; n[i].matchType = e.target.value; setBodyPatterns(n); }}
                    className="select w-44"
                  >
                    {BODY_MATCHERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <input
                    value={b.value}
                    onChange={(e) => { const n = [...bodyPatterns]; n[i].value = e.target.value; setBodyPatterns(n); }}
                    className="input flex-1 font-mono text-sm"
                    placeholder={b.matchType === 'matchesJsonPath' ? '$.name' : b.matchType === 'equalToJson' ? '{"key":"value"}' : 'Value'}
                  />
                  <button
                    onClick={() => setBodyPatterns(bodyPatterns.filter((_, j) => j !== i))}
                    className="text-red-500 hover:text-red-700 px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Response */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Response</h3>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div>
                <label className="label">Status Code</label>
                <input value={responseStatus} onChange={(e) => setResponseStatus(e.target.value)} className="input" type="number" />
              </div>
              <div>
                <label className="label">Content-Type</label>
                <input value={responseContentType} onChange={(e) => setResponseContentType(e.target.value)} className="input" placeholder="application/json" />
              </div>
              <div>
                <label className="label">Fixed Delay (ms)</label>
                <input value={fixedDelay} onChange={(e) => setFixedDelay(e.target.value)} className="input" type="number" placeholder="0" />
                <p className="text-[11px] text-gray-400 mt-1">Wait before responding</p>
              </div>
            </div>

            <div className="mb-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-3">
                  <label className="label mb-0">Response Body</label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useTemplating}
                      onChange={(e) => setUseTemplating(e.target.checked)}
                      className="rounded"
                    />
                    Enable templating
                  </label>
                </div>
                <TemplatePicker onInsert={(expr) => insertAtCursor(bodyRef, expr, setResponseBody, responseBody)} />
              </div>
              <textarea
                ref={bodyRef}
                value={responseBody}
                onChange={(e) => setResponseBody(e.target.value)}
                className="w-full h-40 font-mono text-sm p-3 border border-gray-300 rounded-md focus:ring-1 focus:ring-brand-400 focus:border-brand-500"
                placeholder='{"message": "Hello"}'
                spellCheck={false}
              />
              {useTemplating && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Templating enabled — use {'{{...}}'} expressions. Body will be sent as string (not parsed JSON).
                </p>
              )}
            </div>

            {/* Response headers */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="label mb-0">Response Headers</label>
                <button
                  onClick={() => setRespHeaders([...respHeaders, { key: '', value: '' }])}
                  className="text-xs text-brand-500 hover:text-brand-700"
                >
                  + Add Header
                </button>
              </div>
              {respHeaders.map((h, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    value={h.key}
                    onChange={(e) => { const n = [...respHeaders]; n[i].key = e.target.value; setRespHeaders(n); }}
                    className="input flex-1"
                    placeholder="Header name"
                  />
                  <input
                    value={h.value}
                    onChange={(e) => { const n = [...respHeaders]; n[i].value = e.target.value; setRespHeaders(n); }}
                    className="input flex-1"
                    placeholder="Value"
                  />
                  <button
                    onClick={() => setRespHeaders(respHeaders.filter((_, j) => j !== i))}
                    className="text-red-500 hover:text-red-700 px-1"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Scenario */}
          <div className="card p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-gray-700">Scenario (optional)</h3>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  Model stateful behaviour — stubs in the same scenario form a state machine.
                  Each match can transition to a new state, changing which stubs match next.
                </p>
              </div>
              {!scenarioName && (
                <button
                  onClick={() => { setScenarioName('my_scenario'); setRequiredState('Started'); }}
                  className="text-xs text-brand-500 hover:text-brand-700 shrink-0 ml-4"
                >
                  + Add to scenario
                </button>
              )}
            </div>
            {scenarioName ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label">Scenario Name</label>
                    <input value={scenarioName} onChange={(e) => setScenarioName(e.target.value)} className="input" placeholder="my_scenario" />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Groups stubs into one state machine. All stubs with the same name share state.
                    </p>
                  </div>
                  <div>
                    <label className="label">Required State</label>
                    <input value={requiredState} onChange={(e) => setRequiredState(e.target.value)} className="input" placeholder="Started" />
                    <p className="text-[11px] text-gray-400 mt-1">
                      Only match when the scenario is in this state. Initial state is always <code className="font-mono text-[11px] bg-gray-100 px-1 rounded">Started</code> (capital S).
                    </p>
                  </div>
                  <div>
                    <label className="label">New State</label>
                    <input value={newState} onChange={(e) => setNewState(e.target.value)} className="input" placeholder="step_2" />
                    <p className="text-[11px] text-gray-400 mt-1">
                      After matching, transition to this state. Leave empty to stay in the current state.
                    </p>
                  </div>
                </div>
                <div className="mt-3 p-2.5 bg-gray-50 rounded-md border border-gray-100">
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    <span className="font-semibold text-gray-600">How it works:</span>{' '}
                    Create multiple stubs with the same Scenario Name. The first should require{' '}
                    <code className="font-mono bg-gray-100 px-1 rounded">Started</code> and transition to a new state.
                    Subsequent stubs require that new state and optionally transition further.
                    This lets you return different responses for the same URL on consecutive calls.
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-[11px] text-gray-400 font-mono">
                    <span className="px-1.5 py-0.5 bg-accent-50 text-accent-700 rounded text-[10px] font-medium">Started</span>
                    <span>&rarr;</span>
                    <span className="px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded text-[10px] font-medium">step_2</span>
                    <span>&rarr;</span>
                    <span className="px-1.5 py-0.5 bg-brand-50 text-brand-600 rounded text-[10px] font-medium">step_3</span>
                    <span>&rarr;</span>
                    <span className="text-gray-400">...</span>
                  </div>
                </div>
                <button
                  onClick={() => { setScenarioName(''); setRequiredState(''); setNewState(''); }}
                  className="text-xs text-red-500 hover:text-red-700 mt-2"
                >
                  Remove from scenario
                </button>
              </>
            ) : (
              <div className="text-xs text-gray-400 border border-dashed border-gray-200 rounded-md p-3 text-center">
                No scenario configured. This stub will match independently based on the request pattern only.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-200">
        <button onClick={onCancel} className="btn-secondary">Cancel</button>
        <div className="flex gap-2">
          {mode === 'form' && (
            <button
              onClick={() => {
                const m = buildMapping();
                navigator.clipboard.writeText(JSON.stringify(m, null, 2));
              }}
              className="btn-secondary"
            >
              Copy JSON
            </button>
          )}
          <button onClick={handleSave} className="btn-primary" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update Stub' : 'Create Stub'}
          </button>
        </div>
      </div>
    </div>
  );
}

function getUrlMatchType(mapping?: StubMapping): string {
  if (!mapping) return 'urlPath';
  if (mapping.request?.url) return 'url';
  if (mapping.request?.urlPattern) return 'urlPattern';
  if (mapping.request?.urlPathPattern) return 'urlPathPattern';
  return 'urlPath';
}

function getUrlValue(mapping?: StubMapping): string {
  if (!mapping) return '/example';
  return mapping.request?.url || mapping.request?.urlPath || mapping.request?.urlPattern || mapping.request?.urlPathPattern || '';
}

function parseRequestHeaders(mapping?: StubMapping): Array<{ key: string; matchType: string; value: string }> {
  if (!mapping?.request?.headers) return [];
  return Object.entries(mapping.request.headers).map(([key, pattern]) => {
    const { matchType, value } = readPattern(pattern);
    return { key, matchType, value };
  });
}

function parseResponseHeaders(mapping?: StubMapping): Array<{ key: string; value: string }> {
  if (!mapping?.response?.headers) return [];
  return Object.entries(mapping.response.headers)
    .filter(([key]) => key !== 'Content-Type')
    .map(([key, value]) => ({ key, value }));
}

function parseQueryParams(mapping?: StubMapping): Array<{ key: string; matchType: string; value: string }> {
  if (!mapping?.request?.queryParameters) return [];
  return Object.entries(mapping.request.queryParameters).map(([key, pattern]) => {
    const { matchType, value } = readPattern(pattern);
    return { key, matchType, value };
  });
}

function parseBodyPatterns(mapping?: StubMapping): Array<{ matchType: string; value: string }> {
  if (!mapping?.request?.bodyPatterns) return [];
  return mapping.request.bodyPatterns.map((pattern) => readPattern(pattern));
}

// Read a single-matcher content pattern into { matchType, value } for the form.
function readPattern(pattern: unknown): { matchType: string; value: string } {
  const p = (pattern || {}) as Record<string, unknown>;
  if (p.absent === true) return { matchType: 'absent', value: '' };
  const matchType = Object.keys(p)[0] || 'equalTo';
  let value = p[matchType];
  // matchesJsonPath may be an object { expression, ... }; show its expression.
  if (matchType === 'matchesJsonPath' && value && typeof value === 'object') {
    value = (value as { expression?: string }).expression ?? '';
  }
  return { matchType, value: value == null ? '' : String(value) };
}

// Build a content pattern from form inputs, or null if it carries nothing.
function buildPattern(matchType: string, value: string): ContentPattern | null {
  if (matchType === 'absent') return { absent: true };
  if (!value) return null;
  return { [matchType]: value };
}

// Is a pattern one the form can faithfully round-trip? (single known matcher,
// string value — or `absent: true`.)
function isSimplePattern(pattern: unknown, allowed: Set<string>): boolean {
  if (!pattern || typeof pattern !== 'object' || Array.isArray(pattern)) return false;
  const keys = Object.keys(pattern as object);
  if (keys.length !== 1) return false;
  const k = keys[0];
  if (!allowed.has(k)) return false;
  const v = (pattern as Record<string, unknown>)[k];
  if (k === 'absent') return v === true;
  return typeof v === 'string';
}

// Determine whether a stub is fully representable in the form editor, and if
// not, which fields force JSON mode. Query/body patterns count as "absent"
// matchers only for headers/query, not body.
function analyzeMapping(mapping?: StubMapping): { representable: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!mapping) return { representable: true, reasons };

  const req = mapping.request || {};
  Object.keys(req).forEach((k) => {
    if (!MANAGED_REQUEST_KEYS.has(k)) reasons.push(`request.${k}`);
  });
  Object.entries(req.headers || {}).forEach(([k, v]) => {
    if (!isSimplePattern(v, HEADER_QUERY_MATCH_SET)) reasons.push(`request.headers.${k}`);
  });
  Object.entries(req.queryParameters || {}).forEach(([k, v]) => {
    if (!isSimplePattern(v, HEADER_QUERY_MATCH_SET)) reasons.push(`request.queryParameters.${k}`);
  });
  (req.bodyPatterns || []).forEach((p, i) => {
    if (!isSimplePattern(p, BODY_MATCH_SET)) reasons.push(`request.bodyPatterns[${i}]`);
  });

  const res = mapping.response || {};
  Object.keys(res).forEach((k) => {
    if (!MANAGED_RESPONSE_KEYS.has(k)) reasons.push(`response.${k}`);
  });
  if (Array.isArray(res.transformers) && res.transformers.some((t) => t !== 'response-template')) {
    reasons.push('response.transformers');
  }

  Object.keys(mapping).forEach((k) => {
    if (!MANAGED_TOP_KEYS.has(k)) reasons.push(k);
  });

  return { representable: reasons.length === 0, reasons };
}

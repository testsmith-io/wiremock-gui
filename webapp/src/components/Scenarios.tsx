import { useState, useEffect, useCallback } from 'react';
import { useWireMock } from '../App';
import type { Scenario, StubMapping } from '../types/wiremock';

interface Transition {
  from: string;
  to: string;
  stub: StubMapping;
}

export function Scenarios() {
  const { client } = useWireMock();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [selectedStub, setSelectedStub] = useState<StubMapping | null>(null);

  const loadScenarios = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await client.getAllScenarios();
      setScenarios(data.scenarios || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load scenarios');
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => { loadScenarios(); }, [loadScenarios]);

  const handleResetAll = async () => {
    if (!confirm('Reset all scenarios to their initial "Started" state?')) return;
    try {
      await client.resetAllScenarios();
      await loadScenarios();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Reset failed');
    }
  };

  const handleSetState = async (scenarioName: string, state: string) => {
    try {
      await client.setScenarioState(scenarioName, state);
      await loadScenarios();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to set state');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Scenarios</h2>
          <p className="text-sm text-gray-500">
            {scenarios.length} scenario{scenarios.length !== 1 ? 's' : ''} -
            Stateful behaviour via state machine transitions
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadScenarios} className="btn-secondary">Refresh</button>
          <button onClick={handleResetAll} className="btn-warning" disabled={scenarios.length === 0}>
            Reset All to "Started"
          </button>
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
      ) : scenarios.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-4">
          {scenarios.map((scenario) => (
            <ScenarioCard
              key={scenario.id}
              scenario={scenario}
              expanded={expandedScenario === scenario.name}
              onToggle={() => setExpandedScenario(
                expandedScenario === scenario.name ? null : scenario.name
              )}
              onSetState={(state) => handleSetState(scenario.name, state)}
              onSelectStub={setSelectedStub}
            />
          ))}
        </div>
      )}

      {/* Stub detail modal */}
      {selectedStub && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-8" onClick={() => setSelectedStub(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Stub Mapping Detail</h3>
              <button onClick={() => setSelectedStub(null)} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
            </div>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div>
                  <span className="label">Method</span>
                  <MethodBadge method={selectedStub.request?.method} />
                </div>
                <div className="flex-1">
                  <span className="label">URL</span>
                  <p className="font-mono text-sm">{getUrl(selectedStub)}</p>
                </div>
                <div>
                  <span className="label">Response</span>
                  <span className={`badge ${selectedStub.response?.status && selectedStub.response.status < 300 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                    {selectedStub.response?.status || '?'}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 p-3 bg-brand-50 rounded-md">
                <div>
                  <span className="text-xs font-medium text-brand-600">Scenario</span>
                  <p className="text-sm font-semibold text-brand-800">{selectedStub.scenarioName}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-brand-600">Required State</span>
                  <p className="text-sm font-semibold text-brand-800">{selectedStub.requiredScenarioState || '(any)'}</p>
                </div>
                <div>
                  <span className="text-xs font-medium text-brand-600">New State</span>
                  <p className="text-sm font-semibold text-brand-800">{selectedStub.newScenarioState || '(unchanged)'}</p>
                </div>
              </div>
              <div>
                <span className="label">Full JSON</span>
                <pre className="text-xs bg-gray-50 p-3 rounded-md overflow-auto max-h-60 font-mono">
                  {JSON.stringify(selectedStub, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScenarioCard({
  scenario,
  expanded,
  onToggle,
  onSetState,
  onSelectStub,
}: {
  scenario: Scenario;
  expanded: boolean;
  onToggle: () => void;
  onSetState: (state: string) => void;
  onSelectStub: (stub: StubMapping) => void;
}) {
  const transitions = buildTransitions(scenario);
  const stateOrder = buildStateOrder(scenario);

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <svg className={`w-4 h-4 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <h3 className="font-semibold text-gray-900">{scenario.name}</h3>
          <span className="text-xs text-gray-500">
            {scenario.possibleStates.length} states, {transitions.length} transition{transitions.length !== 1 ? 's' : ''}
            {scenario.mappings ? `, ${scenario.mappings.length} stub${scenario.mappings.length !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Current:</span>
          <span className={`badge text-sm ${
            scenario.state === 'Started'
              ? 'bg-accent-50 text-accent-700 border border-accent-300'
              : 'bg-brand-100 text-brand-700 border border-brand-200'
          }`}>
            {scenario.state}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="p-5 space-y-5">
          {/* State flow diagram */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-3">State Flow</h4>
            <StateFlowDiagram
              states={stateOrder}
              transitions={transitions}
              currentState={scenario.state}
              onSelectState={onSetState}
            />
          </div>

          {/* Set state controls */}
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Set State</h4>
            <div className="flex flex-wrap gap-2">
              {scenario.possibleStates.map((state) => (
                <button
                  key={state}
                  onClick={() => onSetState(state)}
                  className={`btn text-xs ${
                    state === scenario.state
                      ? 'bg-brand-500 text-white'
                      : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                  }`}
                  disabled={state === scenario.state}
                >
                  {state === scenario.state && (
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  {state}
                </button>
              ))}
            </div>
          </div>

          {/* Transitions table */}
          {transitions.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Transitions</h4>
              <div className="border border-gray-200 rounded-md overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">From State</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Trigger</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">To State</th>
                      <th className="text-left px-4 py-2 font-medium text-gray-600">Response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transitions.map((t, i) => {
                      const isActive = t.from === scenario.state;
                      return (
                        <tr
                          key={i}
                          onClick={() => onSelectStub(t.stub)}
                          className={`border-b border-gray-100 cursor-pointer transition-colors ${
                            isActive ? 'bg-brand-50 hover:bg-brand-100' : 'hover:bg-gray-50'
                          }`}
                        >
                          <td className="px-4 py-2.5">
                            <StatePill state={t.from} current={scenario.state} />
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <MethodBadge method={t.stub.request?.method} />
                              <span className="font-mono text-xs text-gray-700 truncate max-w-[200px]" title={getUrl(t.stub)}>
                                {getUrl(t.stub)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {t.to ? (
                              <div className="flex items-center gap-1.5">
                                <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <StatePill state={t.to} current={scenario.state} />
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">no change</span>
                            )}
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`badge ${(t.stub.response?.status || 0) < 300 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                              {t.stub.response?.status || '?'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stubs without transitions (no newScenarioState) */}
          {scenario.mappings && scenario.mappings.filter(m => !m.newScenarioState).length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Terminal Stubs (no state change)</h4>
              <div className="space-y-1">
                {scenario.mappings.filter(m => !m.newScenarioState).map((stub) => (
                  <div
                    key={stub.id}
                    onClick={() => onSelectStub(stub)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${
                      stub.requiredScenarioState === scenario.state ? 'bg-brand-50 hover:bg-brand-100' : 'hover:bg-gray-50'
                    }`}
                  >
                    <StatePill state={stub.requiredScenarioState || 'any'} current={scenario.state} />
                    <MethodBadge method={stub.request?.method} />
                    <span className="font-mono text-xs text-gray-700 truncate">{getUrl(stub)}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      &rarr; {stub.response?.status || '?'}
                    </span>
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

function StateFlowDiagram({
  states,
  transitions,
  currentState,
  onSelectState,
}: {
  states: string[];
  transitions: Transition[];
  currentState: string;
  onSelectState: (state: string) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-1">
      {states.map((state, i) => {
        const isCurrent = state === currentState;
        const transitionsFrom = transitions.filter(t => t.from === state);
        const nextState = i < states.length - 1 ? states[i + 1] : null;
        const transitionToNext = nextState
          ? transitionsFrom.find(t => t.to === nextState)
          : null;

        return (
          <div key={state} className="flex items-center gap-1 shrink-0">
            {/* State node */}
            <button
              onClick={() => onSelectState(state)}
              className={`relative px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all hover:shadow-md ${
                isCurrent
                  ? 'bg-brand-500 text-white border-brand-500 shadow-md ring-2 ring-brand-200'
                  : 'bg-white text-gray-700 border-gray-300 hover:border-brand-400'
              }`}
              title={`Click to set state to "${state}"`}
            >
              {state === 'Started' && (
                <span className={`absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full ${isCurrent ? 'bg-accent-400' : 'bg-accent-300'} border-2 border-white`} />
              )}
              {state}
              {isCurrent && (
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] bg-brand-600 text-white px-1 rounded-sm leading-tight">
                  current
                </span>
              )}
            </button>

            {/* Arrow between states */}
            {nextState && (
              <div className="flex flex-col items-center mx-1 shrink-0">
                <svg className="w-8 h-6 text-gray-400" viewBox="0 0 32 24" fill="none">
                  <path d="M2 12h24m0 0l-6-5m6 5l-6 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {transitionToNext && (
                  <span className="text-[10px] text-gray-500 font-mono leading-tight max-w-[80px] truncate" title={`${transitionToNext.stub.request?.method || ''} ${getUrl(transitionToNext.stub)}`}>
                    {transitionToNext.stub.request?.method || ''} {getUrl(transitionToNext.stub).slice(0, 15)}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function StatePill({ state, current }: { state: string; current: string }) {
  const isCurrent = state === current;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${
      isCurrent
        ? 'bg-brand-500 text-white'
        : state === 'Started'
        ? 'bg-accent-50 text-accent-700'
        : 'bg-gray-100 text-gray-700'
    }`}>
      {isCurrent && (
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
      )}
      {state}
    </span>
  );
}

function MethodBadge({ method }: { method?: string }) {
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

function getUrl(m: StubMapping): string {
  return m.request?.url || m.request?.urlPath || m.request?.urlPattern || m.request?.urlPathPattern || '(any)';
}

function buildTransitions(scenario: Scenario): Transition[] {
  if (!scenario.mappings) return [];
  return scenario.mappings
    .filter(m => m.newScenarioState)
    .map(m => ({
      from: m.requiredScenarioState || 'Started',
      to: m.newScenarioState!,
      stub: m,
    }));
}

function buildStateOrder(scenario: Scenario): string[] {
  const transitions = buildTransitions(scenario);
  if (transitions.length === 0) return scenario.possibleStates;

  // Build a DAG and topologically sort states, starting from "Started"
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(state: string) {
    if (visited.has(state)) return;
    visited.add(state);
    order.push(state);
    for (const t of transitions) {
      if (t.from === state) visit(t.to);
    }
  }

  visit('Started');

  // Add any states we missed (disconnected from the main flow)
  for (const s of scenario.possibleStates) {
    if (!visited.has(s)) {
      order.push(s);
    }
  }

  return order;
}

function EmptyState() {
  return (
    <div className="card p-8">
      <div className="text-center mb-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">No Scenarios Defined</h3>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Scenarios enable stateful behaviour. Stubs can transition between states when matched,
          allowing you to model multi-step API flows.
        </p>
      </div>
      <div className="bg-gray-50 rounded-lg p-5 max-w-xl mx-auto">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">How to create a scenario</h4>
        <p className="text-xs text-gray-600 mb-3">
          Add these fields when creating a stub mapping:
        </p>
        <pre className="text-xs bg-white p-3 rounded-md border border-gray-200 font-mono overflow-auto">{`{
  "scenarioName": "my_flow",
  "requiredScenarioState": "Started",
  "newScenarioState": "step_2",
  "request": {
    "method": "GET",
    "urlPath": "/api/resource"
  },
  "response": {
    "status": 200,
    "jsonBody": { "step": 1 }
  }
}`}</pre>
        <ul className="text-xs text-gray-600 mt-3 space-y-1">
          <li><strong>scenarioName</strong> - groups stubs into a scenario</li>
          <li><strong>requiredScenarioState</strong> - only match when scenario is in this state</li>
          <li><strong>newScenarioState</strong> - transition to this state after matching</li>
          <li>All scenarios start in the <strong>"Started"</strong> state</li>
        </ul>
      </div>
    </div>
  );
}

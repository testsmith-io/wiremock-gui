import type { Scenario, StubMapping } from '../../types/wiremock';
import { MethodBadge } from '../shared/badges';
import { getUrl } from '../../utils/stub';
import { StateFlowDiagram, StatePill } from './StateFlowDiagram';

interface Transition {
  from: string;
  to: string;
  stub: StubMapping;
}

export function ScenarioCard({
  scenario,
  expanded,
  onToggle,
  onSetState,
  onSelectStub,
  canWrite,
}: {
  scenario: Scenario;
  expanded: boolean;
  onToggle: () => void;
  onSetState: (state: string) => void;
  onSelectStub: (stub: StubMapping) => void;
  canWrite: boolean;
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
              onSelectState={canWrite ? onSetState : undefined}
            />
          </div>

          {/* Set state controls */}
          {canWrite && (
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
          )}

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

          {/* Stubs without transitions */}
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

  for (const s of scenario.possibleStates) {
    if (!visited.has(s)) {
      order.push(s);
    }
  }

  return order;
}

import { useState, useEffect, useCallback } from 'react';
import { useWireMock } from '../../App';
import { useAuth } from '../../auth/AuthContext';
import type { Scenario, StubMapping } from '../../types/wiremock';
import { MethodBadge } from '../shared/badges';
import { getUrl } from '../../utils/stub';
import { ScenarioCard } from './ScenarioCard';

export function Scenarios() {
  const { client } = useWireMock();
  const { canWrite } = useAuth();
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
          {canWrite && (
            <button onClick={handleResetAll} className="btn-warning" disabled={scenarios.length === 0}>
              Reset All to "Started"
            </button>
          )}
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
              canWrite={canWrite}
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

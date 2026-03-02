import type { StubMapping } from '../../types/wiremock';
import { getUrl } from '../../utils/stub';

interface Transition {
  from: string;
  to: string;
  stub: StubMapping;
}

export function StateFlowDiagram({
  states,
  transitions,
  currentState,
  onSelectState,
}: {
  states: string[];
  transitions: Transition[];
  currentState: string;
  onSelectState?: (state: string) => void;
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
              onClick={() => onSelectState?.(state)}
              disabled={!onSelectState}
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

export function StatePill({ state, current }: { state: string; current: string }) {
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

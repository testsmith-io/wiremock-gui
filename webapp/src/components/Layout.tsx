import { useState, type ReactNode } from 'react';
import type { HealthResponse } from '../types/wiremock';
import { useAuth } from '../auth/AuthContext';
import { formatUptime } from '../utils/formatting';

type Tab = 'stubs' | 'requests' | 'scenarios' | 'recordings' | 'system';

interface LayoutProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  baseUrl: string;
  onConnect: (url: string) => void;
  connected: boolean;
  connecting: boolean;
  health: HealthResponse | null;
  visibleTabs: Tab[];
  children: ReactNode;
}

const allTabs: { id: Tab; label: string; icon: string }[] = [
  { id: 'stubs', label: 'Stubs', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
  { id: 'requests', label: 'Requests', icon: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4' },
  { id: 'scenarios', label: 'Scenarios', icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15' },
  { id: 'recordings', label: 'Recordings', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z' },
  { id: 'system', label: 'System', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z' },
];

function SvgIcon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

const roleBadgeColors: Record<string, string> = {
  admin: 'bg-red-500/20 text-red-300',
  editor: 'bg-yellow-500/20 text-yellow-300',
  viewer: 'bg-blue-500/20 text-blue-300',
};

export function Layout({ activeTab, onTabChange, baseUrl, onConnect, connected, connecting, health, visibleTabs, children }: LayoutProps) {
  const [urlInput, setUrlInput] = useState(baseUrl);
  const { authEnabled, isAuthenticated, username, role, logout } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect(urlInput);
  };

  const tabs = allTabs.filter((t) => visibleTabs.includes(t.id));

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-56 bg-brand-800 text-white flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-brand-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent-400 rounded-lg flex items-center justify-center font-bold text-sm text-brand-900">
              WM
            </div>
            <div>
              <h1 className="font-semibold text-sm leading-none">WireMock</h1>
              <span className="text-xs text-brand-300">GUI Manager</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-500 text-white'
                  : 'text-brand-200 hover:bg-brand-700 hover:text-white'
              }`}
            >
              <SvgIcon d={tab.icon} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* User info / logout */}
        <div className="p-3 border-t border-brand-700">
          {authEnabled && isAuthenticated && username && role ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-brand-200 truncate">{username}</span>
                <span className={`text-xs px-1.5 py-0.5 rounded ${roleBadgeColors[role] || ''}`}>
                  {role}
                </span>
              </div>
              <button
                onClick={logout}
                className="w-full text-xs text-brand-400 hover:text-white transition-colors text-left"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="text-xs text-brand-400">
              {health ? `v${health.version}` : 'Not connected'}
            </div>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Connection bar */}
        <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2 flex-1">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Server</span>
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="http://localhost:8080"
              className="input max-w-sm text-sm"
            />
            <button type="submit" className="btn-primary text-xs" disabled={connecting}>
              {connecting ? 'Connecting...' : 'Connect'}
            </button>
          </form>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-accent-400' : 'bg-red-500'}`} />
            <span className="text-xs text-gray-600">
              {connected
                ? health
                  ? `Connected - ${health.status}`
                  : 'Connected'
                : 'Disconnected'}
            </span>
            {health && (
              <span className="text-xs text-gray-400">
                uptime {formatUptime(health.uptimeInSeconds)}
              </span>
            )}
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {!connected ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <SvgIcon d="M13 10V3L4 14h7v7l9-11h-7z" className="w-8 h-8 text-gray-400" />
                </div>
                <h2 className="text-lg font-semibold text-gray-700">Not Connected</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Enter your WireMock server URL above and click Connect
                </p>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

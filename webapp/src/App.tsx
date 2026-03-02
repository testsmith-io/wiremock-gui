import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { WireMockClient } from './api/wiremock-client';
import type { HealthResponse } from './types/wiremock';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { LoginPage } from './auth/LoginPage';
import { Layout } from './components/Layout';
import { StubMappings } from './components/stubs/StubMappings';
import { RequestJournal } from './components/RequestJournal';
import { Scenarios } from './components/scenarios/Scenarios';
import { Recordings } from './components/Recordings';
import { SystemInfo } from './components/SystemInfo';

interface WireMockContextValue {
  client: WireMockClient;
  health: HealthResponse | null;
  connected: boolean;
  refreshHealth: () => void;
}

const WireMockContext = createContext<WireMockContextValue | null>(null);

export function useWireMock() {
  const ctx = useContext(WireMockContext);
  if (!ctx) throw new Error('useWireMock must be inside WireMockProvider');
  return ctx;
}

type Tab = 'stubs' | 'requests' | 'scenarios' | 'recordings' | 'system';

function getDefaultBaseUrl(): string {
  const saved = localStorage.getItem('wiremock-gui-baseurl');
  if (saved) return saved;
  if (window.location.pathname.includes('/__admin')) {
    return window.location.origin;
  }
  return 'http://localhost:8080';
}

export default function App() {
  const [baseUrl, setBaseUrl] = useState(getDefaultBaseUrl);
  const [client, setClient] = useState(() => new WireMockClient(baseUrl));
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [connected, setConnected] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('stubs');
  const [connecting, setConnecting] = useState(false);

  const checkHealth = useCallback(async () => {
    try {
      const h = await client.getHealth();
      setHealth(h);
      setConnected(true);
    } catch {
      setHealth(null);
      setConnected(false);
    }
  }, [client]);

  const handleConnect = useCallback(async (url: string) => {
    const normalized = url.replace(/\/+$/, '');
    setBaseUrl(normalized);
    localStorage.setItem('wiremock-gui-baseurl', normalized);
    const newClient = new WireMockClient(normalized);
    setClient(newClient);
    setConnecting(true);
    try {
      const h = await newClient.getHealth();
      setHealth(h);
      setConnected(true);
    } catch {
      setHealth(null);
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  const contextValue: WireMockContextValue = {
    client,
    health,
    connected,
    refreshHealth: checkHealth,
  };

  return (
    <AuthProvider baseUrl={baseUrl}>
      <WireMockContext.Provider value={contextValue}>
        <AppContent
          activeTab={activeTab}
          onTabChange={setActiveTab}
          baseUrl={baseUrl}
          onConnect={handleConnect}
          connected={connected}
          connecting={connecting}
          health={health}
          client={client}
        />
      </WireMockContext.Provider>
    </AuthProvider>
  );
}

interface AppContentProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
  baseUrl: string;
  onConnect: (url: string) => void;
  connected: boolean;
  connecting: boolean;
  health: HealthResponse | null;
  client: WireMockClient;
}

function AppContent({ activeTab, onTabChange, baseUrl, onConnect, connected, connecting, health, client }: AppContentProps) {
  const { authEnabled, isAuthenticated, role } = useAuth();

  // sync auth token to the WireMock client (synchronous — must happen before children render)
  const token = localStorage.getItem('wiremock-gui-auth-token');
  client.setAuthToken(token);

  // if auth is enabled and user is not authenticated, show login
  if (connected && authEnabled && !isAuthenticated) {
    return <LoginPage />;
  }

  // filter tabs based on role
  const visibleTabs: Tab[] = ['stubs', 'requests', 'scenarios'];
  if (!authEnabled || role === 'admin') {
    visibleTabs.push('recordings');
  }
  visibleTabs.push('system');

  // if current tab is hidden, switch to stubs
  const effectiveTab = visibleTabs.includes(activeTab) ? activeTab : 'stubs';

  return (
    <Layout
      activeTab={effectiveTab}
      onTabChange={onTabChange}
      baseUrl={baseUrl}
      onConnect={onConnect}
      connected={connected}
      connecting={connecting}
      health={health}
      visibleTabs={visibleTabs}
    >
      {effectiveTab === 'stubs' && <StubMappings />}
      {effectiveTab === 'requests' && <RequestJournal />}
      {effectiveTab === 'scenarios' && <Scenarios />}
      {effectiveTab === 'recordings' && <Recordings />}
      {effectiveTab === 'system' && <SystemInfo />}
    </Layout>
  );
}

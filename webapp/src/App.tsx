import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { WireMockClient } from './api/wiremock-client';
import type { HealthResponse } from './types/wiremock';
import { Layout } from './components/Layout';
import { StubMappings } from './components/StubMappings';
import { RequestJournal } from './components/RequestJournal';
import { Scenarios } from './components/Scenarios';
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
    <WireMockContext.Provider value={contextValue}>
      <Layout
        activeTab={activeTab}
        onTabChange={setActiveTab}
        baseUrl={baseUrl}
        onConnect={handleConnect}
        connected={connected}
        connecting={connecting}
        health={health}
      >
        {activeTab === 'stubs' && <StubMappings />}
        {activeTab === 'requests' && <RequestJournal />}
        {activeTab === 'scenarios' && <Scenarios />}
        {activeTab === 'recordings' && <Recordings />}
        {activeTab === 'system' && <SystemInfo />}
      </Layout>
    </WireMockContext.Provider>
  );
}

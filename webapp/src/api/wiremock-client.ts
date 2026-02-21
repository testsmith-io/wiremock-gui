import type {
  StubMapping,
  StubMappingsResponse,
  RequestJournalResponse,
  ScenariosResponse,
  RecordingStatus,
  HealthResponse,
  VersionResponse,
  NearMissesResponse,
} from '../types/wiremock';

export class WireMockClient {
  constructor(private baseUrl: string) {}

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : ({} as T);
  }

  // Stub Mappings
  async getAllStubMappings(limit?: number, offset?: number): Promise<StubMappingsResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (offset !== undefined) params.set('offset', String(offset));
    const qs = params.toString();
    return this.request(`/__admin/mappings${qs ? '?' + qs : ''}`);
  }

  async getStubMapping(id: string): Promise<StubMapping> {
    return this.request(`/__admin/mappings/${id}`);
  }

  async createStubMapping(mapping: StubMapping): Promise<StubMapping> {
    return this.request('/__admin/mappings', {
      method: 'POST',
      body: JSON.stringify(mapping),
    });
  }

  async updateStubMapping(id: string, mapping: StubMapping): Promise<StubMapping> {
    return this.request(`/__admin/mappings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(mapping),
    });
  }

  async deleteStubMapping(id: string): Promise<void> {
    await this.request(`/__admin/mappings/${id}`, { method: 'DELETE' });
  }

  async deleteAllStubMappings(): Promise<void> {
    await this.request('/__admin/mappings', { method: 'DELETE' });
  }

  async resetStubMappings(): Promise<void> {
    await this.request('/__admin/mappings/reset', { method: 'POST' });
  }

  async persistStubMappings(): Promise<void> {
    await this.request('/__admin/mappings/save', { method: 'POST' });
  }

  async importStubMappings(mappings: StubMappingsResponse): Promise<void> {
    await this.request('/__admin/mappings/import', {
      method: 'POST',
      body: JSON.stringify(mappings),
    });
  }

  async getUnmatchedStubMappings(): Promise<StubMappingsResponse> {
    return this.request('/__admin/mappings/unmatched');
  }

  async removeUnmatchedStubMappings(): Promise<void> {
    await this.request('/__admin/mappings/unmatched', { method: 'DELETE' });
  }

  // Request Journal
  async getAllRequests(limit?: number, since?: string): Promise<RequestJournalResponse> {
    const params = new URLSearchParams();
    if (limit !== undefined) params.set('limit', String(limit));
    if (since) params.set('since', since);
    const qs = params.toString();
    return this.request(`/__admin/requests${qs ? '?' + qs : ''}`);
  }

  async deleteAllRequests(): Promise<void> {
    await this.request('/__admin/requests', { method: 'DELETE' });
  }

  async getUnmatchedRequests(): Promise<RequestJournalResponse> {
    return this.request('/__admin/requests/unmatched');
  }

  async deleteRequest(id: string): Promise<void> {
    await this.request(`/__admin/requests/${id}`, { method: 'DELETE' });
  }

  // Near Misses
  async getNearMissesForUnmatched(): Promise<NearMissesResponse> {
    return this.request('/__admin/requests/unmatched/near-misses');
  }

  // Scenarios
  async getAllScenarios(): Promise<ScenariosResponse> {
    return this.request('/__admin/scenarios');
  }

  async resetAllScenarios(): Promise<void> {
    await this.request('/__admin/scenarios/reset', { method: 'POST' });
  }

  async setScenarioState(scenarioName: string, state: string): Promise<void> {
    await this.request('/__admin/gui/api/set-scenario-state', {
      method: 'POST',
      body: JSON.stringify({ scenarioName, state }),
    });
  }

  // Recordings
  async getRecordingStatus(): Promise<RecordingStatus> {
    return this.request('/__admin/recordings/status');
  }

  async startRecording(targetBaseUrl: string): Promise<void> {
    await this.request('/__admin/recordings/start', {
      method: 'POST',
      body: JSON.stringify({ targetBaseUrl }),
    });
  }

  async stopRecording(): Promise<StubMappingsResponse> {
    return this.request('/__admin/recordings/stop', { method: 'POST' });
  }

  async snapshotRecording(): Promise<StubMappingsResponse> {
    return this.request('/__admin/recordings/snapshot', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // Files
  async getAllFiles(): Promise<string[]> {
    return this.request('/__admin/files');
  }

  async getFile(filename: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/__admin/files/${filename}`);
    return res.text();
  }

  async updateFile(filename: string, content: string): Promise<void> {
    await fetch(`${this.baseUrl}/__admin/files/${filename}`, {
      method: 'PUT',
      body: content,
    });
  }

  async deleteFile(filename: string): Promise<void> {
    await this.request(`/__admin/files/${filename}`, { method: 'DELETE' });
  }

  // System
  async getHealth(): Promise<HealthResponse> {
    return this.request('/__admin/health');
  }

  async getVersion(): Promise<VersionResponse> {
    return this.request('/__admin/version');
  }

  async updateGlobalSettings(settings: Record<string, unknown>): Promise<void> {
    await this.request('/__admin/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    });
  }

  async resetAll(): Promise<void> {
    await this.request('/__admin/reset', { method: 'POST' });
  }

  async shutdown(): Promise<void> {
    await this.request('/__admin/shutdown', { method: 'POST' });
  }
}

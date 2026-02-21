export interface StubMapping {
  id?: string;
  uuid?: string;
  name?: string;
  request: RequestPattern;
  response: ResponseDefinition;
  persistent?: boolean;
  priority?: number;
  scenarioName?: string;
  requiredScenarioState?: string;
  newScenarioState?: string;
  postServeActions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface StubMappingsResponse {
  mappings: StubMapping[];
  meta: { total: number };
}

export interface RequestPattern {
  method?: string;
  url?: string;
  urlPath?: string;
  urlPattern?: string;
  urlPathPattern?: string;
  headers?: Record<string, ContentPattern>;
  queryParameters?: Record<string, ContentPattern>;
  cookies?: Record<string, ContentPattern>;
  bodyPatterns?: ContentPattern[];
  basicAuthCredentials?: { username: string; password: string };
  [key: string]: unknown;
}

export interface ContentPattern {
  equalTo?: string;
  contains?: string;
  matches?: string;
  doesNotMatch?: string;
  equalToJson?: string;
  equalToXml?: string;
  matchesJsonPath?: string | { expression: string; [key: string]: unknown };
  absent?: boolean;
  [key: string]: unknown;
}

export interface ResponseDefinition {
  status?: number;
  statusMessage?: string;
  headers?: Record<string, string>;
  body?: string;
  base64Body?: string;
  jsonBody?: unknown;
  bodyFileName?: string;
  fault?: string;
  fixedDelayMilliseconds?: number;
  delayDistribution?: DelayDistribution;
  proxyBaseUrl?: string;
  transformers?: string[];
  transformerParameters?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface DelayDistribution {
  type: 'lognormal' | 'uniform' | 'fixed';
  median?: number;
  sigma?: number;
  lower?: number;
  upper?: number;
  milliseconds?: number;
}

export interface LoggedRequest {
  id: string;
  request: {
    url: string;
    absoluteUrl: string;
    method: string;
    clientIp?: string;
    headers: Record<string, string>;
    cookies?: Record<string, string>;
    body: string;
    bodyAsBase64?: string;
    browserProxyRequest?: boolean;
    loggedDate: number;
    loggedDateString: string;
  };
  responseDefinition: {
    status: number;
    body?: string;
    headers?: Record<string, string>;
    fromConfiguredStub?: boolean;
    [key: string]: unknown;
  };
}

export interface RequestJournalResponse {
  requests: LoggedRequest[];
  meta: { total: number };
  requestJournalDisabled?: boolean;
}

export interface Scenario {
  id: string;
  name: string;
  state: string;
  possibleStates: string[];
  mappings?: StubMapping[];
}

export interface ScenariosResponse {
  scenarios: Scenario[];
}

export interface RecordingStatus {
  status: 'NeverStarted' | 'Recording' | 'Stopped';
}

export interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  message: string;
  version: string;
  uptimeInSeconds: number;
  timestamp: string;
}

export interface VersionResponse {
  version: string;
}

export interface NearMiss {
  request: {
    url: string;
    absoluteUrl: string;
    method: string;
    headers?: Record<string, string>;
    body?: string;
    [key: string]: unknown;
  };
  requestPattern: {
    url?: string;
    urlPath?: string;
    method?: string;
    [key: string]: unknown;
  };
  matchResult: {
    distance: number;
  };
}

export interface NearMissesResponse {
  nearMisses: NearMiss[];
}

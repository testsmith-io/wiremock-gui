import type { StubMapping } from '../types/wiremock';

export function getUrl(m: StubMapping): string {
  return m.request?.url || m.request?.urlPath || m.request?.urlPattern || m.request?.urlPathPattern || '(any)';
}

export function getSection(m: StubMapping): string {
  return (m.metadata as Record<string, unknown>)?.section as string || '';
}

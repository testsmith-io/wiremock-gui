import type { OpenApiSpec, SchemaObject, OperationObject, ResponseObject } from '../types/openapi';
import type { StubMapping } from '../types/wiremock';

export interface ParsedEndpoint {
  path: string;
  method: string;
  operationId?: string;
  summary?: string;
  tags?: string[];
  responses: ParsedResponse[];
}

export interface ParsedResponse {
  statusCode: number;
  description?: string;
  mediaType?: string;
  exampleBody?: unknown;
}

export interface ParseResult {
  endpoints: ParsedEndpoint[];
  title: string;
  version: string;
  errors: string[];
}

const HTTP_METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'] as const;

// --- $ref resolution ---

function lookupRef(spec: unknown, refPath: string): unknown {
  const parts = refPath.replace(/^#\//, '').split('/');
  let current: unknown = spec;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function resolveAllRefs(spec: unknown): unknown {
  const resolving = new Set<string>();

  function resolve(node: unknown): unknown {
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map(resolve);

    const obj = node as Record<string, unknown>;
    if (typeof obj.$ref === 'string') {
      const refPath = obj.$ref;
      if (resolving.has(refPath)) return {};
      resolving.add(refPath);
      const target = lookupRef(spec, refPath);
      if (target === undefined) {
        resolving.delete(refPath);
        return {};
      }
      const resolved = resolve(structuredClone(target));
      resolving.delete(refPath);
      return resolved;
    }

    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = resolve(value);
    }
    return result;
  }

  return resolve(spec);
}

// --- Example generation from schema ---

const FORMAT_EXAMPLES: Record<string, string> = {
  email: 'user@example.com',
  date: '2024-01-01',
  'date-time': '2024-01-01T00:00:00Z',
  uuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  uri: 'https://example.com',
  url: 'https://example.com',
  hostname: 'example.com',
  ipv4: '192.168.1.1',
  ipv6: '::1',
  password: 'password123',
  byte: 'c3RyaW5n',
  binary: 'binary-data',
  phone: '+1-555-0100',
};

function generateExampleFromSchema(schema: SchemaObject | undefined, depth = 0): unknown {
  if (!schema || depth > 10) return undefined;

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum && schema.enum.length > 0) return schema.enum[0];

  if (schema.allOf && schema.allOf.length > 0) {
    const merged: Record<string, unknown> = {};
    for (const sub of schema.allOf) {
      const val = generateExampleFromSchema(sub, depth + 1);
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        Object.assign(merged, val);
      }
    }
    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  if (schema.oneOf && schema.oneOf.length > 0) {
    return generateExampleFromSchema(schema.oneOf[0], depth + 1);
  }
  if (schema.anyOf && schema.anyOf.length > 0) {
    return generateExampleFromSchema(schema.anyOf[0], depth + 1);
  }

  const type = schema.type || (schema.properties ? 'object' : undefined);

  switch (type) {
    case 'string':
      if (schema.format && FORMAT_EXAMPLES[schema.format]) {
        return FORMAT_EXAMPLES[schema.format];
      }
      return 'string';
    case 'integer':
    case 'int32':
    case 'int64':
      return 0;
    case 'number':
      return 0.0;
    case 'boolean':
      return true;
    case 'array': {
      const itemExample = generateExampleFromSchema(schema.items, depth + 1);
      return itemExample !== undefined ? [itemExample] : [];
    }
    case 'object': {
      if (!schema.properties) return {};
      const obj: Record<string, unknown> = {};
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        const val = generateExampleFromSchema(propSchema, depth + 1);
        if (val !== undefined) obj[key] = val;
      }
      return obj;
    }
    default:
      if (schema.properties) {
        const obj: Record<string, unknown> = {};
        for (const [key, propSchema] of Object.entries(schema.properties)) {
          const val = generateExampleFromSchema(propSchema, depth + 1);
          if (val !== undefined) obj[key] = val;
        }
        return Object.keys(obj).length > 0 ? obj : undefined;
      }
      return undefined;
  }
}

// --- Response extraction ---

function extractResponsesOAS3(
  responses: Record<string, ResponseObject>
): ParsedResponse[] {
  const result: ParsedResponse[] = [];

  for (const [statusStr, resp] of Object.entries(responses)) {
    const statusCode = statusStr === 'default' ? 200 : parseInt(statusStr, 10);
    if (isNaN(statusCode)) continue;

    if (!resp.content) {
      result.push({ statusCode, description: resp.description });
      continue;
    }

    for (const [mediaType, mediaObj] of Object.entries(resp.content)) {
      let exampleBody: unknown = undefined;

      if (mediaObj.example !== undefined) {
        exampleBody = mediaObj.example;
      } else if (mediaObj.examples) {
        const firstExample = Object.values(mediaObj.examples)[0];
        if (firstExample?.value !== undefined) {
          exampleBody = firstExample.value;
        }
      }

      if (exampleBody === undefined && mediaObj.schema) {
        exampleBody = generateExampleFromSchema(mediaObj.schema);
      }

      result.push({
        statusCode,
        description: resp.description,
        mediaType,
        exampleBody,
      });
      break; // take only first media type per status code
    }
  }

  return result;
}

function extractResponsesSwagger2(
  responses: Record<string, ResponseObject>,
  produces: string[]
): ParsedResponse[] {
  const result: ParsedResponse[] = [];
  const mediaType = produces[0] || 'application/json';

  for (const [statusStr, resp] of Object.entries(responses)) {
    const statusCode = statusStr === 'default' ? 200 : parseInt(statusStr, 10);
    if (isNaN(statusCode)) continue;

    let exampleBody: unknown = undefined;
    if (resp.schema) {
      exampleBody = generateExampleFromSchema(resp.schema);
    }

    result.push({
      statusCode,
      description: resp.description,
      mediaType,
      exampleBody,
    });
  }

  return result;
}

// --- Main parser ---

export function parseOpenApiSpec(json: unknown): ParseResult {
  const errors: string[] = [];

  if (!json || typeof json !== 'object') {
    return { endpoints: [], title: '', version: '', errors: ['Input is not a valid object.'] };
  }

  const spec = json as OpenApiSpec;
  if (!spec.openapi && !spec.swagger) {
    return {
      endpoints: [],
      title: '',
      version: '',
      errors: ['Not an OpenAPI specification. Expected an "openapi" or "swagger" field.'],
    };
  }

  const isSwagger2 = !!spec.swagger;
  const title = spec.info?.title || 'Untitled API';
  const version = spec.info?.version || '';

  // Resolve all $ref references
  const resolved = resolveAllRefs(json) as OpenApiSpec;

  if (!resolved.paths || Object.keys(resolved.paths).length === 0) {
    return { endpoints: [], title, version, errors: ['No paths found in the specification.'] };
  }

  const globalProduces = resolved.produces || ['application/json'];
  const endpoints: ParsedEndpoint[] = [];

  for (const [path, pathItem] of Object.entries(resolved.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method] as OperationObject | undefined;
      if (!operation) continue;

      let responses: ParsedResponse[] = [];
      if (operation.responses) {
        if (isSwagger2) {
          const produces = operation.produces || globalProduces;
          responses = extractResponsesSwagger2(operation.responses, produces);
        } else {
          responses = extractResponsesOAS3(operation.responses);
        }
      }

      endpoints.push({
        path: isSwagger2 && resolved.basePath && resolved.basePath !== '/'
          ? resolved.basePath + path
          : path,
        method: method.toUpperCase(),
        operationId: operation.operationId,
        summary: operation.summary || operation.description,
        tags: operation.tags,
        responses,
      });
    }
  }

  return { endpoints, title, version, errors };
}

// --- Stub mapping generation ---

export function generateStubMappings(
  endpoints: ParsedEndpoint[],
  selectedIndices: Set<number>,
  sectionName: string,
  useTagsAsSection: boolean
): StubMapping[] {
  const mappings: StubMapping[] = [];

  for (const idx of selectedIndices) {
    const ep = endpoints[idx];
    if (!ep) continue;

    const hasPathParams = /\{[^}]+\}/.test(ep.path);
    const successResponse = ep.responses.find(r => r.statusCode >= 200 && r.statusCode < 300)
      || ep.responses[0];

    const mapping: StubMapping = {
      name: ep.operationId || `${ep.method} ${ep.path}`,
      request: {
        method: ep.method,
      },
      response: {
        status: successResponse?.statusCode || 200,
      },
    };

    if (hasPathParams) {
      mapping.request.urlPathPattern = ep.path.replace(/\{[^}]+\}/g, '[^/]+');
    } else {
      mapping.request.urlPath = ep.path;
    }

    const contentType = successResponse?.mediaType || 'application/json';
    mapping.response.headers = { 'Content-Type': contentType };

    if (successResponse?.exampleBody !== undefined && successResponse.exampleBody !== null) {
      mapping.response.jsonBody = successResponse.exampleBody;
    }

    // Section: use OpenAPI tags or manual override
    const section = useTagsAsSection && ep.tags?.[0]
      ? ep.tags[0]
      : sectionName.trim();
    if (section) {
      mapping.metadata = { section };
    }

    mappings.push(mapping);
  }

  return mappings;
}

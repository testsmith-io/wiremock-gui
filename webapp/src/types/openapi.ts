export interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info?: { title?: string; version?: string; description?: string };
  basePath?: string;
  produces?: string[];
  paths?: Record<string, PathItem>;
  components?: { schemas?: Record<string, SchemaObject> };
  definitions?: Record<string, SchemaObject>;
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  delete?: OperationObject;
  patch?: OperationObject;
  head?: OperationObject;
  options?: OperationObject;
  parameters?: ParameterObject[];
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses?: Record<string, ResponseObject>;
  produces?: string[];
}

export interface ParameterObject {
  name: string;
  in: 'path' | 'query' | 'header' | 'cookie' | 'body';
  required?: boolean;
  schema?: SchemaObject;
  type?: string;
}

export interface RequestBodyObject {
  content?: Record<string, MediaTypeObject>;
  required?: boolean;
}

export interface ResponseObject {
  description?: string;
  content?: Record<string, MediaTypeObject>;
  schema?: SchemaObject;
  headers?: Record<string, unknown>;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, { value?: unknown }>;
}

export interface SchemaObject {
  $ref?: string;
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  required?: string[];
  items?: SchemaObject;
  enum?: unknown[];
  example?: unknown;
  default?: unknown;
  allOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  additionalProperties?: boolean | SchemaObject;
  nullable?: boolean;
  description?: string;
  title?: string;
}

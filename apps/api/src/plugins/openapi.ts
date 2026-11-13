import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

import type { RouteMethod } from './route.js';

// Mirrors the error envelope in docs/backend/api-contract.md. Replace with the shared
// errorSchema once packages/shared exports it (Khoa's handoff).
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(
      z.object({
        field: z.string().optional(),
        reason: z.string(),
        message: z.string().optional(),
      }),
    ),
  }),
});

const ERROR_DESCRIPTIONS: Record<number, string> = {
  400: 'Validation error',
  401: 'Authentication required',
  403: 'Access denied',
  404: 'Not found',
  409: 'Conflict',
  422: 'Invalid state',
  503: 'Service unavailable',
};

export interface OpenApiOperation {
  method: RouteMethod;
  url: string;
  summary: string;
  isPublic: boolean;
  status: number;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  body?: z.ZodTypeAny;
  response: z.ZodTypeAny;
  envelope: boolean;
  errors: number[];
}

type JsonSchema = { properties?: Record<string, unknown>; required?: string[] };

function jsonSchema(schema: z.ZodTypeAny) {
  return zodToJsonSchema(schema, { target: 'openApi3', $refStrategy: 'none' });
}

function toParameters(location: 'path' | 'query', schema?: z.ZodTypeAny) {
  if (!schema) return [];
  const { properties = {}, required = [] } = jsonSchema(schema) as JsonSchema;
  return Object.entries(properties).map(([name, value]) => ({
    in: location,
    name,
    required: location === 'path' || required.includes(name),
    schema: value,
  }));
}

/** Collects operations as routes are registered and renders one OpenAPI 3 document. */
export class OpenApiRegistry {
  private readonly operations: OpenApiOperation[] = [];

  add(operation: OpenApiOperation) {
    this.operations.push(operation);
  }

  document() {
    const paths: Record<string, Record<string, unknown>> = {};
    for (const operation of this.operations) {
      const key = operation.url.replace(/:([A-Za-z]+)/g, '{$1}');
      const success = jsonSchema(
        operation.envelope ? z.object({ data: operation.response }) : operation.response,
      );
      const errors = Object.fromEntries(
        [...new Set(operation.errors)].map((status) => [
          String(status),
          {
            description: ERROR_DESCRIPTIONS[status] ?? 'Error',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        ]),
      );
      (paths[key] ??= {})[operation.method.toLowerCase()] = {
        summary: operation.summary,
        security: operation.isPublic ? [] : [{ bearerAuth: [] }],
        parameters: [
          ...toParameters('path', operation.params),
          ...toParameters('query', operation.query),
        ],
        ...(operation.body
          ? {
              requestBody: {
                required: true,
                content: { 'application/json': { schema: jsonSchema(operation.body) } },
              },
            }
          : {}),
        responses: {
          [String(operation.status)]: {
            description: 'Success',
            content: { 'application/json': { schema: success } },
          },
          ...errors,
        },
      };
    }
    return {
      openapi: '3.0.3',
      info: { title: 'FrameRoom API', version: '0.1.0' },
      components: {
        securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' } },
        schemas: { Error: jsonSchema(errorResponseSchema) },
      },
      paths,
    };
  }
}

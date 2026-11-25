export interface ValidationError {
  path: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  strippedFields?: string[];
}

export interface JsonSchemaNode {
  type?: 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array';
  const?: unknown;
  enum?: unknown[];
  required?: string[];
  properties?: Record<string, JsonSchemaNode>;
  additionalProperties?: boolean;
  items?: JsonSchemaNode;
  maxItems?: number;
  uniqueItems?: boolean;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  pattern?: string;
  format?: 'uuid' | 'date-time' | 'uri';
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function checkFormat(value: string, format: 'uuid' | 'date-time' | 'uri'): string | null {
  if (format === 'uuid') {
    return UUID_REGEX.test(value) ? null : 'must be a valid UUID';
  }
  if (format === 'date-time') {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return 'must be a valid ISO date-time';
    return null;
  }
  if (format === 'uri') {
    try {
      new URL(value);
      return null;
    } catch {
      return 'must be a valid URI';
    }
  }
  return null;
}

export function validateSchema(
  value: unknown,
  schema: JsonSchemaNode,
  path = '$',
  options: { relaxAdditionalProperties?: boolean; strippedFields?: string[] } = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const strippedFields = options.strippedFields ?? [];

  if (schema.const !== undefined && value !== schema.const) {
    errors.push({ path, message: `must equal "${String(schema.const)}"` });
    return { valid: false, errors, strippedFields };
  }

  if (schema.enum !== undefined && !schema.enum.includes(value)) {
    errors.push({ path, message: `must be one of: ${schema.enum.join(', ')}` });
    return { valid: false, errors, strippedFields };
  }

  if (schema.type) {
    if (schema.type === 'array') {
      if (!Array.isArray(value)) {
        errors.push({ path, message: 'must be an array' });
        return { valid: false, errors, strippedFields };
      }
    } else if (schema.type === 'integer') {
      if (typeof value !== 'number' || !Number.isInteger(value)) {
        errors.push({ path, message: 'must be an integer' });
        return { valid: false, errors, strippedFields };
      }
    } else if (schema.type === 'object') {
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        errors.push({ path, message: 'must be an object' });
        return { valid: false, errors, strippedFields };
      }
    } else if (typeof value !== schema.type) {
      errors.push({ path, message: `must be of type ${schema.type}` });
      return { valid: false, errors, strippedFields };
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path, message: `must be at least ${schema.minLength} characters` });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path, message: `must be at most ${schema.maxLength} characters` });
    }
    if (schema.pattern !== undefined) {
      const rx = new RegExp(schema.pattern, 'u');
      if (!rx.test(value)) {
        errors.push({ path, message: 'contains invalid characters' });
      }
    }
    if (schema.format !== undefined) {
      const fmtErr = checkFormat(value, schema.format);
      if (fmtErr) errors.push({ path, message: fmtErr });
    }
  }

  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({ path, message: `must be >= ${schema.minimum}` });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({ path, message: `must be <= ${schema.maximum}` });
    }
  }

  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) {
      errors.push({ path, message: `must contain at most ${schema.maxItems} items` });
    }
    if (schema.uniqueItems) {
      const seen = new Set(value.map((v) => JSON.stringify(v)));
      if (seen.size !== value.length) {
        errors.push({ path, message: 'items must be unique' });
      }
    }
    if (schema.items) {
      value.forEach((item, index) => {
        const res = validateSchema(item, schema.items!, `${path}[${index}]`, options);
        errors.push(...res.errors);
      });
    }
  }

  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    if (schema.required) {
      for (const reqKey of schema.required) {
        if (record[reqKey] === undefined) {
          errors.push({ path: `${path}.${reqKey}`, message: 'is required' });
        }
      }
    }
    if (schema.properties) {
      for (const [key, propVal] of Object.entries(record)) {
        const propSchema = schema.properties[key];
        if (propSchema) {
          if (propVal !== undefined) {
            const res = validateSchema(propVal, propSchema, `${path}.${key}`, options);
            errors.push(...res.errors);
          }
        } else if (propVal !== undefined && schema.additionalProperties === false) {
          if (options.relaxAdditionalProperties) {
            strippedFields.push(`${path}.${key}`);
            delete record[key];
          } else {
            errors.push({ path: `${path}.${key}`, message: 'unknown property is not allowed' });
          }
        }
      }
    }
  }

  return { valid: errors.length === 0, errors, strippedFields };
}

export const EXPERT_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'name', 'role', 'systemPrompt', 'enabled', 'tags', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string', minLength: 1, maxLength: 60, pattern: "^[\\p{L}0-9 _&'./-]+$" },
    role: { type: 'string', minLength: 1, maxLength: 200 },
    systemPrompt: { type: 'string', minLength: 20, maxLength: 8000 },
    temperature: { type: 'number', minimum: 0, maximum: 1.5 },
    enabled: { type: 'boolean' },
    tags: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 40 },
      maxItems: 20,
      uniqueItems: true,
    },
    isSeed: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export const GUARDRAILS_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'version', 'editable', 'honestyRule', 'updatedAt'],
  properties: {
    id: { type: 'string', const: 'default' },
    version: { type: 'integer', minimum: 1 },
    editable: {
      type: 'object',
      additionalProperties: false,
      properties: {
        essence: { type: 'string', maxLength: 400 },
        materials: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 30 },
        colourAndLight: { type: 'array', items: { type: 'string', maxLength: 160 }, maxItems: 30 },
        people: { type: 'string', maxLength: 400 },
        cinema: { type: 'string', maxLength: 600 },
        emotion: { type: 'string', maxLength: 300 },
        avoid: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 30 },
        extraNotes: { type: 'string', maxLength: 2000 },
      },
    },
    honestyRule: { type: 'string', minLength: 50, maxLength: 1200 },
    editedBy: { type: 'string', maxLength: 120 },
    updatedAt: { type: 'string', format: 'date-time' },
    history: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        required: ['snapshot', 'savedAt'],
        properties: {
          snapshot: { type: 'object' },
          savedAt: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

export const SETTINGS_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['provider', 'model', 'temperature', 'language', 'theme'],
  properties: {
    provider: { type: 'string', enum: ['groq', 'openrouter', 'openai', 'mock'] },
    model: { type: 'string', minLength: 0, maxLength: 200 },
    temperature: { type: 'number', minimum: 0, maximum: 1.5 },
    language: { type: 'string', enum: ['auto', 'sv', 'en', 'bilingual'] },
    machinePrompt: { type: 'string', maxLength: 4000 },
    theme: { type: 'string', enum: ['light', 'dark'] },
    rememberKey: { type: 'boolean' },
    strictMode: { type: 'boolean' },
    debug: { type: 'boolean' },
  },
};

export const LIBRARY_ITEM_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'content', 'type', 'tags', 'createdAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string', minLength: 1, maxLength: 160 },
    content: { type: 'string', minLength: 1, maxLength: 100000 },
    type: { type: 'string', enum: ['copy', 'campaign', 'research', 'visual-brief', 'note'] },
    tags: {
      type: 'array',
      items: { type: 'string', minLength: 1, maxLength: 40 },
      maxItems: 20,
      uniqueItems: true,
    },
    sourceChatId: { type: 'string', format: 'uuid' },
    sourceMessageId: { type: 'string', format: 'uuid' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
};

export const CHAT_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'title', 'createdAt', 'updatedAt'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    title: { type: 'string', minLength: 1, maxLength: 120 },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
    sessionFacts: {
      type: 'object',
      additionalProperties: false,
      properties: {
        constraints: { type: 'array', items: { type: 'string', maxLength: 300 }, maxItems: 20 },
        audience: { type: 'array', items: { type: 'string', maxLength: 300 }, maxItems: 20 },
        budget: { type: 'string', maxLength: 200 },
        awards: { type: 'array', items: { type: 'string', maxLength: 300 }, maxItems: 20 },
        channels: { type: 'array', items: { type: 'string', maxLength: 120 }, maxItems: 20 },
        focus: { type: 'string', maxLength: 400 },
        referencePhoto: { type: 'string', maxLength: 1000 },
        notes: { type: 'array', items: { type: 'string', maxLength: 300 }, maxItems: 20 },
      },
    },
  },
};

export const MESSAGE_SCHEMA: JsonSchemaNode = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'chatId', 'role', 'content', 'timestamp'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    chatId: { type: 'string', format: 'uuid' },
    role: { type: 'string', enum: ['user', 'jennifer', 'expert', 'system'] },
    expertName: { type: 'string', maxLength: 60 },
    content: { type: 'string', minLength: 1, maxLength: 60000 },
    timestamp: { type: 'string', format: 'date-time' },
    status: { type: 'string', enum: ['complete', 'streaming', 'stopped', 'error'] },
    savedToLibrary: { type: 'boolean' },
    turnId: { type: 'string', format: 'uuid' },
    handoffText: { type: 'string', maxLength: 2000 },
    delegatedExperts: {
      type: 'array',
      items: { type: 'string', maxLength: 60 },
      maxItems: 10,
    },
    errorData: {
      type: 'object',
      additionalProperties: false,
      required: ['code', 'provider'],
      properties: {
        code: { type: 'string', maxLength: 40 },
        provider: { type: 'string', enum: ['groq', 'openrouter', 'openai', 'mock'] },
        status: { type: 'integer' },
        retryAfterMs: { type: 'number' },
        modelId: { type: 'string', maxLength: 200 },
        lastUserMessage: { type: 'string', maxLength: 60000 },
      },
    },
  },
};

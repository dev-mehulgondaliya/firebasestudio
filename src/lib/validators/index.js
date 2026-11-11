import { z } from "zod";

// ---------------------------------------------------------------- firestore

const segment = z.string().min(1).max(1500).refine((value) => !value.includes("/"), "Path segments cannot contain '/'");

function splitPath(path) {
  return path.replace(/^\/+|\/+$/g, "").split("/");
}

export const collectionPathSchema = z
  .string()
  .trim()
  .min(1, "Collection path is required")
  .max(6000)
  .refine((path) => {
    const parts = splitPath(path);
    return parts.length % 2 === 1 && parts.every((part) => segment.safeParse(part).success);
  }, "Collection paths have an odd number of segments, e.g. users or users/uid/orders")
  .transform((path) => splitPath(path).join("/"));

export const documentPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(6000)
  .refine((path) => {
    const parts = splitPath(path);
    return parts.length % 2 === 0 && parts.every((part) => segment.safeParse(part).success);
  }, "Document paths have an even number of segments, e.g. users/uid")
  .transform((path) => splitPath(path).join("/"));

export const documentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(1500)
  .refine((id) => !id.includes("/") && id !== "." && id !== ".." && !/^__.*__$/.test(id), "Invalid document ID");

/** Encoded document data (see lib/firestore/codec.js). Must be a JSON object. */
export const documentDataSchema = z.record(z.string(), z.unknown());

export const FILTER_OPERATORS = ["==", "!=", "<", "<=", ">", ">=", "array-contains", "array-contains-any", "in", "not-in"];

export const filterSchema = z.object({
  field: z.string().trim().min(1).max(1500),
  op: z.enum(FILTER_OPERATORS),
  value: z.unknown(),
});

export const listDocumentsSchema = z.object({
  connectionId: z.string().min(1),
  collection: collectionPathSchema,
  limit: z.coerce.number().int().min(1).max(500).default(50),
  cursor: z.string().max(1500).optional(),
  orderBy: z.string().trim().max(1500).optional(),
  direction: z.enum(["asc", "desc"]).default("asc"),
  filters: z
    .string()
    .optional()
    .transform((text, ctx) => {
      if (!text) return [];
      try {
        return z.array(filterSchema).max(10).parse(JSON.parse(text));
      } catch {
        ctx.addIssue({ code: "custom", message: "filters must be a JSON array of {field, op, value}" });
        return z.NEVER;
      }
    }),
});

export const createDocumentSchema = z.object({
  connectionId: z.string().min(1),
  collection: collectionPathSchema,
  id: documentIdSchema.optional(),
  data: documentDataSchema,
});

export const writeDocumentSchema = z.object({
  connectionId: z.string().min(1),
  data: documentDataSchema,
  merge: z.boolean().default(false),
});

export const importDocumentsSchema = z.object({
  connectionId: z.string().min(1),
  collection: collectionPathSchema,
  merge: z.boolean().default(false),
  documents: z
    .array(z.object({ id: documentIdSchema, data: documentDataSchema }))
    .min(1)
    .max(500),
});

// -------------------------------------------------------------- connections

export const webConfigSchema = z
  .object({
    apiKey: z.string().trim().min(1, "apiKey is required"),
    authDomain: z.string().trim().optional(),
    projectId: z.string().trim().min(1, "projectId is required"),
    appId: z.string().trim().optional(),
    storageBucket: z.string().trim().optional(),
    messagingSenderId: z.string().trim().optional(),
    measurementId: z.string().trim().optional(),
    databaseURL: z.string().trim().optional(),
  })
  .strip();

export const serviceAccountSchema = z
  .object({
    type: z.literal("service_account", { message: 'type must be "service_account"' }),
    project_id: z.string().min(1),
    private_key_id: z.string().optional(),
    private_key: z.string().includes("PRIVATE KEY", { message: "private_key is missing or malformed" }),
    client_email: z.email({ message: "client_email must be an email address" }),
    client_id: z.string().optional(),
    auth_uri: z.string().optional(),
    token_uri: z.string().optional(),
    auth_provider_x509_cert_url: z.string().optional(),
    client_x509_cert_url: z.string().optional(),
    universe_domain: z.string().optional(),
  })
  .strip();

const connectionName = z.string().trim().min(1, "Name is required").max(80);

export const createConnectionSchema = z.discriminatedUnion("connectionType", [
  z.object({
    connectionType: z.literal("web"),
    name: connectionName,
    webConfig: webConfigSchema,
  }),
  z.object({
    connectionType: z.literal("admin"),
    name: connectionName,
    serviceAccount: serviceAccountSchema,
    acknowledgeAdminAccess: z.literal(true, {
      message: "You must acknowledge that Admin SDK access bypasses security rules",
    }),
  }),
]);

export const updateConnectionSchema = z.object({
  name: connectionName.optional(),
});

// ------------------------------------------------------------------ scripts

export const EXECUTION_MODES = ["browser", "server"];

export const scriptCodeSchema = z.string().max(200_000, "Scripts are limited to 200 KB");

export const createScriptSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  code: scriptCodeSchema,
  connectionId: z.string().min(1).nullable().optional(),
  description: z.string().max(500).optional(),
});

export const updateScriptSchema = createScriptSchema.partial();

// ---------------------------------------------------------------- execution

export const serverExecutionSchema = z.object({
  connectionId: z.string().min(1),
  code: scriptCodeSchema.min(1, "Nothing to run"),
  scriptId: z.string().min(1).nullable().optional(),
  timeoutMs: z.number().int().min(1000).max(120_000).optional(),
});

const logEntrySchema = z.object({ level: z.string().max(20) }).passthrough();

export const clientExecutionReportSchema = z.object({
  connectionId: z.string().min(1),
  scriptId: z.string().min(1).nullable().optional(),
  code: scriptCodeSchema,
  status: z.enum(["success", "error", "timeout"]),
  durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000),
  logs: z.array(logEntrySchema).max(2000).default([]),
  result: z.unknown().optional(),
  error: z
    .object({ name: z.string().max(200).optional(), message: z.string().max(5000) })
    .passthrough()
    .nullable()
    .optional(),
});

export const auditEventSchema = z.object({
  connectionId: z.string().min(1).nullable().optional(),
  operation: z.enum(["document.create", "document.update", "document.delete", "document.import"]),
  resource: z.string().max(6000).nullable().optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

// ----------------------------------------------------------------- settings

export const settingsSchema = z
  .object({
    storeOutputInHistory: z.boolean(),
    confirmDeletes: z.boolean(),
    defaultTimeoutSeconds: z.number().int().min(1).max(120),
  })
  .partial();

export const loginSchema = z.object({
  password: z.string().min(1, "Password is required").max(500),
});

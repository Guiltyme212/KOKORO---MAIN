import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  ANTHROPIC_BASE_URL: z.string().url(),
  ANTHROPIC_API_KEY: z.string().min(20),
  ANTHROPIC_MODEL: z.string().default('claude-opus-4-7'),

  WHISPER_API_KEY: z.string().min(20),
  WHISPER_BASE_URL: z.string().url().default('https://api.openai.com/v1'),

  SUNO_BASE_URL: z.string().url().default('https://api.acedata.cloud/suno'),
  SUNO_API_KEY: z.string().min(20),

  BLOB_DRIVER: z.enum(['filesystem', 's3']).default('filesystem'),
  BLOB_FS_DIR: z.string().default('./blob-data'),
  BLOB_S3_BUCKET: z.string().optional(),
  BLOB_S3_ENDPOINT: z.string().url().optional(),
  BLOB_S3_ACCESS_KEY: z.string().optional(),
  BLOB_S3_SECRET_KEY: z.string().optional(),
  BLOB_PUBLIC_BASE_URL: z.string().url().optional(),

  CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

export type Config = z.infer<typeof ConfigSchema>;

export const loadConfig = (): Config => {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('Invalid config:', parsed.error.flatten());
    process.exit(1);
  }
  return parsed.data;
};

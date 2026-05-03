import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = Fastify({ logger: { level: config.NODE_ENV === 'production' ? 'info' : 'debug' } });

await app.register(cors, { origin: config.CORS_ORIGIN.split(','), credentials: true });

app.get('/health', async () => ({ ok: true, ts: Date.now() }));

const port = config.PORT;
await app.listen({ host: '0.0.0.0', port });
app.log.info(`kokoro-api listening on :${port}`);

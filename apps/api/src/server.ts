import 'dotenv/config';
import cors from '@fastify/cors';
import Fastify from 'fastify';
import { healthResponseSchema } from '@frameroom/shared';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
app.get('/health', async () => healthResponseSchema.parse({ ok: true, service: 'api' }));
const port = Number(process.env.PORT ?? 4000);
await app.listen({ host: '0.0.0.0', port });

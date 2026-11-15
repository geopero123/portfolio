import { preview } from 'astro';

// Keep the test server owned by Playwright, including in agent environments
// where the Astro CLI otherwise detaches into the background automatically.
const server = await preview({server:{host:'127.0.0.1',port:4322},logLevel:'error'});
process.on('SIGTERM', async () => { await server.stop(); process.exit(0); });
process.on('SIGINT', async () => { await server.stop(); process.exit(0); });

import { buildApp } from "./app.js";
import { config } from "./config.js";
import { closeDb, runMigrations } from "./db.js";
import { closeRedis, connectRedis } from "./redis.js";
import { ensureBootstrapAdmin } from "./services/bootstrapService.js";

async function start(): Promise<void> {
  await runMigrations();
  await ensureBootstrapAdmin();
  await connectRedis();

  const app = buildApp();
  const server = app.listen(config.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Anyattend backend listening on port ${config.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await closeRedis();
    await closeDb();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

start().catch(async (error) => {
  // eslint-disable-next-line no-console
  console.error("Fatal startup error", error);
  await closeRedis();
  await closeDb();
  process.exit(1);
});

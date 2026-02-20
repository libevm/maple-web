import { createServer } from "./server.ts";
import { InMemoryDataProvider } from "./data-provider.ts";
import { loadDropPools } from "./reactor-system.ts";
import * as path from "path";

// Load drop pools from WZ data at startup
const resourceBase = path.resolve(__dirname, "../../resourcesv2");
loadDropPools(resourceBase);

const provider = new InMemoryDataProvider();
const { start } = createServer(provider, {
  port: 5200,
  debug: true,
  dbPath: "./data/maple.db",
});
const server = start();
console.log(`🍄 MapleWeb game server on http://localhost:${server.port}`);
console.log(`   Character API: /api/character/*`);
console.log(`   WebSocket:     ws://localhost:${server.port}/ws`);
console.log(`   Health:        /health`);

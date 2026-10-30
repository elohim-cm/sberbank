import "server-only";
import { MongoClient } from "mongodb";
import { setServers } from "node:dns/promises";

const globalMongo = globalThis as typeof globalThis & { bankMongo?: Promise<MongoClient> };

export async function getMongoClient(): Promise<MongoClient> {
  const uri = process.env.DATABASE_MONGODB_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("MongoDB configuration is missing");
  if (!globalMongo.bankMongo) {
    // Optional process-local resolver override for development networks that
    // refuse MongoDB SRV lookups. No OS DNS settings are changed.
    if (process.env.MONGODB_DNS_SERVERS) setServers(process.env.MONGODB_DNS_SERVERS.split(",").map(value => value.trim()).filter(Boolean));
    const client = new MongoClient(uri, {
      maxPoolSize: 5,
      maxIdleTimeMS: 60_000,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      appName: "bank-nextjs",
    });
    globalMongo.bankMongo = client.connect().catch(async () => {
      globalMongo.bankMongo = undefined;
      await client.close().catch(() => undefined);
      throw new Error("MongoDB connection failed");
    });
  }
  return globalMongo.bankMongo;
}

export async function getDatabase() {
  const client = await getMongoClient();
  return client.db(process.env.MONGODB_DB || "bank");
}

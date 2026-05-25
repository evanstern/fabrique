// Shared Mongo access: create one client and hand out the default database.
import { MongoClient, type Db } from "mongodb";

let clientPromise: Promise<MongoClient> | null = null;

function getClient(): Promise<MongoClient> {
  if (clientPromise) return clientPromise;

  const url = process.env.MONGO_URL;
  if (!url) {
    throw new Error("MONGO_URL is not set");
  }

  const client = new MongoClient(url);
  clientPromise = client.connect();
  return clientPromise;
}

export async function getMongoClient(): Promise<MongoClient> {
  return getClient();
}

/** Return the default database handle used by session and workflow code. */
export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db();
}

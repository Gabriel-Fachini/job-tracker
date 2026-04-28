import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL ?? "./job-tracker.db";

type DatabaseClient = BetterSQLite3Database<typeof schema>;

const globalForDatabase = globalThis as {
  sqlite?: Database.Database;
  db?: DatabaseClient;
};

const sqlite =
  globalForDatabase.sqlite ??
  new Database(databaseUrl, {
    fileMustExist: false,
  });

const db =
  globalForDatabase.db ??
  drizzle(sqlite, {
    schema,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDatabase.sqlite = sqlite;
  globalForDatabase.db = db;
}

export { db, sqlite };

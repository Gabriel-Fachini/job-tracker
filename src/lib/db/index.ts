import path from "node:path";

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

// Em produção o banco nunca é criado implicitamente: um DATABASE_URL errado deve
// falhar com erro claro em vez de abrir um banco vazio.
function openDatabase() {
  const fileMustExist = process.env.NODE_ENV === "production";

  try {
    return new Database(databaseUrl, { fileMustExist });
  } catch (error) {
    if (!fileMustExist) {
      throw error;
    }

    throw new Error(
      `Não foi possível abrir o banco SQLite em "${path.resolve(databaseUrl)}" (DATABASE_URL="${databaseUrl}"). Em produção o arquivo precisa existir; ele não é criado automaticamente.`,
      { cause: error },
    );
  }
}

const sqlite = globalForDatabase.sqlite ?? openDatabase();

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

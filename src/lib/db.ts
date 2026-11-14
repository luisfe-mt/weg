import Database from "@tauri-apps/plugin-sql";

/** Must match the name the migrations are registered under in src-tauri/src/lib.rs. */
const DB_URL = "sqlite:weg.db";

let db: Promise<Database> | undefined;

/** The one SQLite connection. Loading it runs any pending migrations. */
export function getDb(): Promise<Database> {
  db ??= Database.load(DB_URL);
  return db;
}

/** When this installation's database was created (UTC). */
export async function getInstalledAt(): Promise<string> {
  const rows = await (await getDb()).select<{ value: string }[]>(
    "SELECT value FROM app_meta WHERE key = $1",
    ["installed_at"],
  );
  const row = rows[0];
  if (!row) throw new Error("app_meta.installed_at is missing");
  return row.value;
}

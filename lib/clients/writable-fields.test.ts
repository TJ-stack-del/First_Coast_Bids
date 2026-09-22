import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CLIENT_WRITABLE_FIELDS } from "./writable-fields.ts";

const MIGRATION_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "supabase",
  "migrations",
  "20260920130000_lock_down_sam_status_columns.sql"
);

// Pulls the column names out of the migration's
// `grant update (col1, col2, ...) on table "public"."clients" ...` block.
// A plain regex over the raw SQL text, not a real parser -- sufficient here
// because this file exists to catch drift against a list this project
// itself hand-writes in one specific, stable shape, not to parse arbitrary
// SQL.
function parseGrantedColumns(sql: string): string[] {
  const match = sql.match(/grant update \(([\s\S]*?)\) on table "public"\."clients"/);
  if (!match) {
    throw new Error("Could not find a `grant update (...) on table \"public\".\"clients\"` block in the migration.");
  }
  return match[1]
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

test("CLIENT_WRITABLE_FIELDS matches the SQL migration's column grant exactly", () => {
  const sql = readFileSync(MIGRATION_PATH, "utf8");
  const grantedColumns = parseGrantedColumns(sql);

  assert.deepEqual(
    new Set(grantedColumns),
    new Set(CLIENT_WRITABLE_FIELDS),
    "lib/clients/writable-fields.ts and the SQL migration's grant list have drifted -- " +
      "update whichever one is now wrong so they match exactly."
  );
});

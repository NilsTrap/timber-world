import { strictEqual } from "node:assert";
import { readFileSync } from "node:fs";
import { mayPermanentlyDeletePerson } from "../personDeletion";

strictEqual(mayPermanentlyDeletePerson("admin-1", "person-2"), true);
strictEqual(mayPermanentlyDeletePerson("admin-1", "admin-1"), false);
strictEqual(mayPermanentlyDeletePerson(null, "person-2"), false);

const action = readFileSync("src/features/organisations/actions/deletePerson.ts", "utf8");
const table = readFileSync("src/features/organisations/components/PeopleTable.tsx", "utf8");
const migration = readFileSync("../../supabase/migrations/20260830100000_permanent_portal_user_deletion.sql", "utf8");
strictEqual(action.includes("requirePlatformAdmin()"), true);
strictEqual(action.includes("admin.auth.admin.deleteUser"), true);
strictEqual(action.includes('.from("portal_users" as never)\n    .delete()'), true);
strictEqual(action.includes("deletePersonSchema.safeParse"), true);
strictEqual(table.includes("Permanently delete user?"), true);
strictEqual(table.includes("This cannot be undone"), true);
strictEqual(table.includes("!p.isCurrentUser"), true);
strictEqual(table.includes("finally"), true);
strictEqual(migration.includes("ON DELETE SET NULL"), true);
strictEqual(migration.includes("array_length(constraint_definition.conkey, 1) = 1"), true);

console.log("personDeletion.test.ts: passed");

import { test } from "node:test";
import assert from "node:assert/strict";
import { displayAgency } from "./agency-display.ts";

test("SAM.gov's capitalised agency paths read as normal names", () => {
  assert.equal(displayAgency("DEPT OF DEFENSE.DEPT OF THE AIR FORCE"), "Department of Defense · Department of the Air Force");
  assert.equal(displayAgency("VETERANS AFFAIRS, DEPARTMENT OF"), "Veterans Affairs, Department of");
  assert.equal(displayAgency("DEPT OF DEFENSE.DEPT OF THE NAVY.NAVFAC SOUTHEAST"), "Department of Defense · Department of the Navy");
  assert.equal(displayAgency("TRANSPORTATION, DEPARTMENT OF.FEDERAL AVIATION ADMINISTRATION"), "Transportation, Department of · Federal Aviation Administration");
});

test("acronyms stay capitalised", () => {
  assert.equal(displayAgency("GENERAL SERVICES ADMINISTRATION.FAS"), "General Services Administration · FAS");
  assert.equal(displayAgency("NASA"), "NASA");
});

test("names that already have lowercase letters are left exactly as they are", () => {
  for (const a of ["City of Jacksonville", "JEA (Jacksonville Electric Authority) — Procurement Division", "Duval County Public Schools (DCPS)"]) assert.equal(displayAgency(a), a);
  assert.equal(displayAgency(""), "");
});

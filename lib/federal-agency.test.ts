import { test } from "node:test";
import assert from "node:assert/strict";
import { isFederalAgency } from "./federal-agency.ts";

// Agency strings exactly as SAM.gov's API returns them (fullParentPathName:
// dot-separated, departments often written "X, DEPARTMENT OF" or "DEPT OF X").
test("SAM.gov's own agency names are federal", () => {
  for (const agency of [
    "VETERANS AFFAIRS, DEPARTMENT OF.VETERANS AFFAIRS, DEPARTMENT OF.248-NETWORK CONTRACT OFFICE 8 (36C248)",
    "DEPT OF DEFENSE.DEPT OF THE NAVY.NAVSUP.NAVSUP FLT LOG CTR JACKSONVILLE",
    "DEPT OF DEFENSE.DEPT OF THE ARMY.AMC.ACC.MISSION INSTALLATION CONTRACTING COMMAND",
    "DEPT OF DEFENSE.DEPT OF THE AIR FORCE.AIR FORCE MATERIEL COMMAND",
    "DEPT OF DEFENSE.DEFENSE LOGISTICS AGENCY",
    "HOMELAND SECURITY, DEPARTMENT OF.US COAST GUARD",
    "GENERAL SERVICES ADMINISTRATION.PUBLIC BUILDINGS SERVICE",
    "AGRICULTURE, DEPARTMENT OF.FOREST SERVICE",
    "INTERIOR, DEPARTMENT OF THE.NATIONAL PARK SERVICE",
    "HEALTH AND HUMAN SERVICES, DEPARTMENT OF.INDIAN HEALTH SERVICE",
    "TRANSPORTATION, DEPARTMENT OF.FEDERAL AVIATION ADMINISTRATION",
  ]) {
    assert.equal(isFederalAgency(agency), true, agency);
  }
});

test("plain-English federal names are federal", () => {
  for (const agency of [
    "U.S. Army Corps of Engineers, Jacksonville District",
    "Department of Veterans Affairs",
    "Naval Air Station Jacksonville",
    "NAS Jacksonville",
    "Naval Station Mayport",
    "United States Department of Agriculture",
    "U.S. Department of State",
  ]) {
    assert.equal(isFederalAgency(agency), true, agency);
  }
});

test("local and state agencies are not federal", () => {
  for (const agency of [
    "City of Jacksonville — Procurement Division / Parks, Recreation and Community Service",
    "City of Jacksonville Beach",
    "Jacksonville Aviation Authority (JAA)",
    "Jacksonville Transportation Authority",
    "Duval County Public Schools (DCPS) — Purchasing Services",
    "JEA (Jacksonville Electric Authority)",
    "Florida Department of Transportation",
    "Florida Department of Education",
    "State of Florida Department of Management Services",
  ]) {
    assert.equal(isFederalAgency(agency), false, agency);
  }
});

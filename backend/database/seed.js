const { Client } = require("pg");
const dotenv = require("dotenv");
dotenv.config({ path: ".env.development" });

async function seed() {
  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to dev DB. Checking if seed is needed...");

  const wsCheck = await client.query("SELECT * FROM workspace WHERE prefix_code = 'AAP'");
  if (wsCheck.rows.length > 0) {
    console.log("Seed already exists:", wsCheck.rows[0].workspace_name);
    await client.end();
    return;
  }

  console.log("Injecting Seed Data...");
  // 1. Members
  const m1 = await client.query(`
    INSERT INTO member (member_name, member_email, member_ad_group, member_status)
    VALUES ('Edmond Chan', 'edmond.chan@airport.local', 'Project Leads', 'Active')
    ON CONFLICT (member_email) DO UPDATE SET member_name = EXCLUDED.member_name
    RETURNING member_uid
  `);
  const m2 = await client.query(`
    INSERT INTO member (member_name, member_email, member_ad_group, member_status)
    VALUES ('Sarah Wong', 'sarah.wong@airport.local', 'Dev Team', 'Active')
    ON CONFLICT (member_email) DO UPDATE SET member_name = EXCLUDED.member_name
    RETURNING member_uid
  `);

  const edmondUid = m1.rows[0].member_uid;
  const sarahUid = m2.rows[0].member_uid;

  // 2. Workspace
  const ws = await client.query(`
    INSERT INTO workspace (prefix_code, workspace_name, last_project_number, last_item_number, allow_access_member)
    VALUES ('AAP', 'Airport Analytics & Insight', 1, 5, $1)
    RETURNING workspace_uid
  `, [JSON.stringify([
    { member_uid: edmondUid, role_in_this_workspace: 'owner' },
    { member_uid: sarahUid, role_in_this_workspace: 'editor' }
  ])]);
  const wsUid = ws.rows[0].workspace_uid;

  // 3. Project (Airport Self Service)
  const prj = await client.query(`
    INSERT INTO project (
      project_name, project_display_code, project_number, project_type,
      related_workspace_uid, project_status, project_sub_type, project_type_sequence,
      project_owner, planned_start_date, planned_end_date, project_content
    ) VALUES (
      'Airport Self Service (Revamp)', 'AAP-PRO-1', 1, 'Project',
      $1, 'Active', 'Phase', 1,
      $2, '2026-09-01', '2026-12-31',
      $3
    ) RETURNING project_uid
  `, [wsUid, edmondUid, JSON.stringify({ vision: "Automate boarding gate clearance with biometric verification." })]);
  const prjUid = prj.rows[0].project_uid;

  // 4. Traceability Hierarchy Items: Objective -> Requirement -> User Story -> Task -> UAT
  // Objective
  const obj = await client.query(`
    INSERT INTO item (
      item_display_code, prefix_code, item_number, item_title,
      related_project_uid, workspace_uid, item_type, item_status, item_priority,
      item_follow_by
    ) VALUES ('AAP-1', 'AAP', 1, 'Elevate Passenger Boarding Gate Experience', $1, $2, 'Objective', 'In Progress', 'High', $3)
    RETURNING item_uid
  `, [prjUid, wsUid, edmondUid]);

  // Requirement
  const req = await client.query(`
    INSERT INTO item (
      item_display_code, prefix_code, item_number, item_title,
      related_project_uid, workspace_uid, item_type, item_status, item_priority,
      parent_item_uid, item_follow_by
    ) VALUES ('AAP-2', 'AAP', 2, 'Automated Biometric Face Matching Under 1.5s', $1, $2, 'Requirement', 'Ready', 'High', $3, $4)
    RETURNING item_uid
  `, [prjUid, wsUid, obj.rows[0].item_uid, sarahUid]);

  // User Story
  const us = await client.query(`
    INSERT INTO item (
      item_display_code, prefix_code, item_number, item_title,
      related_project_uid, workspace_uid, item_type, item_status, item_priority,
      parent_item_uid, item_follow_by
    ) VALUES ('AAP-3', 'AAP', 3, 'As a passenger, I can walk through the gate seamlessly', $1, $2, 'User story', 'In Progress', 'Middle', $3, $4)
    RETURNING item_uid
  `, [prjUid, wsUid, req.rows[0].item_uid, sarahUid]);

  // Task
  const task = await client.query(`
    INSERT INTO item (
      item_display_code, prefix_code, item_number, item_title,
      related_project_uid, workspace_uid, item_type, item_status, item_priority,
      parent_item_uid, item_follow_by
    ) VALUES ('AAP-4', 'AAP', 4, 'Deploy Camera SDK & Integrate Neon Database Pooler', $1, $2, 'Task', 'In Progress', 'High', $3, $4)
    RETURNING item_uid
  `, [prjUid, wsUid, us.rows[0].item_uid, sarahUid]);

  // UAT
  const uat = await client.query(`
    INSERT INTO item (
      item_display_code, prefix_code, item_number, item_title,
      related_project_uid, workspace_uid, item_type, item_status, item_priority,
      parent_item_uid, item_follow_by
    ) VALUES ('AAP-5', 'AAP', 5, 'Peak Hour 500 Passengers Gate Throughput Test', $1, $2, 'UAT', 'Not Start', 'Middle', $3, $4)
    RETURNING item_uid
  `, [prjUid, wsUid, task.rows[0].item_uid, edmondUid]);

  console.log("Seed data injected successfully! Workspace AAP, Project AAP-PRO-1, Items AAP-1 to AAP-5 created.");
  await client.end();
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});

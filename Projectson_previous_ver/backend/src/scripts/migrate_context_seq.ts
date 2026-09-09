import { query } from '../config/database';

async function migrate() {
  try {
    console.log("Starting database migration...");

    // 1. Add column to workspace table if not exists
    await query(`
      ALTER TABLE workspace 
      ADD COLUMN IF NOT EXISTS last_context_number INTEGER DEFAULT 0;
    `);
    console.log("Column 'last_context_number' added/verified.");

    // 2. Fetch all workspaces
    const wsRes = await query("SELECT * FROM workspace");
    const workspaces = wsRes.rows;

    for (const ws of workspaces) {
      // 3. Find max sequence number from project_context display IDs (e.g., AAP-COT-3)
      const contextRes = await query(
        "SELECT content_display_id FROM project_context WHERE related_workspace_id = $1",
        [ws.workspace_id]
      );
      
      let maxNum = 0;
      for (const row of contextRes.rows) {
        if (!row.content_display_id) continue;
        const parts = row.content_display_id.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }

      console.log(`Workspace ${ws.workspace_name} (Prefix: ${ws.prefix_code}, ID: ${ws.workspace_id}) has max sequence: ${maxNum}`);

      // 4. Update the workspace's last_context_number
      await query(
        "UPDATE workspace SET last_context_number = $1 WHERE workspace_id = $2",
        [maxNum, ws.workspace_id]
      );
    }

    console.log("Migration completed successfully!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

migrate();

import { query } from '../config/database';

async function sync() {
  try {
    console.log('Syncing last_item_number...');
    
    // Get workspaces
    const wsRes = await query('SELECT workspace_id, prefix_code FROM workspace');
    
    for (const ws of wsRes.rows) {
      const prefix = ws.prefix_code;
      // Find max number in project_item that starts with this prefix
      const maxRes = await query(`
        SELECT item_display_id 
        FROM project_item 
        WHERE item_display_id LIKE $1 || '-%'
      `, [prefix]);
      
      let maxNum = 0;
      for (const row of maxRes.rows) {
        const parts = row.item_display_id.split('-');
        if (parts.length > 1) {
          const num = parseInt(parts[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
      
      console.log(`Workspace ${prefix} max number is ${maxNum}`);
      
      if (maxNum > 0) {
        await query('UPDATE workspace SET last_item_number = $1 WHERE workspace_id = $2', [maxNum, ws.workspace_id]);
        console.log(`Updated workspace ${prefix} last_item_number to ${maxNum}`);
      }
    }
    
    console.log('Sync completed.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

sync();

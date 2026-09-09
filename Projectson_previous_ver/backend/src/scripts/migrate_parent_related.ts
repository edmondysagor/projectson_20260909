import { query } from '../config/database';

async function run() {
  try {
    console.log("Starting Neon DB Migration...");
    
    // 1. Add parent_item_id column
    console.log("Adding parent_item_id column...");
    await query(`
      ALTER TABLE project_item 
      ADD COLUMN IF NOT EXISTS parent_item_id INT REFERENCES project_item(id) ON DELETE SET NULL;
    `);
    
    // 2. Add related_item_id_relation column
    console.log("Adding related_item_id_relation column...");
    await query(`
      ALTER TABLE project_item 
      ADD COLUMN IF NOT EXISTS related_item_id_relation JSONB DEFAULT '[]'::jsonb;
    `);

    // 3. Migrate data from related_parent_item_id to parent_item_id
    console.log("Migrating parent IDs from JSONB to integer column...");
    await query(`
      UPDATE project_item
      SET parent_item_id = (related_parent_item_id->>0)::INTEGER
      WHERE related_parent_item_id IS NOT NULL 
        AND jsonb_array_length(related_parent_item_id) > 0
        AND (related_parent_item_id->>0) ~ '^[0-9]+$';
    `);

    // 4. Drop the old related_parent_item_id column
    console.log("Dropping old related_parent_item_id column...");
    await query(`
      ALTER TABLE project_item 
      DROP COLUMN IF EXISTS related_parent_item_id;
    `);

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
  }
}

run();

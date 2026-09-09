import { query } from '../config/database';

async function migrate() {
  try {
    console.log("Renaming column related_item_id to related_parent_item_id...");
    await query(`
      ALTER TABLE project_item 
      RENAME COLUMN related_item_id TO related_parent_item_id;
    `);
    console.log("Column renamed successfully!");
  } catch (err: any) {
    // If column already renamed or doesn't exist, ignore or log
    if (err.message.includes("does not exist")) {
      console.log("Column already renamed or does not exist. Skipping.");
    } else {
      console.error("Migration failed:", err);
    }
  }
}

migrate();

import { query } from '../config/database';

async function migrate() {
  try {
    console.log('Adding last_item_number to workspace table...');
    await query('ALTER TABLE workspace ADD COLUMN IF NOT EXISTS last_item_number INT DEFAULT 0;');
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    process.exit(0);
  }
}

migrate();

import { pool } from '../config/database';

async function migrate() {
  try {
    console.log('Creating item_templates table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS item_templates (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id INT,
          template_name VARCHAR(255) NOT NULL,
          target_type VARCHAR(50) NOT NULL,
          template_schema JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Table item_templates created successfully.');
  } catch (err) {
    console.error('Error creating table:', err);
  } finally {
    pool.end();
  }
}

migrate();

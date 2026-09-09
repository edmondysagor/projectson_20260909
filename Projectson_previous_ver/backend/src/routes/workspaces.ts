import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET all workspaces
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM workspace ORDER BY workspace_id ASC');
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET workspace by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query('SELECT * FROM workspace WHERE workspace_id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE workspace
router.post('/', async (req: Request, res: Response) => {
  try {
    const { prefix_code, workspace_name, last_item_number } = req.body;
    const result = await query(
      `INSERT INTO workspace (prefix_code, workspace_name, last_item_number)
       VALUES ($1, $2, $3) RETURNING *`,
      [
        prefix_code || 'NEW',
        workspace_name || 'New Workspace',
        last_item_number !== undefined ? last_item_number : 0
      ]
    );
    
    const newWorkspace = result.rows[0];
    
    // Automatically create a default General Project context for the new workspace
    await query(
      `INSERT INTO project_context (content_name, content_display_id, content_type, related_workspace_id, content_status, project_type)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'General Project',
        `${newWorkspace.prefix_code}-COT-1`,
        'Project',
        newWorkspace.workspace_id,
        'Active',
        'BAU'
      ]
    );

    res.status(201).json(newWorkspace);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE workspace
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { prefix_code, workspace_name, last_item_number } = req.body;
    
    const current = await query('SELECT * FROM workspace WHERE workspace_id = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    const dbW = current.rows[0];

    const finalPrefix = prefix_code || dbW.prefix_code;
    const finalName = workspace_name || dbW.workspace_name;
    const finalNumber = last_item_number !== undefined ? last_item_number : dbW.last_item_number;

    const result = await query(
      `UPDATE workspace
       SET prefix_code = $1,
           workspace_name = $2,
           last_item_number = $3
       WHERE workspace_id = $4 RETURNING *`,
      [finalPrefix, finalName, finalNumber, id]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE workspace
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    // Manually delete all project_context for this workspace, which will cascade delete project_items
    await query('DELETE FROM project_context WHERE related_workspace_id = $1', [id]);
    const result = await query('DELETE FROM workspace WHERE workspace_id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    res.json({ message: 'Workspace and its contents deleted successfully', workspace: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

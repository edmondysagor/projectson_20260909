import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
const query = (text: string, params?: any[]) => pool.query(text, params);

const router = Router();

// GET all products (project_context where context_type = 'Product')
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query("SELECT context_uid as id, * FROM project_context WHERE context_type = 'Product' ORDER BY created_at ASC");
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single product
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT context_uid as id, * FROM project_context WHERE context_uid = $1 AND context_type = 'Product'", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE product
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      context_name,
      related_workspace_uid,
      context_status,
      content,
      remarks_entry
    } = req.body;
    
    // Atomically increment and get last_context_number from workspace
    const wsId = related_workspace_uid || 1;
    const wsUpdateRes = await query(
      "UPDATE workspace SET last_context_number = COALESCE(last_context_number, 0) + 1 WHERE workspace_uid = $1 RETURNING prefix_code, last_context_number",
      [wsId]
    );
    let prefix = 'AAP';
    let last_context_number = 1;
    if (wsUpdateRes.rows.length > 0) {
      prefix = wsUpdateRes.rows[0].prefix_code;
      last_context_number = wsUpdateRes.rows[0].last_context_number;
    }
    const context_display_code = `${prefix}-COT-${last_context_number}`;

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動建立產品項目'
    };

    const result = await query(
      `INSERT INTO project_context (
        context_name, context_display_code, context_type, related_workspace_uid,
        context_status, content, content_update_log
      ) VALUES ($1, $2, 'Product', $3, $4, $5, $6) RETURNING context_uid as id, *`,
      [
        context_name || 'New Product',
        context_display_code,
        related_workspace_uid || 1,
        context_status || 'Active',
        JSON.stringify(content || {}),
        JSON.stringify([logEntry])
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE product
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      context_name,
      related_workspace_uid,
      context_status,
      content,
      remarks_entry
    } = req.body;

    const current = await query('SELECT context_uid as id, * FROM project_context WHERE context_uid = $1 AND context_type = \'Product\'', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const dbProd = current.rows[0];

    const finalName = context_name || dbProd.context_name;
    const finalWorkspaceId = related_workspace_uid || dbProd.related_workspace_uid;
    const finalStatus = context_status || dbProd.context_status;

    let mergedContent = { ...(dbProd.content || {}) };
    if (content) {
      mergedContent = { ...mergedContent, ...content };
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動修改產品資料'
    };
    const updatedLog = [logEntry, ...(dbProd.content_update_log || [])];

    const result = await query(
      `UPDATE project_context
       SET context_name = $1,
           related_workspace_uid = $2,
           context_status = $3,
           content = $4,
           content_update_log = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE context_uid = $6 RETURNING context_uid as id, *`,
      [
        finalName,
        finalWorkspaceId,
        finalStatus,
        JSON.stringify(mergedContent),
        JSON.stringify(updatedLog),
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE product
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM project_context WHERE context_uid = $1 AND context_type = 'Product' RETURNING context_uid as id, *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    res.json({ message: 'Product deleted successfully', product: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

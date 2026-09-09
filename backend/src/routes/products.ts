import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
const query = (text: string, params?: any[]) => pool.query(text, params);

const router = Router();

async function resolveWorkspaceUid(inputWs?: any): Promise<string> {
  const isUuid = typeof inputWs === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputWs);
  if (isUuid) {
    const r = await query('SELECT workspace_uid FROM workspace WHERE workspace_uid = $1', [inputWs]);
    if (r.rows.length > 0) return r.rows[0].workspace_uid;
  }
  const fallback = await query('SELECT workspace_uid FROM workspace ORDER BY workspace_created_at ASC LIMIT 1');
  return fallback.rows[0].workspace_uid;
}

// GET all products
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
    const body = req.body || {};
    const context_name = body.context_name || body.name || 'New Product';
    const rawWs = body.related_workspace_uid || body.related_workspace_id || body.workspace_id;
    const wsId = await resolveWorkspaceUid(rawWs);
    const context_status = body.context_status || body.status || 'Active';
    const content = body.content || {};
    const remarks_entry = body.remarks_entry;

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
        context_name, context_display_code, context_number, context_type, related_workspace_uid,
        context_status, content, content_update_log
      ) VALUES ($1, $2, $3, 'Product', $4, $5, $6, $7) RETURNING context_uid as id, *`,
      [
        context_name,
        context_display_code,
        last_context_number,
        wsId,
        context_status,
        JSON.stringify(content),
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
    const body = req.body || {};
    const current = await query('SELECT context_uid as id, * FROM project_context WHERE context_uid = $1 AND context_type = \'Product\'', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const dbProd = current.rows[0];

    const context_name = body.context_name !== undefined ? body.context_name : (body.name !== undefined ? body.name : dbProd.context_name);
    const context_status = body.context_status !== undefined ? body.context_status : (body.status !== undefined ? body.status : dbProd.context_status);
    const mergedContent = body.content !== undefined ? { ...dbProd.content, ...body.content } : dbProd.content;
    let updatedLog = dbProd.content_update_log || [];
    if (body.remarks_entry) {
      updatedLog.push({
        timestamp: new Date().toISOString(),
        user: 'User',
        text: body.remarks_entry
      });
    }

    const result = await query(
      `UPDATE project_context
       SET context_name = $1,
           context_status = $2,
           content = $3,
           content_update_log = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE context_uid = $5 RETURNING context_uid as id, *`,
      [
        context_name,
        context_status,
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

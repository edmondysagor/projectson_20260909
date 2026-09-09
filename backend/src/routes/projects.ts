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

async function resolveParentContentUid(inputParent?: any): Promise<string | null> {
  if (!inputParent) return null;
  const isUuid = typeof inputParent === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputParent);
  if (isUuid) {
    const r = await query('SELECT context_uid FROM project_context WHERE context_uid = $1', [inputParent]);
    if (r.rows.length > 0) return r.rows[0].context_uid;
  }
  return null;
}

// GET all projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query("SELECT context_uid as id, * FROM project_context WHERE context_type = 'Project' ORDER BY created_at ASC");
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single project
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT context_uid as id, * FROM project_context WHERE context_uid = $1 AND context_type = 'Project'", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE project
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const context_name = body.context_name || body.name || 'New Project';
    const rawWs = body.related_workspace_uid || body.related_workspace_id || body.workspace_id;
    const wsId = await resolveWorkspaceUid(rawWs);
    const parent_content_uid = await resolveParentContentUid(body.parent_content_uid || body.parent_content_id || body.product_id);
    const context_status = body.context_status || body.status || 'Active';
    const project_type = body.project_type || 'Phase';
    const project_type_sequence = body.project_type_sequence !== undefined ? body.project_type_sequence : 1;
    const planned_start_date = body.planned_start_date || null;
    const planned_end_date = body.planned_end_date || body.end_date || null;
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
      text: remarks_entry || '手動建立專案項目'
    };

    const result = await query(
      `INSERT INTO project_context (
        context_name, context_display_code, context_number, context_type, related_workspace_uid,
        parent_content_uid, context_status, project_type, project_type_sequence,
        planned_start_date, planned_end_date, content, content_update_log
      ) VALUES ($1, $2, $3, 'Project', $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING context_uid as id, *`,
      [
        context_name,
        context_display_code,
        last_context_number,
        wsId,
        parent_content_uid,
        context_status,
        project_type,
        project_type_sequence,
        planned_start_date,
        planned_end_date,
        JSON.stringify(content),
        JSON.stringify([logEntry])
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE project
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const current = await query('SELECT context_uid as id, * FROM project_context WHERE context_uid = $1 AND context_type = \'Project\'', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const dbProj = current.rows[0];

    const context_name = body.context_name !== undefined ? body.context_name : (body.name !== undefined ? body.name : dbProj.context_name);
    const context_status = body.context_status !== undefined ? body.context_status : (body.status !== undefined ? body.status : dbProj.context_status);
    const project_type = body.project_type !== undefined ? body.project_type : (body.type !== undefined ? body.type : dbProj.project_type);
    const project_type_sequence = body.project_type_sequence !== undefined ? body.project_type_sequence : dbProj.project_type_sequence;
    const planned_start_date = body.planned_start_date !== undefined ? body.planned_start_date : dbProj.planned_start_date;
    const planned_end_date = body.planned_end_date !== undefined ? body.planned_end_date : (body.end_date !== undefined ? body.end_date : dbProj.planned_end_date);
    const mergedContent = body.content !== undefined ? { ...dbProj.content, ...body.content } : dbProj.content;
    let updatedLog = dbProj.content_update_log || [];
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
           project_type = $3,
           project_type_sequence = $4,
           planned_start_date = $5,
           planned_end_date = $6,
           content = $7,
           content_update_log = $8,
           updated_at = CURRENT_TIMESTAMP
       WHERE context_uid = $9 RETURNING context_uid as id, *`,
      [
        context_name,
        context_status,
        project_type,
        project_type_sequence,
        planned_start_date,
        planned_end_date,
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

// DELETE project
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM project_context WHERE context_uid = $1 AND context_type = 'Project' RETURNING context_uid as id, *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully', project: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

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

async function resolveContextUid(inputCtx?: any): Promise<string | null> {
  if (!inputCtx) return null;
  const isUuid = typeof inputCtx === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(inputCtx);
  if (isUuid) {
    const r = await query('SELECT context_uid FROM project_context WHERE context_uid = $1', [inputCtx]);
    if (r.rows.length > 0) return r.rows[0].context_uid;
  }
  // Try matching by first available project/product
  const firstCtx = await query('SELECT context_uid FROM project_context ORDER BY created_at ASC LIMIT 1');
  return firstCtx.rows.length > 0 ? firstCtx.rows[0].context_uid : null;
}

// GET all
router.get('/', async (req: Request, res: Response) => {
  try {
    const typeFilter = 'All' === 'All' ? '' : "WHERE item_type = 'All'";
    const result = await query(`SELECT item_uid as id, * FROM item ${typeFilter} ORDER BY created_at ASC`);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT item_uid as id, * FROM item WHERE item_uid = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE
router.post('/', async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const item_title = body.item_title || body.title || body.term || 'New Task';
    const rawWs = body.workspace_uid || body.workspace_id;
    const workspaceId = await resolveWorkspaceUid(rawWs);
    const rawCtx = body.related_context_uid || body.related_context_id || body.project_id || body.product_id;
    const finalContextId = await resolveContextUid(rawCtx);

    const wsRes = await query(
      "UPDATE workspace SET last_item_number = COALESCE(last_item_number, 0) + 1 WHERE workspace_uid = $1 RETURNING prefix_code, last_item_number",
      [workspaceId]
    );

    let prefix_code = 'AAP';
    let last_item_number = 1;
    if (wsRes.rows.length > 0) {
      prefix_code = wsRes.rows[0].prefix_code;
      last_item_number = wsRes.rows[0].last_item_number;
    }

    const item_display_code = `${prefix_code}-${String(last_item_number).padStart(3, '0')}`;

    const item_type = body.item_type || body.nature || 'Task';
    const item_status = body.item_status || body.status || 'Not Start';
    const item_priority = body.item_priority || body.priority || body.severity || 'Middle';
    const item_planned_start_date = body.item_planned_start_date || body.meeting_date || null;
    const item_planned_end_date = body.item_planned_end_date || body.due_date || null;
    
    // Merge rich text & custom fields
    let finalContent = { ...(body.item_content || {}) };
    if (body.content !== undefined) finalContent.content = body.content;
    if (body.description !== undefined) finalContent.description = body.description;
    if (body.definition !== undefined) finalContent.definition = body.definition;

    let finalAttribute = { ...(body.item_attribute || {}) };
    if (body.summary !== undefined) finalAttribute.summary = body.summary;
    if (body.host !== undefined) finalAttribute.host = body.host;
    if (body.file_path !== undefined) finalAttribute.file_path = body.file_path;
    if (body.kpi_formula !== undefined) finalAttribute.kpi_formula = body.kpi_formula;
    if (body.tag !== undefined) finalAttribute.tag = body.tag;
    if (body.url !== undefined) finalAttribute.url = body.url;

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: body.remarks_entry || `手動建立 ${item_type}`
    };

    const result = await query(
      `INSERT INTO item (
        item_display_code, prefix_code, item_number, item_title, workspace_uid, related_context_uid,
        item_type, item_status, item_priority, item_planned_start_date, item_planned_end_date,
        item_content, item_attribute, item_update_log, related_item_uid_relation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING item_uid as id, *`,
      [
        item_display_code,
        prefix_code,
        last_item_number,
        item_title,
        workspaceId,
        finalContextId,
        item_type,
        item_status,
        item_priority,
        item_planned_start_date,
        item_planned_end_date,
        JSON.stringify(finalContent),
        JSON.stringify(finalAttribute),
        JSON.stringify([logEntry]),
        JSON.stringify(body.related_item_uid_relation || [])
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const current = await query("SELECT item_uid as id, * FROM item WHERE item_uid = $1", [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const dbItem = current.rows[0];

    const finalTitle = body.item_title !== undefined ? body.item_title : (body.title !== undefined ? body.title : (body.term !== undefined ? body.term : dbItem.item_title));
    const finalType = body.item_type !== undefined ? body.item_type : (body.nature !== undefined ? body.nature : dbItem.item_type);
    const finalStatus = body.item_status !== undefined ? body.item_status : (body.status !== undefined ? body.status : dbItem.item_status);
    const finalPriority = body.item_priority !== undefined ? body.item_priority : (body.priority !== undefined ? body.priority : (body.severity !== undefined ? body.severity : dbItem.item_priority));
    const finalPlannedStart = body.item_planned_start_date !== undefined ? body.item_planned_start_date : (body.meeting_date !== undefined ? body.meeting_date : dbItem.item_planned_start_date);
    const finalPlannedEnd = body.item_planned_end_date !== undefined ? body.item_planned_end_date : (body.due_date !== undefined ? body.due_date : dbItem.item_planned_end_date);

    let mergedContent = { ...(dbItem.item_content || {}) };
    if (body.item_content) mergedContent = { ...mergedContent, ...body.item_content };
    if (body.description !== undefined) mergedContent.description = body.description;
    if (body.content !== undefined) mergedContent.content = body.content;
    if (body.definition !== undefined) mergedContent.definition = body.definition;

    let mergedAttribute = { ...(dbItem.item_attribute || {}) };
    if (body.item_attribute) mergedAttribute = { ...mergedAttribute, ...body.item_attribute };
    if (body.summary !== undefined) mergedAttribute.summary = body.summary;
    if (body.host !== undefined) mergedAttribute.host = body.host;
    if (body.file_path !== undefined) mergedAttribute.file_path = body.file_path;
    if (body.kpi_formula !== undefined) mergedAttribute.kpi_formula = body.kpi_formula;
    if (body.tag !== undefined) mergedAttribute.tag = body.tag;
    if (body.url !== undefined) mergedAttribute.url = body.url;

    let updatedLog = dbItem.item_update_log || [];
    if (body.remarks_entry) {
      updatedLog.push({
        timestamp: new Date().toISOString(),
        user: 'User',
        text: body.remarks_entry
      });
    }

    const finalRelations = body.related_item_uid_relation !== undefined ? body.related_item_uid_relation : dbItem.related_item_uid_relation;

    const result = await query(
      `UPDATE item
       SET item_title = $1,
           item_type = $2,
           item_status = $3,
           item_priority = $4,
           item_planned_start_date = $5,
           item_planned_end_date = $6,
           item_content = $7,
           item_attribute = $8,
           item_update_log = $9,
           related_item_uid_relation = $10,
           updated_at = CURRENT_TIMESTAMP
       WHERE item_uid = $11 RETURNING item_uid as id, *`,
      [
        finalTitle,
        finalType,
        finalStatus,
        finalPriority,
        finalPlannedStart,
        finalPlannedEnd,
        JSON.stringify(mergedContent),
        JSON.stringify(mergedAttribute),
        JSON.stringify(updatedLog),
        JSON.stringify(finalRelations),
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM item WHERE item_uid = $1 RETURNING item_uid as id, *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json({ message: 'Item deleted successfully', item: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

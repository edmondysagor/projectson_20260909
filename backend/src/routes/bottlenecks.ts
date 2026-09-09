import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
const query = (text: string, params?: any[]) => pool.query(text, params);

const router = Router();

// GET all bottlenecks (project_item where item_type = 'Bottleneck')
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query("SELECT item_uid as id, * FROM item WHERE item_type = 'Bottleneck' ORDER BY created_at ASC");
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET bottlenecks by Project context
router.get('/project/:projectId', async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const result = await query("SELECT item_uid as id, * FROM item WHERE related_context_uid = $1 AND item_type = 'Bottleneck' ORDER BY created_at ASC", [projectId]);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single bottleneck
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT item_uid as id, * FROM item WHERE item_uid = $1 AND item_type = 'Bottleneck'", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bottleneck not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE bottleneck
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      item_title,
      related_context_uid, workspace_uid,
      item_status,
      item_priority,
      item_planned_start_date,
      item_planned_end_date,
      item_content,
      item_attribute,
      remarks_entry
    } = req.body;

    let finalContextId = related_context_uid;
    if (!finalContextId) {
      finalContextId = null;
    }

    let workspaceId = workspace_uid;
    if (!workspaceId) {
      const contextRes = await query("SELECT related_workspace_uid FROM project_context WHERE context_uid = $1", [finalContextId || related_context_uid]);
      workspaceId = contextRes.rows.length > 0 ? contextRes.rows[0].related_workspace_uid : 1;
    }

    const wsRes = await query(
      "UPDATE workspace SET last_item_number = COALESCE(last_item_number, 0) + 1 WHERE workspace_uid = $1 RETURNING prefix_code, last_item_number",
      [workspaceId]
    );

    let prefix_code = 'UNK';
    let last_item_number = 1;
    if (wsRes.rows.length > 0) {
      prefix_code = wsRes.rows[0].prefix_code;
      last_item_number = wsRes.rows[0].last_item_number;
    }

    const item_display_code = `${prefix_code}-${String(last_item_number).padStart(3, '0')}`;

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動建立樽頸風險'
    };

    const result = await query(
      `INSERT INTO item (item_display_code, item_title, workspace_uid, related_context_uid, item_type, item_status, item_priority, item_planned_start_date, item_planned_end_date, item_content, item_attribute, item_follow_by, item_assigned_by, parent_item_uid, related_item_uid_relation, prefix_code, item_number)
       VALUES ($1, $2, $3, $4, 'Bottleneck', $5, $6, $7, $8, $9, $10, $11, $13, $14) RETURNING item_uid as id, *`,
      [
        item_display_code,
        item_title || 'New Bottleneck',
        workspaceId,
        finalContextId,
        item_status || 'Not Start',
        item_priority || 'Middle',
        item_planned_start_date || null,
        item_planned_end_date || null,
        JSON.stringify(item_content || {}),
        JSON.stringify(item_attribute || {}),
        JSON.stringify([logEntry])
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE bottleneck
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      severity,
      status,
      remarks_entry,
      item_title,
      item_status,
      item_priority,
      item_planned_start_date,
      item_planned_end_date,
      item_actual_start_date,
      item_actual_end_date,
      item_follow_by,
      item_assigned_by,
      item_content,
      item_attribute,
      item_comment,
      related_context_uid
    } = req.body;

    const current = await query("SELECT item_uid as id, * FROM item WHERE item_uid = $1 AND item_type = 'Bottleneck'", [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Bottleneck not found' });
    }
    const dbB = current.rows[0];

    const finalTitle = item_title || title || dbB.item_title;
    const finalPriority = item_priority || severity || dbB.item_priority;
    const finalStatus = item_status || status || dbB.item_status;
    const finalContext = related_context_uid || dbB.related_context_uid;
    const finalPlannedStart = item_planned_start_date || dbB.item_planned_start_date;
    const finalPlannedEnd = item_planned_end_date || dbB.item_planned_end_date;
    const finalActualStart = item_actual_start_date || dbB.item_actual_start_date;
    const finalActualEnd = item_actual_end_date || dbB.item_actual_end_date;
    const finalFollowBy = item_follow_by !== undefined ? item_follow_by : dbB.item_follow_by;
    const finalAssignedBy = item_assigned_by !== undefined ? item_assigned_by : dbB.item_assigned_by;

    let mergedContent = { ...(dbB.item_content || {}) };
    if (item_content) {
      mergedContent = { ...mergedContent, ...item_content };
    }
    if (description !== undefined) {
      mergedContent.description = description;
    }

    let mergedAttribute = { ...(dbB.item_attribute || {}) };
    if (item_attribute) {
      mergedAttribute = { ...mergedAttribute, ...item_attribute };
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動修改樽頸風險'
    };
    const updatedLog = [logEntry, ...(dbB.item_update_log || [])];

    let finalComments = dbB.item_comment || [];
    if (item_comment !== undefined) {
      finalComments = item_comment;
    }

    const result = await query(
      `UPDATE item
       SET item_title = $1,
           item_priority = $2,
           item_status = $3,
           item_planned_start_date = $4,
           item_planned_end_date = $5,
           item_actual_start_date = $6,
           item_actual_end_date = $7,
           item_follow_by = $8,
           related_context_uid = $9,
           item_content = $10,
           item_attribute = $11,
           item_update_log = $12,
           item_comment = $13,
           item_assigned_by = $14,
           item_updated_at = CURRENT_TIMESTAMP
       WHERE item_uid = $15 RETURNING item_uid as id, *`,
      [
        finalTitle,
        finalPriority,
        finalStatus,
        finalPlannedStart,
        finalPlannedEnd,
        finalActualStart,
        finalActualEnd,
        finalFollowBy,
        finalContext,
        JSON.stringify(mergedContent),
        JSON.stringify(mergedAttribute),
        JSON.stringify(updatedLog),
        JSON.stringify(finalComments),
        finalAssignedBy,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE bottleneck
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM item WHERE item_uid = $1 AND item_type = 'Bottleneck' RETURNING item_uid as id, *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Bottleneck not found' });
    }
    res.json({ message: 'Bottleneck deleted successfully', bottleneck: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

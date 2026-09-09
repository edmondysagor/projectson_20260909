import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET all glossary terms / knowledge notes (project_item where item_type = 'Knowledge')
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query("SELECT * FROM project_item WHERE item_type = 'Knowledge' ORDER BY item_title ASC");
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET glossary terms by Product ID
router.get('/product/:productId', async (req: Request, res: Response) => {
  try {
    const { productId } = req.params;
    const result = await query("SELECT * FROM project_item WHERE related_context_id = $1 AND item_type = 'Knowledge' ORDER BY item_title ASC", [productId]);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single knowledge
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT * FROM project_item WHERE id = $1 AND item_type = 'Knowledge'", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Knowledge term not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE knowledge
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      item_title,
      related_context_id, workspace_id,
      item_status,
      item_priority,
      item_planned_start_date,
      item_planned_end_date,
      item_content,
      item_attribute,
      term,
      definition,
      kpi_formula,
      tag,
      url,
      remarks_entry
    } = req.body;

    let finalContextId = related_context_id;
    if (!finalContextId) {
      finalContextId = null;
    }

    let workspaceId = workspace_id;
    if (!workspaceId) {
      const contextRes = await query("SELECT related_workspace_id FROM project_context WHERE id = $1", [finalContextId || related_context_id]);
      workspaceId = contextRes.rows.length > 0 ? contextRes.rows[0].related_workspace_id : 1;
    }

    const wsRes = await query(
      "UPDATE workspace SET last_item_number = COALESCE(last_item_number, 0) + 1 WHERE workspace_id = $1 RETURNING prefix_code, last_item_number",
      [workspaceId]
    );

    let prefix_code = 'UNK';
    let last_item_number = 1;
    if (wsRes.rows.length > 0) {
      prefix_code = wsRes.rows[0].prefix_code;
      last_item_number = wsRes.rows[0].last_item_number;
    }

    const item_display_id = `${prefix_code}-${String(last_item_number).padStart(3, '0')}`;

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動建立業務字典詞條'
    };

    let finalContent = { ...(item_content || {}) };
    if (definition !== undefined) finalContent.definition = definition;

    let finalAttribute = { ...(item_attribute || {}) };
    if (kpi_formula !== undefined) finalAttribute.kpi_formula = kpi_formula;
    if (tag !== undefined) finalAttribute.tag = tag;
    if (url !== undefined) finalAttribute.url = url;

    const result = await query(
      `INSERT INTO project_item (
        item_display_id, item_title, workspace_id, related_context_id, item_type, item_status,
        item_priority, item_planned_start_date, item_planned_end_date,
        item_content, item_attribute, item_update_log
      ) VALUES ($1, $2, $3, $4, 'Knowledge', $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        item_display_id,
        item_title || term || 'New Term',
        workspaceId,
        finalContextId,
        item_status || 'Active',
        item_priority || 'Low',
        item_planned_start_date || null,
        item_planned_end_date || null,
        JSON.stringify(finalContent),
        JSON.stringify(finalAttribute),
        JSON.stringify([logEntry])
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE knowledge glossary
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      term, 
      definition, 
      kpi_formula, 
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
      tag,
      url,
      related_context_id
    } = req.body;

    const current = await query("SELECT * FROM project_item WHERE id = $1 AND item_type = 'Knowledge'", [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Knowledge term not found' });
    }
    const dbK = current.rows[0];

    const finalTitle = item_title || term || dbK.item_title;
    const finalStatus = item_status || dbK.item_status;
    const finalPriority = item_priority || dbK.item_priority;
    const finalContext = related_context_id || dbK.related_context_id;
    const finalPlannedStart = item_planned_start_date || dbK.item_planned_start_date;
    const finalPlannedEnd = item_planned_end_date || dbK.item_planned_end_date;
    const finalActualStart = item_actual_start_date || dbK.item_actual_start_date;
    const finalActualEnd = item_actual_end_date || dbK.item_actual_end_date;
    const finalFollowBy = item_follow_by !== undefined ? item_follow_by : dbK.item_follow_by;
    const finalAssignedBy = item_assigned_by !== undefined ? item_assigned_by : dbK.item_assigned_by;

    let mergedContent = { ...(dbK.item_content || {}) };
    if (item_content) {
      mergedContent = { ...mergedContent, ...item_content };
    }
    if (definition !== undefined) {
      mergedContent.definition = definition;
    }

    let mergedAttribute = { ...(dbK.item_attribute || {}) };
    if (item_attribute) {
      mergedAttribute = { ...mergedAttribute, ...item_attribute };
    }
    if (kpi_formula !== undefined) {
      mergedAttribute.kpi_formula = kpi_formula;
    }
    if (tag !== undefined) {
      mergedAttribute.tag = tag;
    }
    if (url !== undefined) {
      mergedAttribute.url = url;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動修改業務字典'
    };
    const updatedLog = [logEntry, ...(dbK.item_update_log || [])];

    let finalComments = dbK.item_comment || [];
    if (item_comment !== undefined) {
      finalComments = item_comment;
    }

    const result = await query(
      `UPDATE project_item
       SET item_title = $1,
           item_status = $2,
           item_priority = $3,
           item_planned_start_date = $4,
           item_planned_end_date = $5,
           item_actual_start_date = $6,
           item_actual_end_date = $7,
           item_follow_by = $8,
           related_context_id = $9,
           item_content = $10,
           item_attribute = $11,
           item_update_log = $12,
           item_comment = $13,
           item_assigned_by = $14,
           item_updated_at = CURRENT_TIMESTAMP
       WHERE id = $15 RETURNING *`,
      [
        finalTitle,
        finalStatus,
        finalPriority,
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

// DELETE knowledge
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM project_item WHERE id = $1 AND item_type = 'Knowledge' RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Knowledge term not found' });
    }
    res.json({ message: 'Knowledge deleted successfully', knowledge: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

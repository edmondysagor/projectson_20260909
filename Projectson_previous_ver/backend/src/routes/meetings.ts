import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET all meetings (project_item where item_type = 'Meeting')
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query("SELECT * FROM project_item WHERE item_type = 'Meeting' ORDER BY item_planned_start_date ASC, id ASC");
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single meeting
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT * FROM project_item WHERE id = $1 AND item_type = 'Meeting'", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE meeting
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
      content,
      summary,
      host,
      file_path,
      remarks_entry 
    } = req.body;

    // 1. Resolve context_id and workspace_id
    let finalContextId = related_context_id;
    if (!finalContextId) {
      finalContextId = null;
    }

    let workspaceId = workspace_id;
    if (!workspaceId) {
      const contextRes = await query("SELECT related_workspace_id FROM project_context WHERE id = $1", [finalContextId || related_context_id]);
      workspaceId = contextRes.rows.length > 0 ? contextRes.rows[0].related_workspace_id : 1;
    }

    // 2. Increment workspace sequence
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
      text: remarks_entry || '建立新會議記錄'
    };

    // Build final content and attribute objects
    let finalContent = { ...(item_content || {}) };
    if (content !== undefined) finalContent.content = content;

    let finalAttribute = { ...(item_attribute || {}) };
    if (summary !== undefined) finalAttribute.summary = summary;
    if (host !== undefined) finalAttribute.host = host;
    if (file_path !== undefined) finalAttribute.file_path = file_path;

    const result = await query(
      `INSERT INTO project_item (
        item_display_id, item_title, workspace_id, related_context_id, item_type, item_status,
        item_priority, item_planned_start_date, item_planned_end_date,
        item_content, item_attribute, item_update_log
      ) VALUES ($1, $2, $3, $4, 'Meeting', $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        item_display_id,
        item_title || 'New Meeting',
        workspaceId,
        finalContextId,
        item_status || 'Not Start',
        item_priority || 'Middle',
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

// UPDATE meeting
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      project_id, 
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
      content,
      summary,
      host,
      meeting_date,
      file_path,
      item_comment,
      related_context_id
    } = req.body;

    const current = await query("SELECT * FROM project_item WHERE id = $1 AND item_type = 'Meeting'", [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const dbMeeting = current.rows[0];

    const finalTitle = item_title || title || dbMeeting.item_title;
    const finalPlannedStart = item_planned_start_date || meeting_date || dbMeeting.item_planned_start_date;
    const finalPlannedEnd = item_planned_end_date || dbMeeting.item_planned_end_date;
    const finalActualStart = item_actual_start_date || dbMeeting.item_actual_start_date;
    const finalActualEnd = item_actual_end_date || dbMeeting.item_actual_end_date;
    const finalContext = related_context_id || project_id || dbMeeting.related_context_id;
    const finalStatus = item_status || dbMeeting.item_status;
    const finalPriority = item_priority || dbMeeting.item_priority;
    const finalFollowBy = item_follow_by !== undefined ? item_follow_by : dbMeeting.item_follow_by;
    const finalAssignedBy = item_assigned_by !== undefined ? item_assigned_by : dbMeeting.item_assigned_by;

    // Merge content
    let mergedContent = { ...(dbMeeting.item_content || {}) };
    if (item_content) {
      mergedContent = { ...mergedContent, ...item_content };
    }
    if (content !== undefined) {
      mergedContent.content = content;
    }

    // Merge attribute
    let mergedAttribute = { ...(dbMeeting.item_attribute || {}) };
    if (item_attribute) {
      mergedAttribute = { ...mergedAttribute, ...item_attribute };
    }
    if (summary !== undefined) {
      mergedAttribute.summary = summary;
    }
    if (host !== undefined) {
      mergedAttribute.host = host;
    }
    if (file_path !== undefined) {
      mergedAttribute.file_path = file_path;
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動修改會議記錄'
    };
    const updatedLog = [logEntry, ...(dbMeeting.item_update_log || [])];

    let finalComments = dbMeeting.item_comment || [];
    if (item_comment !== undefined) {
      finalComments = item_comment;
    }

    const result = await query(
      `UPDATE project_item
       SET item_title = $1,
           item_planned_start_date = $2,
           item_planned_end_date = $3,
           item_actual_start_date = $4,
           item_actual_end_date = $5,
           related_context_id = $6,
           item_status = $7,
           item_priority = $8,
           item_follow_by = $9,
           item_content = $10,
           item_attribute = $11,
           item_update_log = $12,
           item_comment = $13,
           item_assigned_by = $14,
           item_updated_at = CURRENT_TIMESTAMP
       WHERE id = $15 RETURNING *`,
      [
        finalTitle,
        finalPlannedStart,
        finalPlannedEnd,
        finalActualStart,
        finalActualEnd,
        finalContext,
        finalStatus,
        finalPriority,
        finalFollowBy,
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

// DELETE meeting
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM project_item WHERE id = $1 AND item_type = 'Meeting' RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    res.json({ message: 'Meeting deleted successfully', meeting: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

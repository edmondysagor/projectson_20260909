import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
const query = (text: string, params?: any[]) => pool.query(text, params);

const router = Router();

// GET all tasks (project_item)
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query("SELECT item_uid as id, * FROM item ORDER BY created_at ASC");
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single task
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT item_uid as id, * FROM item WHERE item_uid = $1", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// CREATE task
router.post('/', async (req: Request, res: Response) => {
  try {
    const { item_title, related_context_uid, workspace_uid, item_type, item_status, item_priority, item_planned_start_date, item_planned_end_date, item_content, item_attribute, item_follow_by, item_assigned_by, parent_item_uid, related_item_uid_relation } = req.body;
    
    let workspaceId = workspace_uid;
    let finalContextId = related_context_uid;

    if (!finalContextId) {
      finalContextId = null;
      if (!workspaceId) {
        // Fallback: get absolute first workspace
        const wsRes = await query("SELECT workspace_uid FROM workspace ORDER BY workspace_uid ASC LIMIT 1");
        workspaceId = wsRes.rows.length > 0 ? wsRes.rows[0].workspace_uid : 1;
      }
    } else {
      // We have finalContextId, but maybe no workspaceId
      if (!workspaceId) {
        const contextRes = await query("SELECT related_workspace_uid FROM project_context WHERE context_uid = $1", [finalContextId]);
        workspaceId = contextRes.rows.length > 0 ? contextRes.rows[0].related_workspace_uid : 1;
      }
    }

    // 2. Atomically increment the workspace sequence and get the new values
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

    // 3. Format the new item_display_code (e.g. AAP-001)
    const item_display_code = `${prefix_code}-${String(last_item_number).padStart(3, '0')}`;

    const result = await query(
      `INSERT INTO item (item_display_code, item_title, workspace_uid, related_context_uid, item_type, item_status, item_priority, item_planned_start_date, item_planned_end_date, item_content, item_attribute, item_follow_by, item_assigned_by, parent_item_uid, related_item_uid_relation, prefix_code, item_number)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) RETURNING item_uid as id, *`,
      [
        item_display_code,
        item_title || 'New Task',
        workspaceId,
        finalContextId,
        item_type || 'Task',
        item_status || 'Not Start',
        item_priority || 'Low',
        item_planned_start_date || null,
        item_planned_end_date || null,
        item_content || {},
        item_attribute || {},
        item_follow_by || null,
        item_assigned_by || null,
        parent_item_uid || null,
        related_item_uid_relation ? JSON.stringify(related_item_uid_relation) : '[]',
        prefix_code,
        last_item_number
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// UPDATE task
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { 
      title, 
      description, 
      status, 
      nature, 
      assignees, 
      remarks_entry, 
      priority, 
      urgency, 
      due_date, 
      related_meeting_id, 
      bottleneck_id,
      item_title,
      item_status,
      item_type,
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
      related_context_uid,
      parent_item_uid,
      related_item_uid_relation
    } = req.body;

    // Get current record
    const current = await query('SELECT item_uid as id, * FROM item WHERE item_uid = $1', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const dbTask = current.rows[0];

    // Resolve fields
    const finalTitle = item_title || title || dbTask.item_title;
    const finalType = item_type || nature || dbTask.item_type;
    const finalContextId = related_context_uid || dbTask.related_context_uid;

    let finalStatus = dbTask.item_status;
    if (item_status) {
      finalStatus = item_status;
    } else if (status) {
      if (status === 'TODO') finalStatus = 'Not Start';
      else if (status === 'IN_PROGRESS') finalStatus = 'In Progress';
      else if (status === 'DONE') finalStatus = 'Completed';
      else if (status === 'BLOCKED') finalStatus = 'Stuck';
      else finalStatus = status;
    }

    const finalPriority = item_priority || priority || dbTask.item_priority;
    const finalPlannedStart = item_planned_start_date || dbTask.item_planned_start_date;
    const finalPlannedEnd = item_planned_end_date || due_date || dbTask.item_planned_end_date;
    const finalActualStart = item_actual_start_date || dbTask.item_actual_start_date;
    const finalActualEnd = item_actual_end_date || dbTask.item_actual_end_date;
    const finalFollowBy = item_follow_by !== undefined ? item_follow_by : dbTask.item_follow_by;
    const finalAssignedBy = item_assigned_by !== undefined ? item_assigned_by : dbTask.item_assigned_by;

    // Merge content
    let mergedContent = { ...(dbTask.item_content || {}) };
    if (item_content) {
      mergedContent = { ...mergedContent, ...item_content };
    }
    if (description !== undefined) {
      mergedContent.description = description;
    }

    // Merge attribute
    let mergedAttribute = { ...(dbTask.item_attribute || {}) };
    if (item_attribute) {
      mergedAttribute = { ...mergedAttribute, ...item_attribute };
    }
    if (assignees !== undefined) {
      mergedAttribute.assignees = assignees;
    }
    if (related_meeting_id !== undefined) {
      mergedAttribute.related_meeting_id = related_meeting_id;
    }
    if (bottleneck_id !== undefined) {
      mergedAttribute.bottleneck_id = bottleneck_id;
    }

    // Append update log
    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動修改任務工單'
    };
    const updatedLog = [logEntry, ...(dbTask.item_update_log || [])];

    let finalComments = dbTask.item_comment || [];
    if (item_comment !== undefined) {
      finalComments = item_comment;
    }

    // Sync parent_item_uid
    const finalParentId = parent_item_uid !== undefined ? parent_item_uid : dbTask.parent_item_uid;

    // Sync related_item_uid_relation array
    let finalRelations = related_item_uid_relation !== undefined ? related_item_uid_relation : (Array.isArray(dbTask.related_item_uid_relation) ? [...dbTask.related_item_uid_relation] : []);
    
    const oldMeetingId = dbTask.item_attribute?.related_meeting_id ? parseInt(dbTask.item_attribute.related_meeting_id, 10) : null;
    const newMeetingId = mergedAttribute.related_meeting_id ? parseInt(mergedAttribute.related_meeting_id, 10) : null;
    if (oldMeetingId && oldMeetingId !== newMeetingId) {
      finalRelations = finalRelations.filter((r: any) => !(r.target_id === oldMeetingId && r.relation === 'discussed_in'));
    }
    if (newMeetingId && !isNaN(newMeetingId) && !finalRelations.some((r: any) => r.target_id === newMeetingId && r.relation === 'discussed_in')) {
      finalRelations.push({ target_id: newMeetingId, relation: 'discussed_in' });
    }

    const oldBottleneckId = dbTask.item_attribute?.bottleneck_id ? parseInt(dbTask.item_attribute.bottleneck_id, 10) : null;
    const newBottleneckId = mergedAttribute.bottleneck_id ? parseInt(mergedAttribute.bottleneck_id, 10) : null;
    if (oldBottleneckId && oldBottleneckId !== newBottleneckId) {
      finalRelations = finalRelations.filter((r: any) => !(r.target_id === oldBottleneckId && r.relation === 'blocked_by'));
    }
    if (newBottleneckId && !isNaN(newBottleneckId) && !finalRelations.some((r: any) => r.target_id === newBottleneckId && r.relation === 'blocked_by')) {
      finalRelations.push({ target_id: newBottleneckId, relation: 'blocked_by' });
    }

    const result = await query(
      `UPDATE item
       SET item_title = $1,
           item_type = $2,
           item_status = $3,
           item_priority = $4,
           item_planned_start_date = $5,
           item_planned_end_date = $6,
           item_actual_start_date = $7,
           item_actual_end_date = $8,
           item_follow_by = $9,
           item_content = $10,
           item_attribute = $11,
           item_update_log = $12,
           item_comment = $13,
           related_context_uid = $14,
           parent_item_uid = $15,
           related_item_uid_relation = $16,
           item_assigned_by = $17,
           item_updated_at = CURRENT_TIMESTAMP
       WHERE item_uid = $18 RETURNING item_uid as id, *`,
      [
        finalTitle,
        finalType,
        finalStatus,
        finalPriority,
        finalPlannedStart,
        finalPlannedEnd,
        finalActualStart,
        finalActualEnd,
        finalFollowBy,
        JSON.stringify(mergedContent),
        JSON.stringify(mergedAttribute),
        JSON.stringify(updatedLog),
        JSON.stringify(finalComments),
        finalContextId,
        finalParentId,
        JSON.stringify(finalRelations),
        finalAssignedBy,
        id
      ]
    );

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Update Task Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE task
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("DELETE FROM item WHERE item_uid = $1 RETURNING item_uid as id, *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    res.json({ message: 'Task deleted successfully', task: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

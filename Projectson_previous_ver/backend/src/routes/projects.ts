import { Router, Request, Response } from 'express';
import { query } from '../config/database';

const router = Router();

// GET all projects
router.get('/', async (req: Request, res: Response) => {
  try {
    const result = await query("SELECT * FROM project_context WHERE content_type = 'Project' ORDER BY id ASC");
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET single project
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await query("SELECT * FROM project_context WHERE id = $1 AND content_type = 'Project'", [id]);
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
    const {
      content_name,
      related_workspace_id,
      parent_content_id,
      content_status,
      project_type,
      project_type_sequence,
      planned_start_date,
      planned_end_date,
      content,
      remarks_entry
    } = req.body;
    
    // Atomically increment and get last_context_number from workspace
    const wsId = related_workspace_id || 1;
    const wsUpdateRes = await query(
      "UPDATE workspace SET last_context_number = COALESCE(last_context_number, 0) + 1 WHERE workspace_id = $1 RETURNING prefix_code, last_context_number",
      [wsId]
    );
    let prefix = 'AAP';
    let last_context_number = 1;
    if (wsUpdateRes.rows.length > 0) {
      prefix = wsUpdateRes.rows[0].prefix_code;
      last_context_number = wsUpdateRes.rows[0].last_context_number;
    }
    const content_display_id = `${prefix}-COT-${last_context_number}`;

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動建立專案項目'
    };

    const result = await query(
      `INSERT INTO project_context (
        content_name, content_display_id, content_type, related_workspace_id,
        parent_content_id, content_status, project_type, project_type_sequence,
        planned_start_date, planned_end_date, content, content_update_log
      ) VALUES ($1, $2, 'Project', $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        content_name || 'New Project',
        content_display_id,
        related_workspace_id || 1,
        parent_content_id || null,
        content_status || 'Active',
        project_type || 'Phase',
        project_type_sequence !== undefined ? project_type_sequence : 1,
        planned_start_date || null,
        planned_end_date || null,
        JSON.stringify(content || {}),
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
    const {
      content_name,
      related_workspace_id,
      parent_content_id,
      content_status,
      project_type,
      project_type_sequence,
      planned_start_date,
      planned_end_date,
      actual_start_date,
      actual_end_date,
      content,
      remarks_entry
    } = req.body;

    const current = await query('SELECT * FROM project_context WHERE id = $1 AND content_type = \'Project\'', [id]);
    if (current.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const dbProj = current.rows[0];

    const finalName = content_name || dbProj.content_name;
    const finalWorkspaceId = related_workspace_id || dbProj.related_workspace_id;
    const finalParentId = parent_content_id !== undefined ? parent_content_id : dbProj.parent_content_id;
    const finalStatus = content_status || dbProj.content_status;
    const finalProjType = project_type !== undefined ? project_type : dbProj.project_type;
    const finalSequence = project_type_sequence !== undefined ? project_type_sequence : dbProj.project_type_sequence;
    const finalPlannedStart = planned_start_date !== undefined ? planned_start_date : dbProj.planned_start_date;
    const finalPlannedEnd = planned_end_date !== undefined ? planned_end_date : dbProj.planned_end_date;
    const finalActualStart = actual_start_date !== undefined ? actual_start_date : dbProj.actual_start_date;
    const finalActualEnd = actual_end_date !== undefined ? actual_end_date : dbProj.actual_end_date;

    let mergedContent = { ...(dbProj.content || {}) };
    if (content) {
      mergedContent = { ...mergedContent, ...content };
    }

    const logEntry = {
      timestamp: new Date().toISOString(),
      user: 'User',
      text: remarks_entry || '手動修改專案資料'
    };
    const updatedLog = [logEntry, ...(dbProj.content_update_log || [])];

    const result = await query(
      `UPDATE project_context
       SET content_name = $1,
           related_workspace_id = $2,
           parent_content_id = $3,
           content_status = $4,
           project_type = $5,
           project_type_sequence = $6,
           planned_start_date = $7,
           planned_end_date = $8,
           actual_start_date = $9,
           actual_end_date = $10,
           content = $11,
           content_update_log = $12,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13 RETURNING *`,
      [
        finalName,
        finalWorkspaceId,
        finalParentId,
        finalStatus,
        finalProjType,
        finalSequence,
        finalPlannedStart,
        finalPlannedEnd,
        finalActualStart,
        finalActualEnd,
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
    const result = await query("DELETE FROM project_context WHERE id = $1 AND content_type = 'Project' RETURNING *", [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ message: 'Project deleted successfully', project: result.rows[0] });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

import { Router, Request, Response } from 'express';
import { pool } from '../db.js';
const query = (text: string, params?: any[]) => pool.query(text, params);

const router = Router();

// POST /api/templates/copy-tasks
router.post('/copy-tasks', async (req: Request, res: Response) => {
  try {
    const { targetProjectId, sourceProjectId } = req.body;

    if (!targetProjectId || !sourceProjectId) {
      return res.status(400).json({ error: 'Missing targetProjectId or sourceProjectId' });
    }

    // Verify target project exists
    const targetContextRes = await query("SELECT related_workspace_uid FROM project_context WHERE item_uid = $1", [targetProjectId]);
    if (targetContextRes.rows.length === 0) {
      return res.status(404).json({ error: 'Target project not found' });
    }
    const targetWorkspaceId = targetContextRes.rows[0].related_workspace_uid || 1;

    // Get all items from source project
    const itemsRes = await query("SELECT * FROM item WHERE related_context_uid = $1", [sourceProjectId]);
    const sourceItems = itemsRes.rows;

    if (sourceItems.length === 0) {
      return res.json({ success: true, count: 0, message: 'Source project has no tasks to copy.' });
    }

    // Atomically allocate item sequence numbers in workspace
    const wsRes = await query(
      "UPDATE workspace SET last_item_number = COALESCE(last_item_number, 0) + $1 WHERE workspace_uid = $2 RETURNING prefix_code, last_item_number",
      [sourceItems.length, targetWorkspaceId]
    );

    let prefix_code = 'UNK';
    let last_item_number = sourceItems.length;
    if (wsRes.rows.length > 0) {
      prefix_code = wsRes.rows[0].prefix_code;
      last_item_number = wsRes.rows[0].last_item_number;
    }

    const startNum = last_item_number - sourceItems.length + 1;
    const idMap = new Map<number, number>(); // sourceId -> targetId
    const itemsToUpdateParent: { targetId: number, sourceParentId: number }[] = [];

    // Loop and insert cloned tasks
    for (let i = 0; i < sourceItems.length; i++) {
      const item = sourceItems[i];
      const newDisplayId = `${prefix_code}-${String(startNum + i).padStart(3, '0')}`;
      
      const logEntry = {
        timestamp: new Date().toISOString(),
        user: 'System',
        text: `從專案 ID ${sourceProjectId} 複製建立範本工單`
      };

      const insertRes = await query(
        `INSERT INTO item (
          item_display_code, item_title, related_context_uid, item_type, item_status, item_priority,
          item_planned_start_date, item_planned_end_date, item_content, item_update_log
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          newDisplayId,
          item.item_title,
          targetProjectId,
          item.item_type,
          'Not Start',
          item.item_priority || 'Middle',
          item.item_planned_start_date || null,
          item.item_planned_end_date || null,
          item.item_content || {},
          JSON.stringify([logEntry])
        ]
      );

      const newId = insertRes.rows[0].id;
      idMap.set(item.id, newId);

      if (item.parent_item_uid) {
        itemsToUpdateParent.push({ targetId: newId, sourceParentId: Number(item.parent_item_uid) });
      }
    }

    // Update parent relations for nested tasks/milestones
    for (const link of itemsToUpdateParent) {
      const targetParentId = idMap.get(link.sourceParentId);
      if (targetParentId) {
        await query("UPDATE item SET parent_item_uid = $1 WHERE item_uid = $2", [targetParentId, link.targetId]);
      }
    }

    res.json({ success: true, count: sourceItems.length, message: `Successfully cloned ${sourceItems.length} items.` });

  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/templates
router.get('/', async (req: Request, res: Response) => {
  try {
    const { workspaceId, targetType } = req.query;
    let sql = 'SELECT * FROM item_templates WHERE workspace_uid = $1';
    const params: any[] = [workspaceId];
    if (targetType) {
      sql += ' AND target_type = $2';
      params.push(targetType);
    }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json(result.rows);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/templates
router.post('/', async (req: Request, res: Response) => {
  try {
    const { workspace_uid, template_name, target_type, template_schema } = req.body;
    const result = await query(
      `INSERT INTO item_templates (workspace_uid, template_name, target_type, template_schema)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [workspace_uid, template_name, target_type, JSON.stringify(template_schema)]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/templates/:id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { template_name, target_type, template_schema } = req.body;
    const result = await query(
      `UPDATE item_templates 
       SET template_name = $1, target_type = $2, template_schema = $3, updated_at = CURRENT_TIMESTAMP
       WHERE item_uid = $4 RETURNING *`,
      [template_name, target_type, JSON.stringify(template_schema), id]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/templates/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await query(`DELETE FROM item_templates WHERE item_uid = $1`, [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to recursively create items
async function applyTemplateRecursively(
  templateNode: any,
  workspaceId: number,
  projectId: number,
  parentId: number | null,
  reqUser: string = 'System'
) {
  // 1. Allocate sequence number
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
  const newDisplayId = `${prefix_code}-${String(last_item_number).padStart(3, '0')}`;

  const logEntry = {
    timestamp: new Date().toISOString(),
    user: reqUser,
    text: `透過範本建立項目`
  };

  const insertRes = await query(
    `INSERT INTO item (
      item_display_code, item_title, related_context_uid, item_type, item_status, item_priority,
      parent_item_uid, item_content, item_update_log, workspace_uid
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [
      newDisplayId,
      templateNode.item_title || 'New Item',
      projectId,
      templateNode.item_type || 'Task',
      templateNode.item_status || 'Not Start',
      templateNode.item_priority || 'Middle',
      parentId ? parentId : null,
      (() => {
        let content = templateNode.item_content;
        if (typeof content === 'string') {
          try { content = JSON.parse(content); } catch (e) {}
        }
        if (Array.isArray(content)) {
          return JSON.stringify({ description: content });
        }
        return JSON.stringify(content || {});
      })(),
      JSON.stringify([logEntry]),
      workspaceId
    ]
  );

  const newId = insertRes.rows[0].id;

  if (templateNode.children && Array.isArray(templateNode.children)) {
    for (const child of templateNode.children) {
      await applyTemplateRecursively(child, workspaceId, projectId, newId, reqUser);
    }
  }
}

// POST /api/templates/apply
router.post('/apply', async (req: Request, res: Response) => {
  try {
    const { templateId, projectId, workspaceId } = req.body;
    
    // Fetch template
    const templateRes = await query("SELECT template_schema FROM item_templates WHERE item_uid = $1", [templateId]);
    if (templateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    const templateSchema = templateRes.rows[0].template_schema;

    // Apply template recursively
    if (Array.isArray(templateSchema)) {
      for (const node of templateSchema) {
        await applyTemplateRecursively(node, workspaceId, projectId, null, 'User'); // Pass actual user if available
      }
    } else {
      await applyTemplateRecursively(templateSchema, workspaceId, projectId, null, 'User'); // Pass actual user if available
    }
    
    res.json({ success: true, message: 'Template applied successfully.' });
  } catch (error: any) {
    console.error('Error applying template:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

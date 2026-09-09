import { Router, Request, Response } from 'express';
import { query, appendRemark } from '../config/database';

const router = Router();

// POST /api/proposals/accept - Accepts and commits a proposal to the DB
router.post('/accept', async (req: Request, res: Response) => {
  try {
    const { proposal } = req.body;

    if (!proposal || !proposal.type || !proposal.targetType) {
      return res.status(400).json({ error: 'Invalid proposal format.' });
    }

    const { type, targetType, targetId, after } = proposal;

    // --- SPRINT 1 PROPOSAL HANDLERS ---
    if (type === 'create_new_log') {
      if (targetType === 'task') {
        const remarks = appendRemark(
          [],
          after.remarks_entry || '透過 AI 提案新建任務',
          'AI (Approved)'
        );

        const result = await query(
          `INSERT INTO tasks (product_id, project_id, title, description, status, nature, assignees, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [
            after.product_id || '11111111-1111-1111-1111-111111111111',
            after.project_id || '22222222-2222-2222-2222-222222222222',
            after.title,
            after.description || '',
            after.status || 'TODO',
            after.nature || 'PoC驗證',
            after.assignees || [],
            remarks
          ]
        );
        return res.status(201).json({ success: true, message: 'Task created successfully', record: result.rows[0] });

      } else if (targetType === 'meeting') {
        const remarks = appendRemark(
          [],
          after.remarks_entry || '透過 AI 提案新建會議記錄',
          'AI (Approved)'
        );

        const result = await query(
          `INSERT INTO meetings (product_id, project_id, title, meeting_date, summary, content, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            after.product_id || '11111111-1111-1111-1111-111111111111',
            after.project_id || '22222222-2222-2222-2222-222222222222',
            after.title,
            after.meeting_date || new Date(),
            after.summary || '',
            after.description_or_content || after.content,
            remarks
          ]
        );
        return res.status(201).json({ success: true, message: 'Meeting created successfully', record: result.rows[0] });
      }

    } else if (type === 'update_existing_log') {
      if (!targetId) {
        return res.status(400).json({ error: 'targetId is required for updates.' });
      }

      if (targetType === 'task') {
        const currentTaskRes = await query('SELECT * FROM tasks WHERE id = $1', [targetId]);
        if (currentTaskRes.rows.length === 0) {
          return res.status(404).json({ error: 'Target task not found.' });
        }
        const currentTask = currentTaskRes.rows[0];

        let newReopenCount = currentTask.reopen_count;
        if (currentTask.status === 'DONE' && after.status && after.status !== 'DONE') {
          newReopenCount += 1;
        }

        const remarks = appendRemark(
          currentTask.remarks,
          after.remarks_entry || '透過 AI 提案更新任務資料',
          'AI (Approved)'
        );

        const result = await query(
          `UPDATE tasks
           SET title = COALESCE($1, title),
               description = COALESCE($2, description),
               status = COALESCE($3, status),
               nature = COALESCE($4, nature),
               assignees = COALESCE($5, assignees),
               reopen_count = $6,
               remarks = $7,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $8 RETURNING *`,
          [
            after.title,
            after.description,
            after.status,
            after.nature,
            after.assignees,
            newReopenCount,
            remarks,
            targetId
          ]
        );
        return res.json({ success: true, message: 'Task updated successfully', record: result.rows[0] });

      } else if (targetType === 'meeting') {
        const currentMeetingRes = await query('SELECT * FROM meetings WHERE id = $1', [targetId]);
        if (currentMeetingRes.rows.length === 0) {
          return res.status(404).json({ error: 'Target meeting not found.' });
        }
        const currentMeeting = currentMeetingRes.rows[0];

        const remarks = appendRemark(
          currentMeeting.remarks,
          after.remarks_entry || '透過 AI 提案更新會議記錄',
          'AI (Approved)'
        );

        const result = await query(
          `UPDATE meetings
           SET title = COALESCE($1, title),
               meeting_date = COALESCE($2, meeting_date),
               summary = COALESCE($3, summary),
               content = COALESCE($4, content),
               remarks = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $6 RETURNING *`,
          [
            after.title,
            after.meeting_date,
            after.summary,
            after.description_or_content || after.content,
            remarks,
            targetId
          ]
        );
        return res.json({ success: true, message: 'Meeting updated successfully', record: result.rows[0] });
      }

    // --- SPRINT 2 PROPOSAL HANDLERS (Router + Baseline Agent) ---
    } else if (type === 'upsert_charter') {
      const projectId = after.project_id || '22222222-2222-2222-2222-222222222222';
      const title = after.title || '專案章程';
      
      const contentJson = {
        goals: after.goals || '',
        scope: after.scope || '',
        out_of_scope: after.out_of_scope || '',
        w5h2: after.w5h2 || {}
      };

      const currentCharterRes = await query('SELECT * FROM charters WHERE project_id = $1', [projectId]);
      
      if (currentCharterRes.rows.length > 0) {
        const existing = currentCharterRes.rows[0];
        const remarks = appendRemark(
          existing.remarks,
          after.remarks_entry || 'AI 規劃大腦更新專案章程',
          'AI (Approved)'
        );

        const result = await query(
          `UPDATE charters
           SET title = $1,
               content = $2,
               remarks = $3,
               updated_at = CURRENT_TIMESTAMP
           WHERE project_id = $4 RETURNING *`,
          [title, JSON.stringify(contentJson), remarks, projectId]
        );
        return res.json({ success: true, message: 'Charter updated successfully', record: result.rows[0] });
      } else {
        const remarks = appendRemark(
          [],
          after.remarks_entry || 'AI 規劃大腦起草專案章程',
          'AI (Approved)'
        );

        const result = await query(
          `INSERT INTO charters (project_id, title, content, remarks)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [projectId, title, JSON.stringify(contentJson), remarks]
        );
        return res.status(201).json({ success: true, message: 'Charter created successfully', record: result.rows[0] });
      }

    } else if (type === 'create_requirement') {
      // Handles requirement creation, but checks if it is actually a traceability mapping proposal
      if (after.requirement_id && after.task_id) {
        // Trace matrix linkage route
        const result = await query(
          `INSERT INTO traceability_matrix (project_id, requirement_id, task_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (requirement_id, task_id) DO NOTHING
           RETURNING *`,
          [
            after.project_id || '22222222-2222-2222-2222-222222222222',
            after.requirement_id,
            after.task_id
          ]
        );
        // Return dummy record indicating trace type
        return res.status(201).json({ success: true, message: 'Traceability link established', record: { id: after.requirement_id, type: 'traceability' } });
      }

      // Regular requirement creation
      const projectId = after.project_id || '22222222-2222-2222-2222-222222222222';
      const remarks = appendRemark(
        [],
        after.remarks_entry || 'AI 規劃大腦建立需求基準',
        'AI (Approved)'
      );

      const result = await query(
        `INSERT INTO requirement_logs (project_id, title, description, category, priority, status, remarks)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          projectId,
          after.title,
          after.description || '',
          after.category || 'Functional',
          after.priority || 'Medium',
          after.status || 'DRAFT',
          remarks
        ]
      );
      return res.status(201).json({ success: true, message: 'Requirement created successfully', record: result.rows[0] });

    } else if (type === 'update_requirement') {
      if (!targetId) {
        return res.status(400).json({ error: 'targetId is required for updating requirement.' });
      }

      const currentReqRes = await query('SELECT * FROM requirement_logs WHERE id = $1', [targetId]);
      if (currentReqRes.rows.length === 0) {
        return res.status(404).json({ error: 'Target requirement not found.' });
      }
      const currentReq = currentReqRes.rows[0];

      const remarks = appendRemark(
        currentReq.remarks,
        after.remarks_entry || 'AI 規劃大腦修改需求基準',
        'AI (Approved)'
      );

      const result = await query(
        `UPDATE requirement_logs
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             category = COALESCE($3, category),
             priority = COALESCE($4, priority),
             status = COALESCE($5, status),
             remarks = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 RETURNING *`,
        [
          after.title,
          after.description,
          after.category,
          after.priority,
          after.status,
          remarks,
          targetId
        ]
      );
      return res.json({ success: true, message: 'Requirement updated successfully', record: result.rows[0] });

    // --- SPRINT 3 PROPOSAL HANDLERS (Complete 10-Table Schema) ---
    } else if (type === 'upsert_project_plan') {
      const projectId = after.project_id || '22222222-2222-2222-2222-222222222222';
      const title = after.title || '新 WBS 計畫';
      const r = after.r_assignees || [];
      const a = after.a_assignees || [];
      const c = after.c_assignees || [];
      const i = after.i_assignees || [];

      if (targetId) {
        const currentRes = await query('SELECT * FROM project_plans WHERE id = $1', [targetId]);
        if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Plan not found.' });
        
        const remarks = appendRemark(
          currentRes.rows[0].remarks,
          after.remarks_entry || 'AI 規劃大腦更新 WBS 里程碑計畫',
          'AI (Approved)'
        );

        const result = await query(
          `UPDATE project_plans
           SET title = $1,
               description = COALESCE($2, description),
               milestone_date = COALESCE($3, milestone_date),
               r_assignees = $4,
               a_assignees = $5,
               c_assignees = $6,
               i_assignees = $7,
               remarks = $8,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $9 RETURNING *`,
          [title, after.description, after.milestone_date, r, a, c, i, remarks, targetId]
        );
        return res.json({ success: true, message: 'WBS Plan updated', record: result.rows[0] });
      } else {
        const remarks = appendRemark(
          [],
          after.remarks_entry || 'AI 規劃大腦起草 WBS 里程碑計畫',
          'AI (Approved)'
        );

        const result = await query(
          `INSERT INTO project_plans (project_id, title, description, milestone_date, r_assignees, a_assignees, c_assignees, i_assignees, remarks)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
          [projectId, title, after.description || '', after.milestone_date || new Date(), r, a, c, i, remarks]
        );
        return res.status(201).json({ success: true, message: 'WBS Plan created', record: result.rows[0] });
      }

    } else if (type === 'create_traceability_link') {
      const projectId = after.project_id || '22222222-2222-2222-2222-222222222222';
      const result = await query(
        `INSERT INTO traceability_matrix (project_id, requirement_id, task_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (requirement_id, task_id) DO NOTHING
         RETURNING *`,
        [projectId, after.requirement_id, after.task_id]
      );
      return res.status(201).json({ success: true, message: 'Traceability link established', record: { id: after.requirement_id, type: 'traceability' } });

    } else if (type === 'create_bottleneck') {
      const projectId = after.project_id || '22222222-2222-2222-2222-222222222222';
      const remarks = appendRemark(
        [],
        after.remarks_entry || 'AI 執行大腦登錄系統瓶頸',
        'AI (Approved)'
      );

      const result = await query(
        `INSERT INTO bottlenecks (project_id, title, description, severity, status, remarks)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [projectId, after.title, after.description || '', after.severity || 'Medium', 'ACTIVE', remarks]
      );
      return res.status(201).json({ success: true, message: 'Bottleneck risk registered', record: result.rows[0] });

    } else if (type === 'learn_project_knowledge') {
      const productId = after.product_id || '11111111-1111-1111-1111-111111111111';
      
      // Strict duplicate term protection
      const dup = await query('SELECT * FROM knowledge_notes WHERE term = $1', [after.term]);
      if (dup.rows.length > 0) {
        return res.status(409).json({ error: `Term "${after.term}" already exists.` });
      }

      const remarks = appendRemark(
        [],
        after.remarks_entry || 'AI 知識大腦紀錄術語定義',
        'AI (Approved)'
      );

      const result = await query(
        `INSERT INTO knowledge_notes (product_id, term, definition, kpi_formula, remarks)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [productId, after.term, after.definition, after.kpi_formula || '', remarks]
      );
      return res.status(201).json({ success: true, message: 'Knowledge notes added', record: result.rows[0] });
    }

    res.status(400).json({ error: 'Unsupported proposal action type.' });
  } catch (error: any) {
    console.error('Error committing proposal:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const projectRouter = Router()

// GET /api/projects - 取得專案列表 (可透過 workspace_uid, project_type, project_status 篩選)
projectRouter.get('/', async (req: Request, res: Response) => {
  const { workspace_uid, project_type, project_status, parent_project_uid } = req.query

  try {
    let query = `
      SELECT 
        p.*,
        w.workspace_name,
        w.prefix_code as workspace_prefix,
        m.member_name as owner_name,
        m.member_email as owner_email
      FROM public.project p
      JOIN public.workspace w ON p.related_workspace_uid = w.workspace_uid
      LEFT JOIN public.member m ON p.project_owner = m.member_uid
      WHERE 1=1
    `
    const params: any[] = []

    if (workspace_uid) {
      params.push(workspace_uid)
      query += ` AND p.related_workspace_uid = $${params.length}`
    }
    if (project_type) {
      params.push(project_type)
      query += ` AND p.project_type = $${params.length}`
    }
    if (project_status) {
      params.push(project_status)
      query += ` AND p.project_status = $${params.length}`
    }
    if (parent_project_uid) {
      params.push(parent_project_uid)
      query += ` AND p.parent_project_uid = $${params.length}`
    }

    query += ` ORDER BY p.project_type_sequence ASC, p.created_at DESC`

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err: any) {
    console.error('Fetch projects error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/projects/:uid - 取得單一專案詳情
projectRouter.get('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  try {
    const result = await pool.query(
      `SELECT 
        p.*,
        w.workspace_name,
        w.prefix_code as workspace_prefix,
        m.member_name as owner_name,
        m.member_email as owner_email,
        parent.project_name as parent_project_name,
        parent.project_display_code as parent_display_code
      FROM public.project p
      JOIN public.workspace w ON p.related_workspace_uid = w.workspace_uid
      LEFT JOIN public.member m ON p.project_owner = m.member_uid
      LEFT JOIN public.project parent ON p.parent_project_uid = parent.project_uid
      WHERE p.project_uid = $1`,
      [uid]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }
    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Get project error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/projects - 建立新專案/產品 (原子自增 project_number 並生成 project_display_code)
projectRouter.post('/', async (req: Request, res: Response) => {
  const {
    project_name,
    project_type = 'Project',
    related_workspace_uid,
    parent_project_uid,
    project_status = 'Pipeline',
    project_sub_type,
    project_type_sequence,
    project_owner,
    planned_start_date,
    planned_end_date,
    project_content,
    allow_access_member
  } = req.body

  if (!project_name || !related_workspace_uid) {
    return res.status(400).json({ error: 'project_name and related_workspace_uid are required' })
  }

  // 業務檢驗: Product 不得有 sub_type; Project 必須為 Phase 或 BAU
  const subType = project_type === 'Product' ? null : (project_sub_type || 'BAU')
  const defaultSeq = project_type_sequence ?? (subType === 'BAU' ? 0 : 1)

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 原子遞增獲取流水號與 workspace prefix (行級排他鎖，徹底防止撞號)
    const wsRes = await client.query(
      `UPDATE public.workspace
       SET last_project_number = last_project_number + 1
       WHERE workspace_uid = $1
       RETURNING prefix_code, last_project_number`,
      [related_workspace_uid]
    )

    if (wsRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Target workspace not found' })
    }

    const { prefix_code, last_project_number } = wsRes.rows[0]
    const project_display_code = `${prefix_code}-PRO-${last_project_number}`

    // 2. 插入專案記錄
    const insertRes = await client.query(
      `INSERT INTO public.project (
        project_name,
        project_display_code,
        project_number,
        project_type,
        related_workspace_uid,
        parent_project_uid,
        project_status,
        project_sub_type,
        project_type_sequence,
        project_owner,
        planned_start_date,
        planned_end_date,
        project_content,
        allow_access_member
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        project_name.trim(),
        project_display_code,
        last_project_number,
        project_type,
        related_workspace_uid,
        parent_project_uid || null,
        project_status,
        subType,
        defaultSeq,
        project_owner || null,
        planned_start_date || null,
        planned_end_date || null,
        JSON.stringify(project_content || {}),
        JSON.stringify(allow_access_member || [])
      ]
    )

    await client.query('COMMIT')
    res.status(201).json(insertRes.rows[0])
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Create project error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// PATCH /api/projects/:uid - 就地局部更新專案 (Inline Editing 專用)
projectRouter.patch('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  const updates = req.body

  // 允許更新的欄位白名單 (Display Code, Number, Created At 禁止篡改)
  const allowedFields = [
    'project_name',
    'project_type',
    'parent_project_uid',
    'project_status',
    'project_sub_type',
    'project_type_sequence',
    'project_owner',
    'planned_start_date',
    'planned_end_date',
    'actual_start_date',
    'actual_end_date',
    'project_content',
    'allow_access_member'
  ]

  const setClauses: string[] = []
  const values: any[] = []

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      values.push(
        key === 'project_content' || key === 'allow_access_member'
          ? JSON.stringify(updates[key])
          : updates[key]
      )
      setClauses.push(`${key} = $${values.length}`)
    }
  })

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update' })
  }

  values.push(uid)
  const query = `
    UPDATE public.project
    SET ${setClauses.join(', ')}
    WHERE project_uid = $${values.length}
    RETURNING *
  `

  try {
    const result = await pool.query(query, values)
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }
    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Update project error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/projects/:uid - 刪除專案
projectRouter.delete('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  try {
    const result = await pool.query(
      `DELETE FROM public.project WHERE project_uid = $1 RETURNING project_uid`,
      [uid]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' })
    }
    res.json({ message: 'Project deleted successfully', project_uid: uid })
  } catch (err: any) {
    console.error('Delete project error:', err)
    res.status(500).json({ error: err.message })
  }
})

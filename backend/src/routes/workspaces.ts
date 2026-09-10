import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const workspaceRouter = Router()

// GET /api/workspaces - 取得所有工作區列表
workspaceRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT 
        workspace_uid, 
        prefix_code, 
        workspace_name, 
        workspace_created_at, 
        last_item_number, 
        last_project_number, 
        allow_access_member
      FROM public.workspace 
      ORDER BY workspace_created_at DESC
    `)
    res.json(result.rows)
  } catch (err: any) {
    console.error('Fetch workspaces error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/workspaces/:uid - 取得單一工作區詳情
workspaceRouter.get('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  try {
    const result = await pool.query(
      `SELECT * FROM public.workspace WHERE workspace_uid = $1`,
      [uid]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' })
    }
    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Get workspace error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/workspaces - 建立新工作區
workspaceRouter.post('/', async (req: Request, res: Response) => {
  const { prefix_code, workspace_name, allow_access_member } = req.body

  if (!prefix_code || !workspace_name) {
    return res.status(400).json({ error: 'prefix_code and workspace_name are required' })
  }

  const cleanPrefix = prefix_code.trim().toUpperCase()
  const cleanName = workspace_name.trim()

  try {
    // 1. 預先檢查前綴唯一性 (防衝突友善提示)
    const checkRes = await pool.query(
      `SELECT workspace_name FROM public.workspace WHERE UPPER(prefix_code) = $1`,
      [cleanPrefix]
    )
    if (checkRes.rows.length > 0) {
      return res.status(400).json({
        error: `代號「${cleanPrefix}」已被工作區「${checkRes.rows[0].workspace_name}」使用，請更換其他 2-5 個字母代號。`
      })
    }

    // 2. 插入新工作區
    const result = await pool.query(
      `INSERT INTO public.workspace (prefix_code, workspace_name, allow_access_member)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [cleanPrefix, cleanName, JSON.stringify(allow_access_member || [])]
    )

    res.status(201).json(result.rows[0])
  } catch (err: any) {
    if (err.code === '23505') {
      return res.status(400).json({ error: `代號「${cleanPrefix}」已存在，請使用不同代號。` })
    }
    console.error('Create workspace error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/workspaces/:uid - 重新命名或更新工作區
workspaceRouter.put('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  const { workspace_name, allow_access_member } = req.body

  try {
    const result = await pool.query(
      `UPDATE public.workspace
       SET 
         workspace_name = COALESCE($1, workspace_name),
         allow_access_member = COALESCE($2, allow_access_member)
       WHERE workspace_uid = $3
       RETURNING *`,
      [
        workspace_name ? workspace_name.trim() : null,
        allow_access_member ? JSON.stringify(allow_access_member) : null,
        uid
      ]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' })
    }
    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Update workspace error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/workspaces/:uid - 刪除工作區 (級聯刪除 projects & items)
workspaceRouter.delete('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  try {
    const result = await pool.query(
      `DELETE FROM public.workspace WHERE workspace_uid = $1 RETURNING workspace_uid`,
      [uid]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Workspace not found' })
    }
    res.json({ message: 'Workspace deleted successfully', workspace_uid: uid })
  } catch (err: any) {
    console.error('Delete workspace error:', err)
    res.status(500).json({ error: err.message })
  }
})

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
        allow_access_member,
        owner_member_uid,
        owner_email
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
  const { prefix_code, workspace_name, allow_access_member, owner_member_uid, owner_email } = req.body

  if (!prefix_code || !workspace_name) {
    return res.status(400).json({ error: 'prefix_code and workspace_name are required' })
  }

  const cleanPrefix = prefix_code.trim().toUpperCase()
  const cleanName = workspace_name.trim()

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 預先檢查前綴唯一性 (防衝突友善提示)
    const checkRes = await client.query(
      `SELECT workspace_name FROM public.workspace WHERE UPPER(prefix_code) = $1`,
      [cleanPrefix]
    )
    if (checkRes.rows.length > 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({
        error: `代號「${cleanPrefix}」已被工作區「${checkRes.rows[0].workspace_name}」使用，請更換其他 2-5 個字母代號。`
      })
    }

    // 2. 插入新工作區
    const result = await client.query(
      `INSERT INTO public.workspace (prefix_code, workspace_name, allow_access_member, owner_member_uid, owner_email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        cleanPrefix, 
        cleanName, 
        JSON.stringify(allow_access_member || []),
        owner_member_uid || null,
        owner_email ? owner_email.trim().toLowerCase() : null
      ]
    )

    const newWs = result.rows[0]

    // 3. 自動同步擁有者的 own_workspace_uid JSONB
    if (owner_member_uid || owner_email) {
      await client.query(`
        UPDATE public.member
        SET own_workspace_uid = (
          SELECT jsonb_agg(DISTINCT elem)
          FROM jsonb_array_elements_text(COALESCE(own_workspace_uid, '[]'::jsonb) || jsonb_build_array($1::text)) as elem
        )
        WHERE member_uid = $2 OR LOWER(member_email) = LOWER($3)
      `, [newWs.workspace_uid, owner_member_uid || null, owner_email || ''])
    }

    await client.query('COMMIT')
    res.status(201).json(newWs)
  } catch (err: any) {
    await client.query('ROLLBACK')
    if (err.code === '23505') {
      return res.status(400).json({ error: `代號「${cleanPrefix}」已存在，請使用不同代號。` })
    }
    console.error('Create workspace error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// PUT /api/workspaces/:uid - 重新命名或更新工作區
workspaceRouter.put('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  const { workspace_name, allow_access_member, owner_member_uid, owner_email } = req.body

  try {
    const result = await pool.query(
      `UPDATE public.workspace
       SET 
         workspace_name = COALESCE($1, workspace_name),
         allow_access_member = COALESCE($2, allow_access_member),
         owner_member_uid = COALESCE($3, owner_member_uid),
         owner_email = COALESCE($4, owner_email)
       WHERE workspace_uid = $5
       RETURNING *`,
      [
        workspace_name ? workspace_name.trim() : null,
        allow_access_member ? JSON.stringify(allow_access_member) : null,
        owner_member_uid || null,
        owner_email ? owner_email.trim().toLowerCase() : null,
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

// POST /api/workspaces/:wsUid/add-member - 將成員加入工作空間 (支援指定角色 Admin / Member)
workspaceRouter.post('/:wsUid/add-member', async (req: Request, res: Response) => {
  const { wsUid } = req.params
  const { member_uid, role_in_this_workspace = 'Member' } = req.body

  if (!member_uid) {
    return res.status(400).json({ error: 'member_uid is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 取得工作區現有成員名單
    const wsRes = await client.query('SELECT allow_access_member FROM public.workspace WHERE workspace_uid = $1', [wsUid])
    if (wsRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Workspace not found' })
    }

    const currentAccess = wsRes.rows[0].allow_access_member || []
    const updatedAccess = currentAccess.filter((m: any) => (typeof m === 'string' ? m : m.member_uid) !== member_uid)
    updatedAccess.push({ member_uid, role_in_this_workspace })

    await client.query(
      'UPDATE public.workspace SET allow_access_member = $1 WHERE workspace_uid = $2',
      [JSON.stringify(updatedAccess), wsUid]
    )

    // 2. 將 { workspace_uid, role } 存入該 member 的 shared_workspace_uid
    const memRes = await client.query('SELECT shared_workspace_uid FROM public.member WHERE member_uid = $1', [member_uid])
    if (memRes.rows.length > 0) {
      const existingSharedWs = memRes.rows[0].shared_workspace_uid || []
      const filtered = existingSharedWs.filter((item: any) => 
        (typeof item === 'string' ? item : item?.workspace_uid) !== wsUid
      )
      filtered.push({ workspace_uid: wsUid, role: role_in_this_workspace })

      await client.query(
        'UPDATE public.member SET shared_workspace_uid = $1, updated_at = CURRENT_TIMESTAMP WHERE member_uid = $2',
        [JSON.stringify(filtered), member_uid]
      )
    }

    await client.query('COMMIT')
    res.json({ message: 'Member added to workspace successfully', workspace_uid: wsUid, member_uid, role: role_in_this_workspace })
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Add workspace member error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// POST /api/workspaces/:wsUid/remove-member/:memberUid - 從工作區除名 (Owner 保護，清除該 member 的 shared_workspace_uid 與 shared_project_uid)
workspaceRouter.post('/:wsUid/remove-member/:memberUid', async (req: Request, res: Response) => {
  const { wsUid, memberUid } = req.params

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 取得工作區與擁有者
    const wsRes = await client.query('SELECT allow_access_member, owner_member_uid, owner_email FROM public.workspace WHERE workspace_uid = $1', [wsUid])
    if (wsRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Workspace not found' })
    }

    const ws = wsRes.rows[0]
    const currentAccess = ws.allow_access_member || []

    // 🚨 安全規則：Owner 不可被移除
    const memRes = await client.query('SELECT member_uid, member_email, shared_workspace_uid, shared_project_uid FROM public.member WHERE member_uid = $1', [memberUid])
    if (memRes.rows.length > 0) {
      const mem = memRes.rows[0]
      if (
        (ws.owner_member_uid && ws.owner_member_uid === memberUid) ||
        (ws.owner_email && mem.member_email && ws.owner_email.toLowerCase() === mem.member_email.toLowerCase())
      ) {
        await client.query('ROLLBACK')
        return res.status(403).json({ error: '安全限制：工作空間擁有者 (Owner) 不能被移除。' })
      }
    }

    const updatedAccess = currentAccess.filter((m: any) => (typeof m === 'string' ? m : m.member_uid) !== memberUid)
    await client.query(
      'UPDATE public.workspace SET allow_access_member = $1 WHERE workspace_uid = $2',
      [JSON.stringify(updatedAccess), wsUid]
    )

    // 2. 找出此工作空間下所有的 projects
    const prjRes = await client.query('SELECT project_uid, allow_access_member FROM public.project WHERE related_workspace_uid = $1', [wsUid])
    const projectUidsToRemove: string[] = []

    for (const row of prjRes.rows) {
      projectUidsToRemove.push(row.project_uid)
      const prjAccess = row.allow_access_member || []
      const nextPrjAccess = prjAccess.filter((m: any) => (typeof m === 'string' ? m : m.member_uid) !== memberUid)
      if (nextPrjAccess.length !== prjAccess.length) {
        await client.query(
          'UPDATE public.project SET allow_access_member = $1 WHERE project_uid = $2',
          [JSON.stringify(nextPrjAccess), row.project_uid]
        )
      }
    }

    // 3. 從 member 的 shared_workspace_uid 移除此 wsUid
    // 4. 從 member 的 shared_project_uid 移除此工作空間的所有 project_uid
    if (memRes.rows.length > 0) {
      const currentSharedWs = (memRes.rows[0].shared_workspace_uid || []).filter((item: any) => 
        (typeof item === 'string' ? item : item?.workspace_uid) !== wsUid
      )
      const currentSharedPrj = (memRes.rows[0].shared_project_uid || []).filter((item: any) => 
        !projectUidsToRemove.includes(typeof item === 'string' ? item : item?.project_uid)
      )

      await client.query(
        'UPDATE public.member SET shared_workspace_uid = $1, shared_project_uid = $2, updated_at = CURRENT_TIMESTAMP WHERE member_uid = $3',
        [JSON.stringify(currentSharedWs), JSON.stringify(currentSharedPrj), memberUid]
      )
    }

    await client.query('COMMIT')
    res.json({ message: 'Member removed from workspace successfully', workspace_uid: wsUid, member_uid: memberUid })
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Remove member from workspace error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

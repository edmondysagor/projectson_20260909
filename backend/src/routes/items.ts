import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const itemRouter = Router()

// GET /api/items - 取得多態項目列表 (支援 workspace_uid, related_project_uid, item_type, item_status, parent_item_uid 篩選)
itemRouter.get('/', async (req: Request, res: Response) => {
  const { workspace_uid, related_project_uid, item_type, item_status, parent_item_uid } = req.query

  try {
    let query = `
      SELECT 
        i.*,
        p.project_name,
        p.project_display_code,
        w.workspace_name,
        w.prefix_code as workspace_prefix,
        mf.member_name as follow_by_name,
        mf.member_email as follow_by_email,
        ma.member_name as assigned_by_name,
        ma.member_email as assigned_by_email,
        parent.item_title as parent_item_title,
        parent.item_display_code as parent_display_code
      FROM public.item i
      JOIN public.project p ON i.related_project_uid = p.project_uid
      JOIN public.workspace w ON i.workspace_uid = w.workspace_uid
      LEFT JOIN public.member mf ON i.item_follow_by = mf.member_uid
      LEFT JOIN public.member ma ON i.item_assigned_by = ma.member_uid
      LEFT JOIN public.item parent ON i.parent_item_uid = parent.item_uid
      WHERE 1=1
    `
    const params: any[] = []

    if (workspace_uid) {
      params.push(workspace_uid)
      query += ` AND i.workspace_uid = $${params.length}`
    }
    if (related_project_uid) {
      params.push(related_project_uid)
      query += ` AND i.related_project_uid = $${params.length}`
    }
    if (item_type) {
      params.push(item_type)
      query += ` AND i.item_type = $${params.length}`
    }
    if (item_status) {
      params.push(item_status)
      query += ` AND i.item_status = $${params.length}`
    }
    if (parent_item_uid) {
      params.push(parent_item_uid)
      query += ` AND i.parent_item_uid = $${params.length}`
    }

    query += ` ORDER BY i.item_number ASC, i.created_at ASC`

    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (err: any) {
    console.error('Fetch items error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/items/:uid - 取得單一項目詳情 (含單向關聯 + 反向被關聯動態解析)
itemRouter.get('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  try {
    const itemRes = await pool.query(
      `SELECT 
        i.*,
        p.project_name,
        p.project_display_code,
        w.workspace_name,
        w.prefix_code as workspace_prefix,
        mf.member_name as follow_by_name,
        mf.member_email as follow_by_email,
        ma.member_name as assigned_by_name,
        ma.member_email as assigned_by_email,
        parent.item_title as parent_item_title,
        parent.item_display_code as parent_display_code
      FROM public.item i
      JOIN public.project p ON i.related_project_uid = p.project_uid
      JOIN public.workspace w ON i.workspace_uid = w.workspace_uid
      LEFT JOIN public.member mf ON i.item_follow_by = mf.member_uid
      LEFT JOIN public.member ma ON i.item_assigned_by = ma.member_uid
      LEFT JOIN public.item parent ON i.parent_item_uid = parent.item_uid
      WHERE i.item_uid = $1`,
      [uid]
    )

    if (itemRes.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }

    const item = itemRes.rows[0]

    // 核心雙向推導: 查詢有誰在 relation_item_uid 中指向了當前 item (例如誰 blocks 緊我 / 誰 deploys 緊我)
    const reverseRelationsRes = await pool.query(
      `SELECT 
        i.item_uid, 
        i.item_display_code, 
        i.item_title, 
        i.item_type,
        i.item_status,
        elem->>'relation' as relation_type
       FROM public.item i,
       jsonb_array_elements(i.relation_item_uid) as elem
       WHERE elem->>'item_uid' = $1`,
      [uid]
    )

    // 格式化反向關係 (Passive Voice Mapping)
    const passiveMapping: Record<string, string> = {
      'blocks': 'is blocked by',
      'covers': 'is covered by',
      'deploys': 'is deployed by',
      'discusses': 'is discussed by',
      'causes': 'is caused by'
    }

    const inverse_relations = reverseRelationsRes.rows.map(r => ({
      item_uid: r.item_uid,
      item_display_code: r.item_display_code,
      item_title: r.item_title,
      item_type: r.item_type,
      item_status: r.item_status,
      relation: passiveMapping[r.relation_type] || `is ${r.relation_type} by`
    }))

    // 查詢子工作項目 (Child work items / Subtasks)
    const childrenRes = await pool.query(
      `SELECT 
        c.item_uid, 
        c.item_display_code, 
        c.item_title, 
        c.item_type, 
        c.item_status, 
        c.item_priority,
        c.item_follow_by,
        m.member_name as follow_by_name
       FROM public.item c
       LEFT JOIN public.member m ON c.item_follow_by = m.member_uid
       WHERE c.parent_item_uid = $1
       ORDER BY c.item_number ASC`,
      [uid]
    )

    res.json({
      ...item,
      inverse_relations,
      child_items: childrenRes.rows
    })
  } catch (err: any) {
    console.error('Get item error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items/batch - 原子批量建立多態項目 (支援 Proposal Canvas 審核後一鍵批次寫入與審計追蹤)
itemRouter.post('/batch', async (req: Request, res: Response) => {
  const { workspace_uid: reqWorkspaceUid, related_project_uid, items } = req.body

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items must be a non-empty array' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 查找 workspace_uid
    let workspace_uid = reqWorkspaceUid
    if (!workspace_uid && related_project_uid) {
      const prjRes = await client.query(
        `SELECT related_workspace_uid FROM public.project WHERE project_uid = $1`,
        [related_project_uid]
      )
      if (prjRes.rows.length > 0) {
        workspace_uid = prjRes.rows[0].related_workspace_uid
      }
    }

    if (!workspace_uid) {
      // 嘗試從第一個 item 的 project 找
      const firstProjUid = items[0]?.related_project_uid || related_project_uid
      if (firstProjUid) {
        const prjRes = await client.query(
          `SELECT related_workspace_uid FROM public.project WHERE project_uid = $1`,
          [firstProjUid]
        )
        if (prjRes.rows.length > 0) {
          workspace_uid = prjRes.rows[0].related_workspace_uid
        }
      }
    }

    if (!workspace_uid) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'workspace_uid or valid related_project_uid is required' })
    }

    // 2. 預查成員名單以供容錯匹配
    const membersRes = await client.query(`SELECT member_uid, member_name, member_email FROM public.member`)
    const memberMap = new Map<string, string>()
    membersRes.rows.forEach(m => {
      memberMap.set(m.member_uid.toLowerCase(), m.member_uid)
      memberMap.set(m.member_name.toLowerCase().trim(), m.member_uid)
      memberMap.set(m.member_email.toLowerCase().trim(), m.member_uid)
    })

    const resolveMember = (val?: string) => {
      if (!val) return null
      const clean = val.replace(/[*`[\]"']/g, '').trim().toLowerCase()
      return memberMap.get(clean) || null
    }

    // 3. 預查工單名單以供 parent_item_uid 匹配
    const itemsRes = await client.query(`SELECT item_uid, item_display_code FROM public.item WHERE workspace_uid = $1`, [workspace_uid])
    const itemCodeMap = new Map<string, string>()
    itemsRes.rows.forEach(i => {
      itemCodeMap.set(i.item_uid.toLowerCase(), i.item_uid)
      itemCodeMap.set(i.item_display_code.toLowerCase().trim(), i.item_uid)
    })

    const resolveParent = (val?: string) => {
      if (!val) return null
      const clean = val.replace(/[*`[\]"']/g, '').trim().toLowerCase()
      return itemCodeMap.get(clean) || null
    }

    // 4. 原子鎖定更新 workspace 流水號
    const count = items.length
    const wsRes = await client.query(
      `UPDATE public.workspace
       SET last_item_number = last_item_number + $1
       WHERE workspace_uid = $2
       RETURNING prefix_code, last_item_number`,
      [count, workspace_uid]
    )

    if (wsRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Workspace not found' })
    }

    const { prefix_code, last_item_number } = wsRes.rows[0]
    const startNumber = last_item_number - count + 1

    // 5. 批次寫入項目
    const insertedRows: any[] = []
    const nowIso = new Date().toISOString()

    for (let i = 0; i < count; i++) {
      const item = items[i]
      const itemNum = startNumber + i
      const displayCode = `${prefix_code}-${itemNum}`
      const targetProjUid = item.related_project_uid || related_project_uid

      if (!targetProjUid) {
        throw new Error(`Item at index ${i} is missing related_project_uid`)
      }

      const followByUid = resolveMember(item.item_follow_by)
      const assignedByUid = resolveMember(item.item_assigned_by)
      const parentUid = resolveParent(item.parent_item_uid)

      // 自動產生審計紀錄 Audit Trail
      const auditRemark = item.audit_remark || `🤖 [AI Copilot 批量生成記錄]：依據需求提案批次建立工單 [${displayCode}]。`
      const initialComments = [
        {
          comment_id: `cmt_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
          author_name: '🤖 AI Copilot (Audit)',
          author_email: 'copilot@projectson.local',
          comment_text: auditRemark,
          created_at: nowIso
        }
      ]

      const insertRes = await client.query(
        `INSERT INTO public.item (
          item_display_code,
          prefix_code,
          item_number,
          item_title,
          related_project_uid,
          workspace_uid,
          item_type,
          item_status,
          item_priority,
          item_planned_start_date,
          item_planned_end_date,
          item_follow_by,
          item_assigned_by,
          item_content,
          parent_item_uid,
          relation_item_uid,
          item_attribute,
          item_comment
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`,
        [
          displayCode,
          prefix_code,
          itemNum,
          (item.item_title || '未命名任務').trim(),
          targetProjUid,
          workspace_uid,
          item.item_type || 'Task',
          item.item_status || 'Not Start',
          item.item_priority || 'Middle',
          item.item_planned_start_date || null,
          item.item_planned_end_date || null,
          followByUid,
          assignedByUid,
          JSON.stringify(item.item_content || {}),
          parentUid,
          JSON.stringify(item.relation_item_uid || []),
          JSON.stringify(item.item_attribute || {}),
          JSON.stringify(initialComments)
        ]
      )

      insertedRows.push(insertRes.rows[0])
    }

    await client.query('COMMIT')
    res.status(201).json({
      message: `Successfully batch created ${insertedRows.length} items`,
      items: insertedRows
    })
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Batch create items error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// POST /api/items - 建立新多態項目 (原子自增流水號並生成 PREFIX-X)
itemRouter.post('/', async (req: Request, res: Response) => {
  const {
    item_title,
    related_project_uid,
    item_type = 'Task',
    item_status = 'Not Start',
    item_priority = 'Middle',
    item_planned_start_date,
    item_planned_end_date,
    item_follow_by,
    item_assigned_by,
    item_content,
    parent_item_uid,
    relation_item_uid,
    item_attribute
  } = req.body

  if (!item_title || !related_project_uid) {
    return res.status(400).json({ error: 'item_title and related_project_uid are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 查找該專案所屬的 workspace_uid
    const prjRes = await client.query(
      `SELECT related_workspace_uid FROM public.project WHERE project_uid = $1`,
      [related_project_uid]
    )
    if (prjRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Related project not found' })
    }
    const workspace_uid = prjRes.rows[0].related_workspace_uid

    // 2. 原子遞增獲取 item_number (行級排他鎖，徹底保證序號嚴格遞增不重複)
    const wsRes = await client.query(
      `UPDATE public.workspace
       SET last_item_number = last_item_number + 1
       WHERE workspace_uid = $1
       RETURNING prefix_code, last_item_number`,
      [workspace_uid]
    )
    const { prefix_code, last_item_number } = wsRes.rows[0]
    const item_display_code = `${prefix_code}-${last_item_number}`

    // 3. 寫入 Item 主表
    const insertRes = await client.query(
      `INSERT INTO public.item (
        item_display_code,
        prefix_code,
        item_number,
        item_title,
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_planned_start_date,
        item_planned_end_date,
        item_follow_by,
        item_assigned_by,
        item_content,
        parent_item_uid,
        relation_item_uid,
        item_attribute
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        item_display_code,
        prefix_code,
        last_item_number,
        item_title.trim(),
        related_project_uid,
        workspace_uid,
        item_type,
        item_status,
        item_priority,
        item_planned_start_date || null,
        item_planned_end_date || null,
        item_follow_by || null,
        item_assigned_by || null,
        JSON.stringify(item_content || {}),
        parent_item_uid || null,
        JSON.stringify(relation_item_uid || []),
        JSON.stringify(item_attribute || {})
      ]
    )

    await client.query('COMMIT')
    res.status(201).json(insertRes.rows[0])
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Create item error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// PATCH /api/items/:uid - 就地局部更新項目 (支援 Inline Editing：狀態、標題、排期、負責人、拖放變更父級)
itemRouter.patch('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  const updates = req.body

  const allowedFields = [
    'item_title',
    'item_type',
    'item_status',
    'item_priority',
    'item_planned_start_date',
    'item_planned_end_date',
    'item_actual_start_date',
    'item_actual_end_date',
    'item_follow_by',
    'item_assigned_by',
    'item_content',
    'parent_item_uid',
    'relation_item_uid',
    'item_attribute',
    'item_comment'
  ]

  // 1. 深度清理與容錯解析 item_follow_by
  if (updates.item_follow_by !== undefined) {
    if (!updates.item_follow_by) {
      updates.item_follow_by = null
    } else if (typeof updates.item_follow_by === 'string') {
      const cleanFollow = updates.item_follow_by.replace(/[*`[\]"']/g, '').trim()
      const isMemberUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanFollow)
      if (isMemberUuid) {
        updates.item_follow_by = cleanFollow
      } else {
        const memberRes = await pool.query(
          `SELECT member_uid FROM public.member WHERE LOWER(member_name) LIKE LOWER($1) OR LOWER(member_email) LIKE LOWER($1) LIMIT 1`,
          [`%${cleanFollow}%`]
        )
        if (memberRes.rows.length > 0) {
          updates.item_follow_by = memberRes.rows[0].member_uid
        } else {
          // 若找不到匹配成員，避免向 PostgreSQL UUID 欄位寫入非 UUID 字串而崩潰
          delete updates.item_follow_by
        }
      }
    }
  }

  // 2. 深度清理與容錯解析 item_assigned_by
  if (updates.item_assigned_by !== undefined) {
    if (!updates.item_assigned_by) {
      updates.item_assigned_by = null
    } else if (typeof updates.item_assigned_by === 'string') {
      const cleanAssign = updates.item_assigned_by.replace(/[*`[\]"']/g, '').trim()
      const isMemberUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanAssign)
      if (isMemberUuid) {
        updates.item_assigned_by = cleanAssign
      } else {
        const memberRes = await pool.query(
          `SELECT member_uid FROM public.member WHERE LOWER(member_name) LIKE LOWER($1) OR LOWER(member_email) LIKE LOWER($1) LIMIT 1`,
          [`%${cleanAssign}%`]
        )
        if (memberRes.rows.length > 0) {
          updates.item_assigned_by = memberRes.rows[0].member_uid
        } else {
          delete updates.item_assigned_by
        }
      }
    }
  }

  // 3. 深度清理與容錯解析 parent_item_uid
  if (updates.parent_item_uid !== undefined) {
    if (!updates.parent_item_uid) {
      updates.parent_item_uid = null
    } else if (typeof updates.parent_item_uid === 'string') {
      const cleanParent = updates.parent_item_uid.replace(/[*`[\]"']/g, '').trim()
      const isParentUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanParent)
      if (isParentUuid) {
        updates.parent_item_uid = cleanParent
      } else {
        const parentRes = await pool.query(
          `SELECT item_uid FROM public.item WHERE item_display_code ILIKE $1 LIMIT 1`,
          [cleanParent]
        )
        if (parentRes.rows.length > 0) {
          updates.parent_item_uid = parentRes.rows[0].item_uid
        } else {
          delete updates.parent_item_uid
        }
      }
    }
  }

  const setClauses: string[] = []
  const values: any[] = []

  Object.keys(updates).forEach((key) => {
    if (allowedFields.includes(key)) {
      const isJson = ['item_content', 'relation_item_uid', 'item_attribute', 'item_comment'].includes(key)
      values.push(isJson ? JSON.stringify(updates[key]) : updates[key])
      setClauses.push(`${key} = $${values.length}`)
    }
  })

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided for update' })
  }

  // 同時支援 UUID 與 Display Code (例如 TTG-12)，自動清除 Markdown 標記
  const uidStr = String(uid).replace(/[*`[\]"']/g, '').trim()
  const isTargetUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uidStr)
  values.push(uidStr)
  const whereClause = isTargetUuid ? `item_uid = $${values.length}` : `item_display_code ILIKE $${values.length}`

  const query = `
    UPDATE public.item
    SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE ${whereClause}
    RETURNING *
  `

  try {
    const result = await pool.query(query, values)
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }
    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Update item error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/items/:uid/comments - 新增 Jira 式評論
itemRouter.post('/:uid/comments', async (req: Request, res: Response) => {
  const { uid } = req.params
  const { author_name, author_email, comment_text, author_uid } = req.body

  if (!comment_text) {
    return res.status(400).json({ error: 'comment_text is required' })
  }

  const newComment = {
    comment_id: `cmt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    author_name: author_name || 'Anonymous',
    author_email: author_email || '',
    author_uid: author_uid || null,
    comment_text,
    created_at: new Date().toISOString()
  }

  try {
    const result = await pool.query(
      `UPDATE public.item
       SET item_comment = item_comment || $1::jsonb
       WHERE item_uid = $2
       RETURNING item_comment`,
      [JSON.stringify([newComment]), uid]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }

    res.status(201).json(result.rows[0].item_comment)
  } catch (err: any) {
    console.error('Add comment error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/items/:uid - 刪除項目
itemRouter.delete('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  try {
    const result = await pool.query(
      `DELETE FROM public.item WHERE item_uid = $1 RETURNING item_uid`,
      [uid]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' })
    }
    res.json({ message: 'Item deleted successfully', item_uid: uid })
  } catch (err: any) {
    console.error('Delete item error:', err)
    res.status(500).json({ error: err.message })
  }
})

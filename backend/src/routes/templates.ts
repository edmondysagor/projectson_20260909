import { Router, Request, Response } from 'express'
import { pool } from '../db.js'

export const templateRouter = Router()

// GET /api/templates - 取得所有範本列表
templateRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query(
      `SELECT * FROM public.template ORDER BY created_at ASC`
    )
    res.json(result.rows)
  } catch (err: any) {
    console.error('Fetch templates error:', err)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/templates/:uid - 取得單一範本
templateRouter.get('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  try {
    const result = await pool.query(
      `SELECT * FROM public.template WHERE template_uid = $1`,
      [uid]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }
    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Get template error:', err)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/templates - 建立新範本
templateRouter.post('/', async (req: Request, res: Response) => {
  const { template_name, template_schema = [], member_uid = null } = req.body

  if (!template_name || !template_name.trim()) {
    return res.status(400).json({ error: 'template_name is required' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO public.template (template_name, template_schema, member_uid)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [template_name.trim(), JSON.stringify(template_schema), member_uid]
    )
    res.status(201).json(result.rows[0])
  } catch (err: any) {
    console.error('Create template error:', err)
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/templates/:uid - 更新範本
templateRouter.put('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  const { template_name, template_schema, member_uid } = req.body

  if (!template_name || !template_name.trim()) {
    return res.status(400).json({ error: 'template_name is required' })
  }

  try {
    const result = await pool.query(
      `UPDATE public.template
       SET template_name = $1,
           template_schema = COALESCE($2, template_schema),
           member_uid = COALESCE($3, member_uid),
           updated_at = NOW()
       WHERE template_uid = $4
       RETURNING *`,
      [template_name.trim(), template_schema ? JSON.stringify(template_schema) : null, member_uid, uid]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }

    res.json(result.rows[0])
  } catch (err: any) {
    console.error('Update template error:', err)
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/templates/:uid - 刪除範本
templateRouter.delete('/:uid', async (req: Request, res: Response) => {
  const { uid } = req.params
  try {
    const result = await pool.query(
      `DELETE FROM public.template WHERE template_uid = $1 RETURNING template_uid`,
      [uid]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' })
    }
    res.json({ message: 'Template deleted successfully' })
  } catch (err: any) {
    console.error('Delete template error:', err)
    res.status(500).json({ error: err.message })
  }
})

interface TemplateNode {
  id?: string
  item_type?: string
  item_title?: string
  item_content?: any
  children?: TemplateNode[]
}

// POST /api/templates/:uid/apply - 將範本套用至指定專案
templateRouter.post('/:uid/apply', async (req: Request, res: Response) => {
  const { uid } = req.params
  const { project_uid } = req.body

  if (!project_uid) {
    return res.status(400).json({ error: 'project_uid is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // 1. 取得範本資料
    const tplRes = await client.query(
      `SELECT * FROM public.template WHERE template_uid = $1`,
      [uid]
    )
    if (tplRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Template not found' })
    }
    const template = tplRes.rows[0]
    let schema: TemplateNode[] = []
    if (Array.isArray(template.template_schema)) {
      schema = template.template_schema
    } else if (typeof template.template_schema === 'string') {
      try {
        schema = JSON.parse(template.template_schema)
      } catch (e) {
        schema = []
      }
    }

    // 2. 取得目標專案及其所屬 workspace
    const prjRes = await client.query(
      `SELECT project_uid, related_workspace_uid FROM public.project WHERE project_uid = $1`,
      [project_uid]
    )
    if (prjRes.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Target project not found' })
    }
    const workspace_uid = prjRes.rows[0].related_workspace_uid

    const createdItems: any[] = []

    // 遞迴插入節點函式
    const insertNode = async (node: TemplateNode, parentUid: string | null = null) => {
      // 原子自增獲取 item_number
      const wsRes = await client.query(
        `UPDATE public.workspace
         SET last_item_number = last_item_number + 1
         WHERE workspace_uid = $1
         RETURNING prefix_code, last_item_number`,
        [workspace_uid]
      )
      const { prefix_code, last_item_number } = wsRes.rows[0]
      const item_display_code = `${prefix_code}-${last_item_number}`

      const title = (node.item_title && node.item_title.trim()) || 'Untitled Item'
      const itemType = node.item_type || 'Task'
      const itemContent = node.item_content || {}

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
          item_content,
          parent_item_uid,
          relation_item_uid,
          item_attribute
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *`,
        [
          item_display_code,
          prefix_code,
          last_item_number,
          title,
          project_uid,
          workspace_uid,
          itemType,
          'Not Start',
          'Middle',
          JSON.stringify(itemContent),
          parentUid,
          '[]',
          '{}'
        ]
      )
      const inserted = insertRes.rows[0]
      createdItems.push(inserted)

      // 遞迴插入子節點
      if (Array.isArray(node.children) && node.children.length > 0) {
        for (const child of node.children) {
          await insertNode(child, inserted.item_uid)
        }
      }
    }

    // 依序處理 Schema 中所有根節點
    for (const rootNode of schema) {
      await insertNode(rootNode, null)
    }

    await client.query('COMMIT')
    res.status(201).json({
      message: 'Template applied successfully',
      created_count: createdItems.length,
      items: createdItems
    })
  } catch (err: any) {
    await client.query('ROLLBACK')
    console.error('Apply template error:', err)
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

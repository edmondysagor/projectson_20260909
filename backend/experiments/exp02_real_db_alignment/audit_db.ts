import { pool } from '../../src/db'

async function auditDatabase() {
  const client = await pool.connect()
  try {
    console.log('--- PROJECTS IN DATABASE ---')
    const projectsRes = await client.query(`
      SELECT project_uid, project_name, project_display_code, project_type, project_status, created_at, updated_at
      FROM public.project
      ORDER BY created_at DESC
    `)
    console.log(JSON.stringify(projectsRes.rows, null, 2))

    for (const prj of projectsRes.rows) {
      console.log(`\n--- ITEMS FOR PROJECT: ${prj.project_name} (${prj.project_display_code} / ${prj.project_uid}) ---`)
      const itemsRes = await client.query(`
        SELECT 
          i.item_uid,
          i.item_display_code,
          i.prefix_code,
          i.item_number,
          i.item_title,
          i.item_type,
          i.item_status,
          i.item_priority,
          i.item_planned_start_date,
          i.item_planned_end_date,
          i.item_actual_start_date,
          i.item_actual_end_date,
          i.parent_item_uid,
          i.relation_item_uid,
          i.item_content,
          i.item_attribute,
          i.item_follow_by,
          m.member_name as follow_by_name,
          i.item_assigned_by,
          i.created_at,
          i.updated_at
        FROM public.item i
        LEFT JOIN public.member m ON i.item_follow_by = m.member_uid
        WHERE i.related_project_uid = $1
        ORDER BY i.item_number ASC, i.created_at ASC
      `, [prj.project_uid])

      console.log(`Item Count: ${itemsRes.rows.length}`)
      console.log(JSON.stringify(itemsRes.rows, null, 2))
    }
  } finally {
    client.release()
    await pool.end()
  }
}

auditDatabase().catch(err => {
  console.error('Audit failed:', err)
  process.exit(1)
})

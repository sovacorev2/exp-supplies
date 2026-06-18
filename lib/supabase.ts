import { neon } from '@neondatabase/serverless'

// ── DB client ──────────────────────────────────────────────────────────
// Uses DATABASE_URL from your Neon project (Settings → Connection string)
function getDb() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL environment variable is not set')
  return neon(url)
}

// ── Types ──────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox'

export interface FormField {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  options?: string[]
}

export interface Form {
  id: string
  name: string
  description: string | null
  category: string
  fields: FormField[]
  is_active: boolean
  slug: string
  created_at: string
  updated_at: string
}

export interface Submission {
  id: string
  form_id: string
  data: Record<string, string>
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  created_at: string
  updated_at: string
  forms?: Pick<Form, 'name' | 'category' | 'slug'>
}

// ── Forms API ──────────────────────────────────────────────────────────

export async function getForms(): Promise<Form[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM forms ORDER BY created_at DESC
  `
  return rows.map(normalizeForm)
}

export async function getFormBySlug(slug: string): Promise<Form> {
  const sql = getDb()
  const rows = await sql`
    SELECT * FROM forms WHERE slug = ${slug} AND is_active = true LIMIT 1
  `
  if (!rows[0]) throw new Error('Form not found')
  return normalizeForm(rows[0])
}

export async function createForm(
  form: Omit<Form, 'id' | 'created_at' | 'updated_at'>
): Promise<Form> {
  const sql = getDb()
  const rows = await sql`
    INSERT INTO forms (name, description, category, fields, is_active, slug)
    VALUES (
      ${form.name},
      ${form.description ?? null},
      ${form.category},
      ${JSON.stringify(form.fields)},
      ${form.is_active},
      ${form.slug}
    )
    RETURNING *
  `
  return normalizeForm(rows[0])
}

export async function updateForm(id: string, updates: Partial<Form>): Promise<Form> {
  const sql = getDb()
  const rows = await sql`
    UPDATE forms SET
      name        = COALESCE(${updates.name ?? null}, name),
      description = COALESCE(${updates.description ?? null}, description),
      category    = COALESCE(${updates.category ?? null}, category),
      fields      = COALESCE(${updates.fields ? JSON.stringify(updates.fields) : null}::jsonb, fields),
      is_active   = COALESCE(${updates.is_active ?? null}, is_active),
      updated_at  = now()
    WHERE id = ${id}
    RETURNING *
  `
  return normalizeForm(rows[0])
}

export async function deleteForm(id: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM forms WHERE id = ${id}`
}

export async function toggleFormActive(id: string, is_active: boolean): Promise<void> {
  const sql = getDb()
  await sql`UPDATE forms SET is_active = ${is_active}, updated_at = now() WHERE id = ${id}`
}

// ── Submissions API ────────────────────────────────────────────────────

export async function getSubmissions(filters?: {
  form_id?: string
  status?: string
  category?: string
}): Promise<Submission[]> {
  const sql = getDb()
  const rows = await sql`
    SELECT
      s.*,
      f.name   AS form_name,
      f.category AS form_category,
      f.slug   AS form_slug
    FROM submissions s
    LEFT JOIN forms f ON f.id = s.form_id
    ORDER BY s.created_at DESC
  `

  let result = rows.map(normalizeSubmission)

  if (filters?.form_id) result = result.filter(s => s.form_id === filters.form_id)
  if (filters?.status)  result = result.filter(s => s.status  === filters.status)
  if (filters?.category) result = result.filter(s => s.forms?.category === filters.category)

  return result
}

export async function createSubmission(
  formId: string,
  data: Record<string, string>
): Promise<void> {
  const sql = getDb()
  await sql`
    INSERT INTO submissions (form_id, data, status)
    VALUES (${formId}, ${JSON.stringify(data)}, 'pending')
  `
}

export async function updateSubmissionStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  notes?: string
): Promise<Submission> {
  const sql = getDb()
  const rows = await sql`
    UPDATE submissions
    SET status = ${status},
        notes  = COALESCE(${notes ?? null}, notes),
        updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `
  return normalizeSubmission(rows[0])
}

export async function deleteSubmission(id: string): Promise<void> {
  const sql = getDb()
  await sql`DELETE FROM submissions WHERE id = ${id}`
}

// ── Dashboard stats ────────────────────────────────────────────────────

export async function getDashboardStats() {
  const sql = getDb()

  const [formRows, subRows] = await Promise.all([
    sql`SELECT id, category, is_active FROM forms`,
    sql`
      SELECT s.id, s.status, f.category AS form_category
      FROM submissions s
      LEFT JOIN forms f ON f.id = s.form_id
    `,
  ])

  const categoryCounts: Record<string, number> = {}
  subRows.forEach((s: Record<string, unknown>) => {
    const cat = (s.form_category as string) || 'Unknown'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  })

  return {
    totalForms:       formRows.length,
    activeForms:      formRows.filter((f: Record<string, unknown>) => f.is_active).length,
    totalSubmissions: subRows.length,
    pending:          subRows.filter((s: Record<string, unknown>) => s.status === 'pending').length,
    approved:         subRows.filter((s: Record<string, unknown>) => s.status === 'approved').length,
    rejected:         subRows.filter((s: Record<string, unknown>) => s.status === 'rejected').length,
    categoryCounts,
  }
}

// ── Slug helper ────────────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') +
    '-' +
    Math.random().toString(36).slice(2, 7)
  )
}

// ── Row normalisers ────────────────────────────────────────────────────

function normalizeForm(row: Record<string, unknown>): Form {
  return {
    id:          row.id as string,
    name:        row.name as string,
    description: (row.description as string | null) ?? null,
    category:    row.category as string,
    fields:      typeof row.fields === 'string'
                   ? JSON.parse(row.fields)
                   : (row.fields as FormField[]) ?? [],
    is_active:   row.is_active as boolean,
    slug:        row.slug as string,
    created_at:  row.created_at as string,
    updated_at:  row.updated_at as string,
  }
}

function normalizeSubmission(row: Record<string, unknown>): Submission {
  return {
    id:         row.id as string,
    form_id:    row.form_id as string,
    data:       typeof row.data === 'string'
                  ? JSON.parse(row.data)
                  : (row.data as Record<string, string>) ?? {},
    status:     row.status as 'pending' | 'approved' | 'rejected',
    notes:      (row.notes as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    forms: row.form_name
      ? {
          name:     row.form_name as string,
          category: row.form_category as string,
          slug:     row.form_slug as string,
        }
      : undefined,
  }
}

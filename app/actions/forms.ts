'use server'

import { db } from '@/lib/db'
import { forms, submissions } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'

export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date' | 'checkbox' | 'upload'

export interface DropdownOption {
  label: string
  suboptions?: string[]
}

export interface FormField {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  options?: (string | DropdownOption)[]
  hasSuboptions?: boolean
  suboptionsRequired?: boolean
  section?: string
  dependsOn?: {
    fieldLabel: string
    triggerValue: string
  }
  acceptedFileTypes?: string[]
}

export interface Form {
  id: string
  name: string
  description: string | null
  category: string
  fields: FormField[]
  is_active: boolean
  slug: string
  created_at: Date
  updated_at: Date
}

export interface Submission {
  id: string
  form_id: string
  data: Record<string, string>
  status: 'pending' | 'approved' | 'rejected'
  notes: string | null
  created_at: Date
  updated_at: Date
  forms?: Pick<Form, 'name' | 'category' | 'slug'>
}

// ── Forms API ──────────────────────────────────────────────────────────

export async function getForms(): Promise<Form[]> {
  const rows = await db.select().from(forms).orderBy(desc(forms.created_at))
  return rows.map(row => ({
    ...row,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || [],
  }))
}

export async function getFormBySlug(slug: string): Promise<Form> {
  const rows = await db
    .select()
    .from(forms)
    .where(eq(forms.slug, slug))
    .limit(1)

  if (!rows[0]) throw new Error('Form not found')
  
  const row = rows[0]
  return {
    ...row,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || [],
  }
}

export async function createForm(
  form: Omit<Form, 'id' | 'created_at' | 'updated_at'>
): Promise<Form> {
  const rows = await db
    .insert(forms)
    .values({
      name: form.name,
      description: form.description ?? null,
      category: form.category,
      fields: form.fields as unknown as any,
      is_active: form.is_active,
      slug: form.slug,
    })
    .returning()

  const row = rows[0]
  return {
    ...row,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || [],
  }
}

export async function updateForm(id: string, updates: Partial<Form>): Promise<Form> {
  const updateData: Record<string, any> = {}
  
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.description !== undefined) updateData.description = updates.description ?? null
  if (updates.category !== undefined) updateData.category = updates.category
  if (updates.fields !== undefined) updateData.fields = updates.fields
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active

  const rows = await db
    .update(forms)
    .set(updateData)
    .where(eq(forms.id, id))
    .returning()

  const row = rows[0]
  return {
    ...row,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || [],
  }
}

export async function deleteForm(id: string): Promise<void> {
  await db.delete(forms).where(eq(forms.id, id))
}

export async function toggleFormActive(id: string, is_active: boolean): Promise<void> {
  await db.update(forms).set({ is_active }).where(eq(forms.id, id))
}

// ── Submissions API ────────────────────────────────────────────────────

export async function getSubmissions(): Promise<Submission[]> {
  const rows = await db
    .select()
    .from(submissions)
    .leftJoin(forms, eq(submissions.form_id, forms.id))
    .orderBy(desc(submissions.created_at))

  return rows.map((row: any) => {
    const submission = row.submissions
    const form = row.forms
    return {
      id: submission.id,
      form_id: submission.form_id,
      data: typeof submission.data === 'string' ? JSON.parse(submission.data) : submission.data || {},
      status: submission.status as 'pending' | 'approved' | 'rejected',
      notes: submission.notes,
      created_at: submission.created_at,
      updated_at: submission.updated_at,
      forms: form ? {
        name: form.name,
        category: form.category,
        slug: form.slug,
      } : undefined,
    }
  })
}

export async function createSubmission(
  formId: string,
  data: Record<string, string>
): Promise<void> {
  await db.insert(submissions).values({
    form_id: formId,
    data: data as unknown as any,
    status: 'pending',
  })
}

export async function updateSubmissionStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  notes?: string
): Promise<Submission> {
  const rows = await db
    .update(submissions)
    .set({
      status,
      notes: notes ?? null,
    })
    .where(eq(submissions.id, id))
    .returning()

  const row = rows[0]
  return {
    ...row,
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {},
    status: row.status as 'pending' | 'approved' | 'rejected',
  }
}

export async function deleteSubmission(id: string): Promise<void> {
  await db.delete(submissions).where(eq(submissions.id, id))
}

// ── Dashboard stats ────────────────────────────────────────────────────

export async function getDashboardStats() {
  const allForms = await db.select().from(forms)
  const allSubmissions = await db.select().from(submissions)

  const categoryCounts: Record<string, number> = {}
  
  allForms.forEach(form => {
    categoryCounts[form.category] = (categoryCounts[form.category] || 0) + 1
  })

  return {
    totalForms: allForms.length,
    activeForms: allForms.filter(f => f.is_active).length,
    totalSubmissions: allSubmissions.length,
    pending: allSubmissions.filter(s => s.status === 'pending').length,
    approved: allSubmissions.filter(s => s.status === 'approved').length,
    rejected: allSubmissions.filter(s => s.status === 'rejected').length,
    categoryCounts,
  }
}



'use server'

import { db } from '@/lib/db'
import { forms, submissions, shareTokens, analyticsTokens, invitees } from '@/lib/db/schema'
import { eq, desc, ne, and, or } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { requireUser, ForbiddenError, type CurrentUser } from '@/lib/auth-helpers'
import { sendEmail } from '@/lib/email'

export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date' | 'checkbox' | 'upload' | 'rating' | 'matrix'

export interface DropdownOption {
  label: string
  suboptions?: string[]
}

export interface ConditionalRule {
  fieldLabel: string
  operator: '===' | '!==' | '>' | '<' | '>=' | '<=' | 'contains' | 'not-contains'
  triggerValue: string | number
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
  // Constraints for field types
  minValue?: number
  maxValue?: number
  minLength?: number
  maxLength?: number
  // Conditional logic (supports multiple conditions with AND logic)
  dependsOn?: ConditionalRule | ConditionalRule[]
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
  user_id: string | null
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

export interface Draft {
  data: Record<string, string>
  expiresAt: Date | null
  status: 'draft' | 'pending'
}

export interface Invitee {
  id: string
  name: string
  email: string
  token: string
  status: 'not_opened' | 'opened' | 'submitted'
  created_at: Date
  last_reminded_at: Date | null
}

// ── Ownership helpers ──────────────────────────────────────────────────

async function getOwnedForm(id: string, currentUser: CurrentUser) {
  const rows = await db.select().from(forms).where(eq(forms.id, id)).limit(1)
  const row = rows[0] as any
  if (!row) throw new Error('Form not found')
  if (currentUser.role !== 'admin' && row.user_id !== currentUser.id) throw new ForbiddenError()
  return row
}

async function getOwnedInvitee(id: string, currentUser: CurrentUser) {
  const rows = await db.select().from(invitees).where(eq(invitees.id, id)).limit(1)
  const row = rows[0] as any
  if (!row) throw new Error('Invitee not found')
  await getOwnedForm(row.form_id, currentUser)
  return row
}

async function getOwnedSubmission(id: string, currentUser: CurrentUser) {
  const rows = await db
    .select()
    .from(submissions)
    .leftJoin(forms, eq(submissions.form_id, forms.id))
    .where(eq(submissions.id, id))
    .limit(1)
  const row = rows[0] as any
  if (!row) throw new Error('Submission not found')
  if (currentUser.role !== 'admin' && row.forms?.user_id !== currentUser.id) throw new ForbiddenError()
  return row
}

// ── Forms API ──────────────────────────────────────────────────────────

export async function getForms(): Promise<Form[]> {
  const currentUser = await requireUser()
  const rows =
    currentUser.role === 'admin'
      ? await db.select().from(forms).orderBy(desc(forms.created_at))
      : await db
          .select()
          .from(forms)
          .where(eq(forms.user_id, currentUser.id))
          .orderBy(desc(forms.created_at))

  return rows.map((row: any) => ({
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

  const row = rows[0] as any
  return {
    ...row,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || [],
  }
}

export async function createForm(
  form: Omit<Form, 'id' | 'created_at' | 'updated_at' | 'user_id'>
): Promise<Form> {
  const currentUser = await requireUser()
  const rows = await db
    .insert(forms)
    .values({
      name: form.name,
      description: form.description ?? null,
      category: form.category,
      fields: form.fields as unknown as any,
      is_active: form.is_active,
      slug: form.slug,
      user_id: currentUser.id,
    })
    .returning()

  const row = rows[0] as any
  return {
    ...row,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || [],
  }
}

export async function updateForm(id: string, updates: Partial<Form>): Promise<Form> {
  const currentUser = await requireUser()
  await getOwnedForm(id, currentUser)

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

  const row = rows[0] as any
  return {
    ...row,
    fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields || [],
  }
}

export async function deleteForm(id: string): Promise<void> {
  const currentUser = await requireUser()
  await getOwnedForm(id, currentUser)
  // Delete all submissions for this form first
  await db.delete(submissions).where(eq(submissions.form_id, id))
  await db.delete(forms).where(eq(forms.id, id))
}

export async function toggleFormActive(id: string, is_active: boolean): Promise<void> {
  const currentUser = await requireUser()
  await getOwnedForm(id, currentUser)
  await db.update(forms).set({ is_active }).where(eq(forms.id, id))
}

// ── Submissions API ────────────────────────────────────────────────────

export async function getSubmissions(): Promise<Submission[]> {
  const currentUser = await requireUser()
  const rows =
    currentUser.role === 'admin'
      ? await db
          .select()
          .from(submissions)
          .leftJoin(forms, eq(submissions.form_id, forms.id))
          .where(ne(submissions.status, 'draft'))
          .orderBy(desc(submissions.created_at))
      : await db
          .select()
          .from(submissions)
          .leftJoin(forms, eq(submissions.form_id, forms.id))
          .where(and(eq(forms.user_id, currentUser.id), ne(submissions.status, 'draft')))
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
  data: Record<string, string>,
  resumeToken?: string,
  inviteeId?: string
): Promise<{ resumeToken: string } | { error: 'locked' }> {
  if (resumeToken) {
    const rows = await db
      .update(submissions)
      .set({
        data: data as unknown as any,
        status: 'pending',
        expires_at: null,
        ...(inviteeId ? { invitee_id: inviteeId } : {}),
      })
      .where(and(
        eq(submissions.resume_token, resumeToken),
        eq(submissions.form_id, formId),
        or(eq(submissions.status, 'draft'), eq(submissions.status, 'pending'))
      ))
      .returning({ resume_token: submissions.resume_token })
    if (rows.length) return { resumeToken: rows[0].resume_token as string }

    // Token didn't match a draft/pending row — check whether it belongs to
    // an already-reviewed submission (admin approved/rejected mid-edit).
    const existing = await db
      .select({ status: submissions.status })
      .from(submissions)
      .where(and(eq(submissions.resume_token, resumeToken), eq(submissions.form_id, formId)))
      .limit(1)
    if (existing.length && (existing[0].status === 'approved' || existing[0].status === 'rejected')) {
      return { error: 'locked' }
    }
    // otherwise: stale/foreign token — fall through, mint a fresh submission
  }

  const token = randomBytes(16).toString('hex')
  await db.insert(submissions).values({
    form_id: formId,
    data: data as unknown as any,
    status: 'pending',
    resume_token: token,
    ...(inviteeId ? { invitee_id: inviteeId } : {}),
  })
  return { resumeToken: token }
}

// ── Draft submissions (save & resume later) ───────────────────────────

export async function saveDraft(
  formId: string,
  data: Record<string, string>,
  resumeToken?: string,
  inviteeId?: string
): Promise<{ resumeToken: string; expiresAt: Date }> {
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  if (resumeToken) {
    const rows = await db
      .update(submissions)
      .set({
        data: data as unknown as any,
        expires_at: expiresAt,
        ...(inviteeId ? { invitee_id: inviteeId } : {}),
      })
      .where(and(
        eq(submissions.resume_token, resumeToken),
        eq(submissions.form_id, formId),
        eq(submissions.status, 'draft')
      ))
      .returning({ id: submissions.id })

    if (rows.length) return { resumeToken, expiresAt }
    // token stale/expired/already converted elsewhere — fall through, mint a fresh draft
  }

  const token = randomBytes(16).toString('hex')
  await db.insert(submissions).values({
    form_id: formId,
    data: data as unknown as any,
    status: 'draft',
    resume_token: token,
    expires_at: expiresAt,
    ...(inviteeId ? { invitee_id: inviteeId } : {}),
  })
  return { resumeToken: token, expiresAt }
}

export async function getDraft(
  formId: string,
  resumeToken: string
): Promise<Draft | { error: 'invalid' | 'expired' | 'locked' }> {
  const rows = await db
    .select()
    .from(submissions)
    .where(and(
      eq(submissions.resume_token, resumeToken),
      eq(submissions.form_id, formId)
    ))
    .limit(1)

  if (!rows.length) return { error: 'invalid' }
  const row = rows[0] as any

  if (row.status === 'approved' || row.status === 'rejected') return { error: 'locked' }
  if (row.status === 'draft' && row.expires_at && new Date(row.expires_at) < new Date()) return { error: 'expired' }
  if (row.status !== 'draft' && row.status !== 'pending') return { error: 'invalid' } // defensive

  return {
    data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data || {},
    expiresAt: row.expires_at,
    status: row.status,
  }
}

export async function updateSubmissionStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  notes?: string
): Promise<Submission> {
  const currentUser = await requireUser()
  await getOwnedSubmission(id, currentUser)

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
  const currentUser = await requireUser()
  await getOwnedSubmission(id, currentUser)
  await db.delete(submissions).where(eq(submissions.id, id))
}

// ── Share tokens ────────────────────────────────────────────────────────

export async function createShareToken(formId: string): Promise<string> {
  const currentUser = await requireUser()
  await getOwnedForm(formId, currentUser)

  const token = randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.insert(shareTokens).values({
    form_id: formId,
    token,
    expires_at: expiresAt,
  })
  return token
}

export async function getSharedFormData(token: string) {
  const records = await db.select().from(shareTokens).where(eq(shareTokens.token, token)).limit(1)
  if (!records.length) return { error: 'invalid' }

  const record = records[0]
  if (new Date(record.expires_at) < new Date()) return { error: 'expired' }

  const formRows = await db.select().from(forms).where(eq(forms.id, record.form_id)).limit(1)
  if (!formRows.length) return { error: 'not_found' }

  const formSubmissions = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.form_id, record.form_id), ne(submissions.status, 'draft')))

  return {
    form: formRows[0],
    submissions: formSubmissions.map((s: any) => ({
      ...s,
      data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data || {},
    })),
    expiresAt: record.expires_at,
  }
}

// ── Invitees (per-invitee tracking) ────────────────────────────────────

export async function getInvitees(formId: string): Promise<{ form: Pick<Form, 'id' | 'name' | 'slug'>; invitees: Invitee[] }> {
  const currentUser = await requireUser()
  const form = await getOwnedForm(formId, currentUser)

  const rows = await db
    .select()
    .from(invitees)
    .leftJoin(
      submissions,
      and(eq(submissions.invitee_id, invitees.id), ne(submissions.status, 'draft'))
    )
    .where(eq(invitees.form_id, formId))
    .orderBy(desc(invitees.created_at))

  // Multiple non-draft submissions could in principle link to one invitee
  // (edit-after-submit isn't a thing yet, but be defensive) — collapse by id.
  const byId = new Map<string, Invitee>()
  for (const row of rows as any[]) {
    const inv = row.invitees
    if (byId.has(inv.id)) continue
    const status: Invitee['status'] = row.submissions
      ? 'submitted'
      : inv.opened_at
        ? 'opened'
        : 'not_opened'
    byId.set(inv.id, {
      id: inv.id,
      name: inv.name,
      email: inv.email,
      token: inv.token,
      status,
      created_at: inv.created_at,
      last_reminded_at: inv.last_reminded_at,
    })
  }

  return {
    form: { id: form.id, name: form.name, slug: form.slug },
    invitees: Array.from(byId.values()),
  }
}

export async function addInvitees(
  formId: string,
  list: { name: string; email: string }[]
): Promise<void> {
  const currentUser = await requireUser()
  await getOwnedForm(formId, currentUser)

  const rows = list
    .map(entry => ({ name: entry.name.trim(), email: entry.email.trim() }))
    .filter(entry => entry.name && entry.email)
    .map(entry => ({
      form_id: formId,
      name: entry.name,
      email: entry.email,
      token: randomBytes(16).toString('hex'),
    }))

  if (!rows.length) return
  await db.insert(invitees).values(rows)
}

export async function deleteInvitee(id: string): Promise<void> {
  const currentUser = await requireUser()
  await getOwnedInvitee(id, currentUser)
  await db.delete(invitees).where(eq(invitees.id, id))
}

export async function resolveInvitee(
  formId: string,
  token: string
): Promise<{ id: string; name: string; email: string } | { error: string }> {
  const rows = await db
    .select()
    .from(invitees)
    .where(and(eq(invitees.form_id, formId), eq(invitees.token, token)))
    .limit(1)

  if (!rows.length) return { error: 'invalid' }
  const row = rows[0] as any

  if (!row.opened_at) {
    await db.update(invitees).set({ opened_at: new Date() }).where(eq(invitees.id, row.id))
  }

  return { id: row.id, name: row.name, email: row.email }
}

async function sendInviteEmailCore(
  invitee: { id: string; name: string; email: string; token: string },
  form: { name: string; slug: string },
  origin: string
): Promise<{ ok: boolean; error?: string }> {
  const link = `${origin}/f/${form.slug}?invite=${invitee.token}`
  const result = await sendEmail({
    to: invitee.email,
    subject: `You're invited: ${form.name}`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">${form.name}</h2>
        <p>Hi ${invitee.name},</p>
        <p>You've been invited to fill out this form. Your progress is saved automatically, so you can leave and come back any time using this link:</p>
        <p style="margin: 24px 0;">
          <a href="${link}" style="background: #dc2626; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Open form</a>
        </p>
        <p style="color: #666; font-size: 13px;">${link}</p>
      </div>
    `,
  })

  if (result.ok) {
    await db.update(invitees).set({ last_reminded_at: new Date() }).where(eq(invitees.id, invitee.id))
  }

  return result
}

export async function sendInviteEmail(
  inviteeId: string,
  origin: string
): Promise<{ ok: boolean; error?: string }> {
  const currentUser = await requireUser()
  const invitee = await getOwnedInvitee(inviteeId, currentUser)

  const formRows = await db.select().from(forms).where(eq(forms.id, invitee.form_id)).limit(1)
  if (!formRows.length) return { ok: false, error: 'Form not found' }
  const form = formRows[0] as any

  return sendInviteEmailCore(invitee, { name: form.name, slug: form.slug }, origin)
}

export async function sendBulkReminders(
  formId: string,
  origin: string
): Promise<{ sent: number; failed: number }> {
  const { form, invitees: list } = await getInvitees(formId)
  const outstanding = list.filter(i => i.status !== 'submitted')

  let sent = 0
  let failed = 0
  for (const invitee of outstanding) {
    try {
      const result = await sendInviteEmailCore(invitee, form, origin)
      if (result.ok) sent++
      else failed++
    } catch {
      failed++
    }
  }

  return { sent, failed }
}

// ── Analytics tokens ────────────────────────────────────────────────────

export async function createAnalyticsToken(formId: string): Promise<string> {
  const currentUser = await requireUser()
  await getOwnedForm(formId, currentUser)

  const token = randomBytes(16).toString('hex')
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
  await db.insert(analyticsTokens).values({
    form_id: formId,
    token,
    expires_at: expiresAt,
  })
  return token
}

export async function getAnalyticsData(token: string) {
  const records = await db.select().from(analyticsTokens).where(eq(analyticsTokens.token, token)).limit(1)
  if (!records.length) return { error: 'invalid' }

  const record = records[0]
  if (new Date(record.expires_at) < new Date()) return { error: 'expired' }

  const formRows = await db.select().from(forms).where(eq(forms.id, record.form_id)).limit(1)
  if (!formRows.length) return { error: 'not_found' }

  const formSubmissions = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.form_id, record.form_id), ne(submissions.status, 'draft')))

  return {
    form: formRows[0],
    submissions: formSubmissions.map((s: any) => ({
      ...s,
      data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data || {},
    })),
    expiresAt: record.expires_at,
  }
}

// ── Dashboard stats ────────────────────────────────────────────────────

export async function getDashboardStats() {
  const currentUser = await requireUser()
  const isAdmin = currentUser.role === 'admin'

  const allForms: any[] = isAdmin
    ? await db.select().from(forms)
    : await db.select().from(forms).where(eq(forms.user_id, currentUser.id))

  const allSubmissions: any[] = isAdmin
    ? await db.select().from(submissions).where(ne(submissions.status, 'draft'))
    : (
        await db
          .select()
          .from(submissions)
          .leftJoin(forms, eq(submissions.form_id, forms.id))
          .where(and(eq(forms.user_id, currentUser.id), ne(submissions.status, 'draft')))
      ).map((row: any) => row.submissions)

  const categoryCounts: any = {}
  allForms.forEach((form: any) => {
    categoryCounts[form.category] = (categoryCounts[form.category] || 0) + 1
  })

  return {
    totalForms: allForms.length,
    activeForms: allForms.filter((f: any) => f.is_active).length,
    totalSubmissions: allSubmissions.length,
    pending: allSubmissions.filter((s: any) => s.status === 'pending').length,
    approved: allSubmissions.filter((s: any) => s.status === 'approved').length,
    rejected: allSubmissions.filter((s: any) => s.status === 'rejected').length,
    categoryCounts,
  }
}

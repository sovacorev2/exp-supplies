'use server'

import { db } from '@/lib/db'
import { forms, submissions, shareTokens, analyticsTokens, invitees, submissionAttempts, aiReportNarratives, fieldValueMerges, formCollaborators, user } from '@/lib/db/schema'
import { eq, desc, ne, and, or, gt, inArray } from 'drizzle-orm'
import { randomBytes } from 'crypto'
import { headers } from 'next/headers'
import { requireUser, ForbiddenError, type CurrentUser } from '@/lib/auth-helpers'
import { sendEmail } from '@/lib/email'
import { callGemini } from '@/lib/ai'
import { analyzeField, isPrivateField, applyFieldMerges } from '@/lib/analytics'

const RATE_LIMIT_WINDOW_MINUTES = 15
const RATE_LIMIT_MAX_ATTEMPTS = 5

async function getSubmitterIp(): Promise<string> {
  const h = await headers()
  const forwardedFor = h.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  return h.get('x-real-ip') || 'unknown'
}

export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'multiselect' | 'number' | 'date' | 'checkbox' | 'upload' | 'rating' | 'matrix' | 'autocomplete'

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
  owner_name?: string | null
  owner_email?: string | null
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

async function isCollaborator(formId: string, email: string): Promise<boolean> {
  const rows = await db.select().from(formCollaborators)
    .where(and(eq(formCollaborators.form_id, formId), eq(formCollaborators.email, email.toLowerCase())))
    .limit(1)
  return rows.length > 0
}

// A collaborator gets full parity with the owner on this one form (every
// action funnels through getOwnedForm/getOwnedSubmission below) — deciding
// who counts as one is centralized here so both gates stay in sync.
async function canAccessForm(formRow: { id: string; user_id: string | null }, currentUser: CurrentUser): Promise<boolean> {
  if (currentUser.role === 'admin' || formRow.user_id === currentUser.id) return true
  return isCollaborator(formRow.id, currentUser.email)
}

async function getOwnedForm(id: string, currentUser: CurrentUser) {
  const rows = await db.select().from(forms).where(eq(forms.id, id)).limit(1)
  const row = rows[0] as any
  if (!row) throw new Error('Form not found')
  if (!(await canAccessForm(row, currentUser))) throw new ForbiddenError()
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
  if (!row.forms || !(await canAccessForm(row.forms, currentUser))) throw new ForbiddenError()
  return row
}

async function getCollaboratorFormIds(email: string): Promise<string[]> {
  const rows = await db.select({ form_id: formCollaborators.form_id }).from(formCollaborators)
    .where(eq(formCollaborators.email, email.toLowerCase()))
  return rows.map((r: { form_id: string }) => r.form_id)
}

// ── Form collaborators (Google Forms-style "Share") ────────────────────
// A collaborator gets full parity with the owner on this one form — see
// canAccessForm above, which every per-resource action already routes
// through. Managing *who* is a collaborator is deliberately owner/admin
// -only below, so a collaborator with full access can't silently add
// other people the owner never approved.

export async function getFormCollaborators(formId: string): Promise<{ email: string; created_at: Date }[]> {
  const currentUser = await requireUser()
  await getOwnedForm(formId, currentUser)
  return db
    .select({ email: formCollaborators.email, created_at: formCollaborators.created_at })
    .from(formCollaborators)
    .where(eq(formCollaborators.form_id, formId))
    .orderBy(desc(formCollaborators.created_at))
}

export async function addFormCollaborator(
  formId: string,
  email: string,
  origin: string
): Promise<{ ok: boolean; error?: string }> {
  const currentUser = await requireUser()
  const form = await getOwnedForm(formId, currentUser)
  if (currentUser.role !== 'admin' && form.user_id !== currentUser.id) {
    return { ok: false, error: 'Only the form owner can manage access' }
  }

  const normalized = email.trim().toLowerCase()
  if (!normalized) return { ok: false, error: 'Email is required' }
  if (normalized === currentUser.email.toLowerCase()) return { ok: false, error: "That's your own account" }

  try {
    await db.insert(formCollaborators).values({ form_id: formId, email: normalized, invited_by: currentUser.id })
  } catch {
    return { ok: false, error: 'This person already has access' }
  }

  // Best-effort — access is already granted above regardless of whether
  // this send succeeds (no Resend key configured, domain not verified,
  // etc. must never block granting access).
  await sendEmail({
    to: normalized,
    subject: `You've been given access to "${form.name}"`,
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color: #111;">${form.name}</h2>
        <p>${currentUser.name || currentUser.email} has given you access to manage "${form.name}" on Exp Forms — responses, analytics, invitees, everything they can do for this form.</p>
        <p style="margin: 24px 0;">
          <a href="${origin}/sign-in" style="background: #ED1C24; color: #fff; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Sign in</a>
        </p>
        <p style="color: #666; font-size: 13px;">Sign in (or create an account) using this email address — ${normalized} — to see it. If you don't have an account yet, sign up with this same email first.</p>
      </div>
    `,
  }).catch(() => {})

  return { ok: true }
}

export async function removeFormCollaborator(formId: string, email: string): Promise<void> {
  const currentUser = await requireUser()
  const form = await getOwnedForm(formId, currentUser)
  if (currentUser.role !== 'admin' && form.user_id !== currentUser.id) throw new ForbiddenError()
  await db.delete(formCollaborators).where(and(
    eq(formCollaborators.form_id, formId),
    eq(formCollaborators.email, email.trim().toLowerCase())
  ))
}

// ── Forms API ──────────────────────────────────────────────────────────

export async function getForms(): Promise<Form[]> {
  const currentUser = await requireUser()
  const isAdmin = currentUser.role === 'admin'
  // Owner name/email only matters when an admin is looking at everyone's
  // forms — a regular user's list is their own forms plus any forms
  // they've been given collaborator access to, so the join is skipped
  // there entirely.
  const rows = isAdmin
    ? await db
        .select({
          id: forms.id,
          name: forms.name,
          description: forms.description,
          category: forms.category,
          fields: forms.fields,
          is_active: forms.is_active,
          slug: forms.slug,
          user_id: forms.user_id,
          created_at: forms.created_at,
          updated_at: forms.updated_at,
          owner_name: user.name,
          owner_email: user.email,
        })
        .from(forms)
        .leftJoin(user, eq(forms.user_id, user.id))
        .orderBy(desc(forms.created_at))
    : await (async () => {
        const collabIds = await getCollaboratorFormIds(currentUser.email)
        const ownership = collabIds.length
          ? or(eq(forms.user_id, currentUser.id), inArray(forms.id, collabIds))
          : eq(forms.user_id, currentUser.id)
        return db.select().from(forms).where(ownership).orderBy(desc(forms.created_at))
      })()

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
  const form = await getOwnedForm(id, currentUser)
  // Deleting the whole form is destructive and permanent — reserved for
  // the actual owner (or a super-admin), same carve-out as deleting an
  // individual response. Enforced here, not just hidden in the UI.
  if (currentUser.role !== 'admin' && form.user_id !== currentUser.id) {
    throw new ForbiddenError()
  }
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
  let ownershipCondition = eq(forms.user_id, currentUser.id)
  if (currentUser.role !== 'admin') {
    const collabIds = await getCollaboratorFormIds(currentUser.email)
    if (collabIds.length) ownershipCondition = or(eq(forms.user_id, currentUser.id), inArray(forms.id, collabIds))!
  }
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
          .where(and(ownershipCondition, ne(submissions.status, 'draft')))
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
  inviteeId?: string,
  honeypot?: string
): Promise<{ resumeToken: string } | { error: 'locked' | 'rate_limited' }> {
  // A filled honeypot means a bot — pretend success without touching the
  // database at all (no query, no rate-limit budget consumed).
  if (honeypot) {
    return { resumeToken: randomBytes(16).toString('hex') }
  }

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

  // Rate limit only applies here — this is the path a bot spamming the
  // public form endpoint directly (not replaying the draft-autosave flow)
  // actually hits. A legitimate draft-to-pending conversion or edit-resave
  // already returned above via the resumeToken branch.
  const ip = await getSubmitterIp()
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000)
  const recentAttempts = await db
    .select()
    .from(submissionAttempts)
    .where(and(
      eq(submissionAttempts.ip, ip),
      eq(submissionAttempts.form_id, formId),
      gt(submissionAttempts.created_at, windowStart)
    ))
  if (recentAttempts.length >= RATE_LIMIT_MAX_ATTEMPTS) {
    return { error: 'rate_limited' }
  }
  await db.insert(submissionAttempts).values({ ip, form_id: formId })

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
  const row = await getOwnedSubmission(id, currentUser)
  // Deleting a response is destructive and permanent — reserved for the
  // actual owner (or a super-admin), not part of what a collaborator's
  // otherwise-full access extends to. Enforced here, not just hidden in
  // the UI, so it can't be bypassed by calling the API directly.
  if (currentUser.role !== 'admin' && row.forms?.user_id !== currentUser.id) {
    throw new ForbiddenError()
  }
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

  const merges = await fetchMergesByField(record.form_id)
  const parsedSubs = formSubmissions.map((s: any) => ({
    ...s,
    data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data || {},
  }))

  return {
    form: formRows[0],
    submissions: applyFieldMerges(parsedSubs, merges),
    expiresAt: record.expires_at,
  }
}

// ── Manual answer merging (free-text fields only) ─────────────────────

export type FieldValueMerge = { variantValue: string; canonicalValue: string }

async function fetchMergesByField(formId: string): Promise<Record<string, FieldValueMerge[]>> {
  const rows = await db.select().from(fieldValueMerges).where(eq(fieldValueMerges.form_id, formId))
  const byField: Record<string, FieldValueMerge[]> = {}
  rows.forEach((r: any) => {
    if (!byField[r.field_label]) byField[r.field_label] = []
    byField[r.field_label].push({ variantValue: r.variant_value, canonicalValue: r.canonical_value })
  })
  return byField
}

export async function getFieldValueMerges(formId: string): Promise<Record<string, FieldValueMerge[]>> {
  const currentUser = await requireUser()
  await getOwnedForm(formId, currentUser)
  return fetchMergesByField(formId)
}

export async function mergeFieldValues(formId: string, fieldLabel: string, variantValues: string[], canonicalValue: string): Promise<void> {
  const currentUser = await requireUser()
  await getOwnedForm(formId, currentUser)
  const targets = variantValues.filter(v => v !== canonicalValue)
  for (const variant of targets) {
    await db.delete(fieldValueMerges).where(and(
      eq(fieldValueMerges.form_id, formId),
      eq(fieldValueMerges.field_label, fieldLabel),
      eq(fieldValueMerges.variant_value, variant)
    ))
    await db.insert(fieldValueMerges).values({ form_id: formId, field_label: fieldLabel, variant_value: variant, canonical_value: canonicalValue })
  }
}

export async function unmergeFieldValue(formId: string, fieldLabel: string, variantValue: string): Promise<void> {
  const currentUser = await requireUser()
  await getOwnedForm(formId, currentUser)
  await db.delete(fieldValueMerges).where(and(
    eq(fieldValueMerges.form_id, formId),
    eq(fieldValueMerges.field_label, fieldLabel),
    eq(fieldValueMerges.variant_value, variantValue)
  ))
}

// ── Dashboard stats ────────────────────────────────────────────────────

export async function getDashboardStats() {
  const currentUser = await requireUser()
  const isAdmin = currentUser.role === 'admin'

  let ownershipCondition = eq(forms.user_id, currentUser.id)
  if (!isAdmin) {
    const collabIds = await getCollaboratorFormIds(currentUser.email)
    if (collabIds.length) ownershipCondition = or(eq(forms.user_id, currentUser.id), inArray(forms.id, collabIds))!
  }

  const allForms: any[] = isAdmin
    ? await db.select().from(forms)
    : await db.select().from(forms).where(ownershipCondition)

  const allSubmissions: any[] = isAdmin
    ? await db.select().from(submissions).where(ne(submissions.status, 'draft'))
    : (
        await db
          .select()
          .from(submissions)
          .leftJoin(forms, eq(submissions.form_id, forms.id))
          .where(and(ownershipCondition, ne(submissions.status, 'draft')))
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

// ── Smart Insights report narrative ─────────────────────────────────────

export type ReportNarrative = {
  summary: string
  keyInsights: string[]
  notableQuotes: string[]
  recommendations: string[]
  conclusion: string
  fieldInsights: { fieldId: string; insight: string }[]
  textSummaries: { fieldId: string; summary: string }[]
}

const NARRATIVE_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    keyInsights: { type: 'array', items: { type: 'string' } },
    notableQuotes: { type: 'array', items: { type: 'string' } },
    recommendations: { type: 'array', items: { type: 'string' } },
    conclusion: { type: 'string' },
    // Per-question commentary rendered directly under each chart in the
    // report — this is what actually makes the analysis feel authored
    // rather than a pile of charts with a summary bolted on the end.
    // Keyed by fieldId (not the question text) — asking the model to
    // transcribe a full sentence back verbatim as a match key is fragile
    // (any paraphrase/typo silently breaks the lookup with no visible
    // error); ids are short tokens it can copy far more reliably.
    fieldInsights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldId: { type: 'string' },
          insight: { type: 'string' },
        },
        required: ['fieldId', 'insight'],
      },
    },
    // Replaces the raw "every individual answer" dump for open-ended text
    // questions in the printed report with an actual thematic synthesis.
    textSummaries: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          fieldId: { type: 'string' },
          summary: { type: 'string' },
        },
        required: ['fieldId', 'summary'],
      },
    },
  },
  required: ['summary', 'keyInsights', 'notableQuotes', 'recommendations', 'conclusion', 'fieldInsights', 'textSummaries'],
}

function summarizeFieldForPrompt(field: FormField, subs: Submission[]): string | null {
  const result = analyzeField(field, subs, true)
  const id = field.id
  switch (result.kind) {
    case 'categorical':
      if (!result.buckets.length) return null
      return `[${id}] ${field.label} (choice): ${result.buckets.map(b => `${b.label}: ${b.value}`).join(', ')}${result.unanswered ? ` (${result.unanswered} skipped)` : ''}`
    case 'multi':
      if (!result.buckets.length) return null
      return `[${id}] ${field.label} (multi-select): ${result.buckets.map(b => `${b.label}: ${b.value}`).join(', ')}`
    case 'boolean':
      if (!result.yes && !result.no) return null
      return `[${id}] ${field.label} (yes/no): Yes ${result.yes}, No ${result.no}`
    case 'numeric':
      if (!result.answered) return null
      return `[${id}] ${field.label} (number): average ${result.avg.toFixed(1)}, median ${result.median}, range ${result.min}-${result.max}`
    case 'date':
      if (!result.buckets.length) return null
      return `[${id}] ${field.label} (date): ${result.buckets.map(b => `${b.label}: ${b.value}`).join(', ')}`
    case 'text': {
      const sample = (result.allAnswers ?? result.samples).slice(0, 30).map(a => a.slice(0, 200))
      if (!sample.length) return null
      return `[${id}] ${field.label} (open text, ${result.answered} answers): ${sample.map(s => `"${s}"`).join(' | ')}`
    }
    case 'matrix':
      if (!result.rows.length) return null
      return `[${id}] ${field.label} (rated rows, out of ${result.scaleMax}): ${result.rows.map(r => `${r.row}: ${r.avg}`).join(', ')}`
    case 'rating':
      if (!result.answered) return null
      return `[${id}] ${field.label} (rating out of ${result.max}): average ${result.avg.toFixed(1)}, distribution — ${result.buckets.map(b => `${b.label}: ${b.value}`).join(', ')}`
  }
}

function buildNarrativePrompt(form: { name: string; description: string | null; fields: FormField[] }, subs: Submission[]): string {
  const fieldSummaries = (form.fields ?? [])
    .filter(f => f.section !== 'SECTION_HEADER' && !isPrivateField(f.label))
    .map(f => summarizeFieldForPrompt(f, subs))
    .filter((line): line is string => Boolean(line))
    .join('\n')

  return `You are a data analyst writing a concise, professional report summary for a survey/form titled "${form.name}"${form.description ? ` (${form.description})` : ''}.

Total responses: ${subs.length}

Aggregated results per question, each prefixed with its id in [brackets]:
${fieldSummaries}

Write:
- summary: a 2-4 sentence executive summary of the overall findings.
- keyInsights: 3-6 short bullet points, each grounded in the actual numbers above — no invented statistics.
- notableQuotes: up to 4 short verbatim excerpts from the open-text answers above that best represent common themes (return an empty array if there are no open-text questions with meaningful answers).
- recommendations: 2-5 concrete, actionable recommendations based on the findings.
- conclusion: a short closing paragraph.
- fieldInsights: for each question above that has a genuinely noteworthy result (a clear winner/loser, a surprising split, a strong consensus, a standout average) write ONE punchy sentence of commentary that cites the actual numbers, e.g. "Appearance scored highest at 4.6/5, with 80% of respondents rating it 4 or 5." Skip questions with nothing worth saying — do not write filler for every single question. Set fieldId to the exact id shown in that question's [brackets] above, copied verbatim — do not shorten, paraphrase, or use the question text.
- textSummaries: for each "(open text, N answers)" question above, write a detailed 3-6 sentence thematic summary of ALL the answers listed for it — group similar feedback together, name specific products/samples respondents mention by name, call out the most frequently requested changes, and note any minority or conflicting opinions. This summary will completely replace showing every individual raw answer in the report, so it needs to be thorough enough that a reader doesn't need to see the raw list — don't just restate 2-3 examples and stop. Skip a text question entirely if it has fewer than 3 answered responses. Set fieldId to the exact id shown in that question's [brackets] above, copied verbatim.

Keep the tone professional and specific to this data — no generic filler. Respond only with the JSON described by the schema.`
}

export async function generateReportNarrative(
  formId: string,
  force = false,
  // Absolute instants (ISO strings), not plain dates — resolved client-side
  // from the admin's own local calendar day before being sent here, so a
  // "Day 1" report during a multi-day activation matches exactly what the
  // charts show, without the server needing to guess a timezone at all.
  rangeStartISO?: string,
  rangeEndISO?: string
): Promise<{ ok: true; data: ReportNarrative; cached: boolean } | { ok: false; error: string }> {
  const currentUser = await requireUser()
  const form = await getOwnedForm(formId, currentUser)
  const isDateScoped = Boolean(rangeStartISO || rangeEndISO)

  const subRows = await db
    .select()
    .from(submissions)
    .where(and(eq(submissions.form_id, formId), ne(submissions.status, 'draft')))
  let parsedSubs: Submission[] = subRows.map((s: any) => ({
    ...s,
    data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data || {},
  }))
  if (isDateScoped) {
    parsedSubs = parsedSubs.filter(s => {
      const created = new Date(s.created_at).toISOString()
      if (rangeStartISO && created < rangeStartISO) return false
      if (rangeEndISO && created > rangeEndISO) return false
      return true
    })
  }
  const merges = await fetchMergesByField(formId)
  const subs = applyFieldMerges(parsedSubs, merges)

  // A date-scoped request (a single day's report mid-activation) is never
  // read from or written to the whole-form cache below — caching it under
  // the same row would either serve a stale all-time narrative for a
  // single-day request, or worse, corrupt the all-time cache with a
  // single day's narrative the next time someone views without a filter.
  const existing = isDateScoped ? [] : await db.select().from(aiReportNarratives).where(eq(aiReportNarratives.form_id, formId)).limit(1)
  const cached = existing[0]

  if (!isDateScoped && !force && cached && cached.submission_count === subs.length) {
    return { ok: true, data: cached.narrative as ReportNarrative, cached: true }
  }

  if (subs.length < 3) return { ok: false, error: 'Not enough responses yet for Smart Insights' }

  const fields: FormField[] = typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields || []
  const prompt = buildNarrativePrompt({ name: form.name, description: form.description, fields }, subs)
  const result = await callGemini<ReportNarrative>(prompt, NARRATIVE_SCHEMA)
  if (!result.ok) return result

  if (!isDateScoped) {
    if (cached) {
      await db
        .update(aiReportNarratives)
        .set({ submission_count: subs.length, narrative: result.data, generated_at: new Date() })
        .where(eq(aiReportNarratives.form_id, formId))
    } else {
      await db.insert(aiReportNarratives).values({ form_id: formId, submission_count: subs.length, narrative: result.data })
    }
  }

  return { ok: true, data: result.data, cached: false }
}

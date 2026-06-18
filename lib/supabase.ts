import { neon } from '@neondatabase/serverless';

// This safely grabs your Neon connection string from Vercel/Local env
const sql = neon(process.env.DATABASE_URL!);

// Helper object to keep existing Supabase table queries from completely crashing the build
export const supabase = {
  from: (table: string) => ({
    select: async (columns = '*') => {
      try {
        const result = await sql(`SELECT ${columns} FROM ${table}`);
        return { data: result, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }
  })
};

export { sql };

// ── Types ──────────────────────────────────────────────────────────────

export type FieldType = 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'number' | 'date' | 'checkbox'

export interface FormField {
  id: string
  label: string
  type: FieldType
  required: boolean
  placeholder?: string
  options?: string[]   // for select fields
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

export async function getForms() {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as Form[]
}

export async function getFormBySlug(slug: string) {
  const { data, error } = await supabase
    .from('forms')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()
  if (error) throw error
  return data as Form
}

export async function createForm(form: Omit<Form, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('forms')
    .insert(form)
    .select()
    .single()
  if (error) throw error
  return data as Form
}

export async function updateForm(id: string, updates: Partial<Form>) {
  const { data, error } = await supabase
    .from('forms')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Form
}

export async function deleteForm(id: string) {
  const { error } = await supabase.from('forms').delete().eq('id', id)
  if (error) throw error
}

// ── Submissions API ────────────────────────────────────────────────────

export async function getSubmissions(filters?: { form_id?: string; status?: string; category?: string }) {
  let query = supabase
    .from('submissions')
    .select('*, forms(name, category, slug)')
    .order('created_at', { ascending: false })

  if (filters?.form_id) query = query.eq('form_id', filters.form_id)
  if (filters?.status)  query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error

  let result = data as Submission[]
  if (filters?.category) {
    result = result.filter(s => s.forms?.category === filters.category)
  }
  return result
}

export async function createSubmission(formId: string, data: Record<string, string>) {
  const { error } = await supabase
    .from('submissions')
    .insert({ form_id: formId, data, status: 'pending' })
  if (error) throw error
}

export async function updateSubmissionStatus(id: string, status: 'pending' | 'approved' | 'rejected', notes?: string) {
  const { data, error } = await supabase
    .from('submissions')
    .update({ status, ...(notes !== undefined && { notes }) })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Submission
}

export async function deleteSubmission(id: string) {
  const { error } = await supabase.from('submissions').delete().eq('id', id)
  if (error) throw error
}

// ── Stats ──────────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const [formsRes, subsRes] = await Promise.all([
    supabase.from('forms').select('id, category, is_active'),
    supabase.from('submissions').select('id, status, forms(category)'),
  ])
  if (formsRes.error) throw formsRes.error
  if (subsRes.error)  throw subsRes.error

  const forms       = formsRes.data
  const submissions = subsRes.data as any[]

  const categoryCounts: Record<string, number> = {}
  submissions.forEach(s => {
    const cat = s.forms?.category || 'Unknown'
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1
  })

  return {
    totalForms:       forms.length,
    activeForms:      forms.filter(f => f.is_active).length,
    totalSubmissions: submissions.length,
    pending:          submissions.filter(s => s.status === 'pending').length,
    approved:         submissions.filter(s => s.status === 'approved').length,
    rejected:         submissions.filter(s => s.status === 'rejected').length,
    categoryCounts,
  }
}

// ── Slug helpers ───────────────────────────────────────────────────────

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    + '-' + Math.random().toString(36).slice(2, 7)
}

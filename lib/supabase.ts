// A clean, zero-dependency HTTP client for Neon
const neonFetch = async (query: string, params: any[] = []) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("DATABASE_URL environment variable is missing.");
    return [];
  }

  try {
    const response = await fetch(`${databaseUrl.replace('postgresql://', 'https://')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, params }),
    });
    const result = await response.json();
    return result.rows || [];
  } catch (error) {
    console.error("Neon HTTP Fetch Error:", error);
    return [];
  }
};

// Raw SQL helper
export const sql = async (strings: TemplateStringsArray, ...values: any[]) => {
  const query = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `$${i + 1}` : ''), '');
  return neonFetch(query, values);
};

// Mock Supabase methods to prevent legacy integrations from crashing
export const supabase = {
  from: (table: string) => ({
    select: async (columns = '*') => {
      try {
        const data = await neonFetch(`SELECT ${columns} FROM ${table}`);
        return { data, error: null };
      } catch (err) {
        return { data: null, error: err };
      }
    }
  })
};

/* ==========================================
   MAPPED DATABASE HELPER FUNCTIONS FOR APP PAGES
   ========================================== */

export async function getForms() {
  return await neonFetch('SELECT * FROM forms ORDER BY created_at DESC');
}

export async function getFormBySlug(slug: string) {
  const rows = await neonFetch('SELECT * FROM forms WHERE slug = $1 LIMIT 1', [slug]);
  return rows[0] || null;
}

export async function createForm(title: string, description: string, fields: any) {
  const slug = generateSlug(title);
  return await neonFetch(
    'INSERT INTO forms (title, description, fields, slug, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *',
    [title, description, JSON.stringify(fields), slug]
  );
}

export async function getSubmissions() {
  return await neonFetch('SELECT * FROM submissions ORDER BY created_at DESC');
}

export async function createSubmission(formId: string, data: any) {
  return await neonFetch(
    'INSERT INTO submissions (form_id, data, status, created_at) VALUES ($1, $2, \'pending\', NOW()) RETURNING *',
    [formId, JSON.stringify(data)]
  );
}

export async function updateSubmissionStatus(id: string, status: string) {
  return await neonFetch('UPDATE submissions SET status = $1 WHERE id = $2 RETURNING *', [status, id]);
}

export async function deleteSubmission(id: string) {
  return await neonFetch('DELETE FROM submissions WHERE id = $1', [id]);
}

export async function getDashboardStats() {
  const forms = await neonFetch('SELECT COUNT(*) as count FROM forms');
  const submissions = await neonFetch('SELECT COUNT(*) as count FROM submissions');
  return {
    formsCount: parseInt(forms[0]?.count || '0', 10),
    submissionsCount: parseInt(submissions[0]?.count || '0', 10),
  };
}

export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
}
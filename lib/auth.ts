import { betterAuth, APIError } from 'better-auth'
import { Pool } from 'pg'
import { eq } from 'drizzle-orm'
import { db } from './db'
import { formCollaborators } from './db/schema'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Sign-up used to be open to anyone on the internet, which let a stranger
// register, publish a public /f/[slug] page with arbitrary field labels,
// and turn the domain into a live phishing kit (this is what got
// forms.expkenya.online flagged by Google Safe Browsing). New accounts are
// now restricted to the super admin and emails an admin has already
// invited as a form collaborator.
async function isAllowedNewSignup(email: string): Promise<boolean> {
  const normalized = email.toLowerCase()
  if (process.env.SUPER_ADMIN_EMAIL && normalized === process.env.SUPER_ADMIN_EMAIL.toLowerCase()) {
    return true
  }
  const invited = await db
    .select()
    .from(formCollaborators)
    .where(eq(formCollaborators.email, normalized))
    .limit(1)
  return invited.length > 0
}

export const auth = betterAuth({
  database: pool,
  databaseHooks: {
    user: {
      create: {
        before: async (user: { email: string }) => {
          if (!(await isAllowedNewSignup(user.email))) {
            throw new APIError('FORBIDDEN', {
              message: 'Sign-up is invite-only. Ask an admin to add you as a collaborator first.',
            })
          }
        },
      },
    },
  },
  baseURL:
    process.env.BETTER_AUTH_URL ??
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : process.env.V0_RUNTIME_URL),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
    },
  },
  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },
  trustedOrigins: [
    ...(process.env.V0_RUNTIME_URL ? [process.env.V0_RUNTIME_URL] : []),
    ...(process.env.VERCEL_URL ? [`https://${process.env.VERCEL_URL}`] : []),
    ...(process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? [`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`]
      : []),
  ],
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        advanced: {
          // In dev (v0 preview iframe), force cross-site cookies so the
          // session cookie is stored by the browser.
          defaultCookieAttributes: {
            sameSite: 'none' as const,
            secure: true,
          },
        },
      }
    : {}),
})

import { pgTable, text, timestamp, boolean, jsonb, integer } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// --- Better Auth required tables -------------------------------------------
// Column names are camelCase to match Better Auth's defaults. Do not rename.

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  role: text('role').notNull().default('user'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  expiresAt: timestamp('expiresAt').notNull(),
  token: text('token').notNull().unique(),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
})

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  idToken: text('idToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt'),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt'),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('createdAt').notNull().defaultNow(),
  updatedAt: timestamp('updatedAt').notNull().defaultNow(),
})

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt').notNull(),
  createdAt: timestamp('createdAt').defaultNow(),
  updatedAt: timestamp('updatedAt').defaultNow(),
})

// --- App tables ---

export const forms = pgTable('forms', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  name: text('name').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  fields: jsonb('fields').notNull().default([]),
  is_active: boolean('is_active').notNull().default(true),
  slug: text('slug').notNull().unique(),
  user_id: text('user_id').references(() => user.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
})

export const invitees = pgTable('invitees', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  form_id: text('form_id')
    .notNull()
    .references(() => forms.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  token: text('token').notNull().unique(),
  opened_at: timestamp('opened_at'),
  last_reminded_at: timestamp('last_reminded_at'),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const submissions = pgTable('submissions', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  form_id: text('form_id')
    .notNull()
    .references(() => forms.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull().default({}),
  status: text('status').notNull().default('pending'),
  notes: text('notes'),
  resume_token: text('resume_token'),
  expires_at: timestamp('expires_at'),
  invitee_id: text('invitee_id').references(() => invitees.id, { onDelete: 'set null' }),
  created_at: timestamp('created_at').notNull().defaultNow(),
  updated_at: timestamp('updated_at').notNull().defaultNow(),
})

export const shareTokens = pgTable('share_tokens', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  form_id: text('form_id')
    .notNull()
    .references(() => forms.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  expires_at: timestamp('expires_at').notNull(),
})

export const analyticsTokens = pgTable('analytics_tokens', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  form_id: text('form_id')
    .notNull()
    .references(() => forms.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  created_at: timestamp('created_at').notNull().defaultNow(),
  expires_at: timestamp('expires_at').notNull(),
})

export const adminLoginAttempts = pgTable('admin_login_attempts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  ip: text('ip').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const submissionAttempts = pgTable('submission_attempts', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  ip: text('ip').notNull(),
  form_id: text('form_id')
    .notNull()
    .references(() => forms.id, { onDelete: 'cascade' }),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

export const aiReportNarratives = pgTable('ai_report_narratives', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  form_id: text('form_id')
    .notNull()
    .unique()
    .references(() => forms.id, { onDelete: 'cascade' }),
  submission_count: integer('submission_count').notNull(),
  narrative: jsonb('narrative').notNull(),
  generated_at: timestamp('generated_at').notNull().defaultNow(),
})

export const fieldValueMerges = pgTable('field_value_merges', {
  id: text('id').primaryKey().default(sql`gen_random_uuid()::text`),
  form_id: text('form_id')
    .notNull()
    .references(() => forms.id, { onDelete: 'cascade' }),
  field_label: text('field_label').notNull(),
  variant_value: text('variant_value').notNull(),
  canonical_value: text('canonical_value').notNull(),
  created_at: timestamp('created_at').notNull().defaultNow(),
})

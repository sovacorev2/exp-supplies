import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    // Check if event form already exists
    const existing = await db
      .select()
      .from(forms)
      .where(eq(forms.slug, 'event-attendance'))
      .limit(1)

    if (existing.length > 0) {
      return NextResponse.json({ message: 'Event form already exists', form: existing[0] })
    }

    // Create the event attendance form
    const eventFormData = {
      name: 'Event Attendance Form',
      description: 'Staff event attendance and preference form for planning',
      category: 'Event',
      slug: 'event-attendance',
      is_active: true,
      fields: [
        {
          id: 'name',
          label: 'Name',
          type: 'text',
          required: true,
          placeholder: 'Your full name',
        },
        {
          id: 'dates',
          label: 'Which dates could you attend?',
          type: 'checkbox',
          required: true,
          options: [
            'Friday, 14 August 2026',
            'Friday, 21 August 2026',
            'Saturday, 15 August 2026',
            'Saturday, 22 August 2026',
            'None of these work',
          ],
        },
        {
          id: 'first-choice',
          label: 'Of those, which is your first choice?',
          type: 'select',
          required: true,
          options: [
            'Friday, 14 August 2026',
            'Friday, 21 August 2026',
            'Saturday, 15 August 2026',
            'Saturday, 22 August 2026',
          ],
          dependsOn: {
            fieldLabel: 'Which dates could you attend?',
            triggerValue: 'not-none',
          },
        },
        {
          id: 'no-dates-reason',
          label: 'If none of the dates work, why not?',
          type: 'textarea',
          required: true,
          placeholder: 'Please explain what conflicts with these dates',
          dependsOn: {
            fieldLabel: 'Which dates could you attend?',
            triggerValue: 'None of these work',
          },
        },
        {
          id: 'adults',
          label: 'Number of adults attending (including you)',
          type: 'number',
          required: true,
          placeholder: '1',
        },
        {
          id: 'children',
          label: 'Number of children attending',
          type: 'number',
          required: true,
          placeholder: '0',
        },
        {
          id: 'children-ages',
          label: 'Ages of children attending',
          type: 'text',
          required: false,
          placeholder: 'e.g., 4, 7, 12',
          dependsOn: {
            fieldLabel: 'Number of children attending',
            triggerValue: 'greater-0',
          },
        },
      ],
    }

    const result = await db
      .insert(forms)
      .values({
        name: eventFormData.name,
        description: eventFormData.description,
        category: eventFormData.category,
        slug: eventFormData.slug,
        is_active: eventFormData.is_active,
        fields: eventFormData.fields as any,
      })
      .returning()

    return NextResponse.json({
      success: true,
      message: 'Event form created successfully',
      form: result[0],
    })
  } catch (error) {
    console.error('[v0] Error creating event form:', error)
    return NextResponse.json(
      { error: 'Failed to create event form', details: String(error) },
      { status: 500 }
    )
  }
}

import { db } from '@/lib/db'
import { forms } from '@/lib/db/schema'

const eventForm = {
  name: "Event Attendance Form",
  description: "Staff event attendance and preference form",
  category: "Event",
  slug: "event-attendance",
  is_active: true,
  fields: [
    {
      id: "name",
      label: "Name",
      type: "text",
      required: true,
      placeholder: "Your full name"
    },
    {
      id: "dates",
      label: "Which dates could you attend?",
      type: "checkbox",
      required: true,
      options: [
        "Friday, 14 August 2026",
        "Friday, 21 August 2026",
        "Saturday, 15 August 2026",
        "Saturday, 22 August 2026",
        "None of these work"
      ]
    },
    {
      id: "first-choice",
      label: "Of those, which is your first choice?",
      type: "select",
      required: true,
      options: [
        "Friday, 14 August 2026",
        "Friday, 21 August 2026",
        "Saturday, 15 August 2026",
        "Saturday, 22 August 2026"
      ],
      dependsOn: {
        fieldLabel: "Which dates could you attend?",
        triggerValue: "has-dates"
      }
    },
    {
      id: "no-dates-reason",
      label: "If none of the dates work, why not?",
      type: "textarea",
      required: true,
      placeholder: "Please explain what conflicts with these dates",
      dependsOn: {
        fieldLabel: "Which dates could you attend?",
        triggerValue: "None of these work"
      }
    },
    {
      id: "adults",
      label: "Number of adults attending (including you)",
      type: "number",
      required: true,
      placeholder: "1"
    },
    {
      id: "children",
      label: "Number of children attending",
      type: "number",
      required: true,
      placeholder: "0"
    },
    {
      id: "children-ages",
      label: "Ages of children attending",
      type: "text",
      required: false,
      placeholder: "e.g., 4, 7, 12",
      dependsOn: {
        fieldLabel: "Number of children attending",
        triggerValue: "greater-than-0"
      }
    }
  ]
}

async function createEventForm() {
  try {
    const result = await db
      .insert(forms)
      .values({
        name: eventForm.name,
        description: eventForm.description,
        category: eventForm.category,
        slug: eventForm.slug,
        is_active: eventForm.is_active,
        fields: eventForm.fields as any,
      })
      .returning()
    
    console.log('Event form created successfully:', result[0])
  } catch (error) {
    console.error('Error creating event form:', error)
    process.exit(1)
  }
}

createEventForm()

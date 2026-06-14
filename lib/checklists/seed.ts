import { db } from '@/lib/db'
import { landTemplate } from './templates/land'
import { taxLienTemplate } from './templates/tax-lien'
import { taxDeedTemplate } from './templates/tax-deed'
import { foreclosureTemplate } from './templates/foreclosure'
import { Prisma } from '@/app/generated/prisma'

const SYSTEM_TEMPLATES = [landTemplate, taxLienTemplate, taxDeedTemplate, foreclosureTemplate]

export async function seedChecklistTemplates(): Promise<void> {
  for (const tpl of SYSTEM_TEMPLATES) {
    const existing = await db.checklistTemplate.findFirst({
      where: { tenantId: null, strategy: tpl.strategy },
    })
    if (!existing) {
      await db.checklistTemplate.create({
        data: {
          tenantId: null,
          strategy: tpl.strategy,
          name: tpl.label,
          items: tpl.items as unknown as Prisma.InputJsonValue,
          isActive: true,
          version: 1,
        },
      })
    }
  }
}

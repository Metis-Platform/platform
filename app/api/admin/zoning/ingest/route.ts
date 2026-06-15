import { NextResponse } from 'next/server'
import { z } from 'zod'
import { isSuperAdmin } from '@/lib/admin-auth'
import { getGeoService } from '@/lib/geo/service'

const ingestSchema = z.object({
  fipsCounty: z.string().regex(/^\d{5}$/),
  source: z.object({
    type: z.enum(['arcgis_featureserver', 'geojson_url', 'shapefile_path']),
    url: z.string().min(1),
    fipsField: z.string().min(1),
    nameField: z.string().min(1).optional(),
  }),
})

export async function POST(req: Request) {
  if (!(await isSuperAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = ingestSchema.safeParse(await req.json())
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const result = await getGeoService().ingestCountyZoning(parsed.data.fipsCounty, parsed.data.source)
  return NextResponse.json(result, { status: 201 })
}

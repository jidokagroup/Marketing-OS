/**
 * POST /api/scheduler/upload — upload one media file for a scheduled post.
 *
 * Auth is verified via the user's session; the file is stored with the
 * service client (bypasses storage RLS) in a public bucket so Meta's Graph
 * API can fetch it at publish time. Returns the public URL + detected type.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const BUCKET = 'content-media'
const MAX_BYTES = 50 * 1024 * 1024 // 50MB (matches bucket limit)
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/quicktime': 'mov',
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 50MB limit' }, { status: 413 })
  }

  const ext = EXT_BY_TYPE[file.type]
  if (!ext) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type || 'unknown'}` }, { status: 415 })
  }

  // Object path keeps the extension so the publisher can detect video vs image.
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const svc = createServiceClient() as any
  const { error: uploadError } = await svc.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: pub } = svc.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({
    url: pub.publicUrl,
    media_type: file.type.startsWith('video') ? 'reel' : 'image',
    path,
  })
}

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerUserId } from '@/lib/apiAuth'

async function getUserId(req: Request) {
  return getServerUserId(req)
}

export async function GET(req: Request) {
  const userId = await getUserId(req)
  if (!userId) return NextResponse.json({ error: 'Unauthorized', errorCode: 'UNAUTHORIZED' }, { status: 401 })

  const url = new URL(req.url)
  const query = url.searchParams.get('query') || ''
  const type = url.searchParams.get('type') || undefined
  const page = Number(url.searchParams.get('page') || '1')
  const limit = Math.min(Number(url.searchParams.get('limit') || '24'), 50)
  const offset = (Math.max(page, 1) - 1) * limit

  try {
    const where: any = {
      workspace: {
        ownerId: userId,
      },
    }

    if (query) {
      where.fileName = { contains: query, mode: 'insensitive' }
    }

    if (type === 'VIDEO' || type === 'IMAGE') {
      where.type = type
    }

    const [media, total] = await Promise.all([
      prisma.media.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.media.count({ where }),
    ])

    return NextResponse.json({ media, pagination: { page, limit, total, pages: Math.ceil(total / limit) } })
  } catch (err) {
    console.error('List media error', err)
    return NextResponse.json({ error: 'List failed', errorCode: 'LIST_FAILED' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/users/[id]
 * PATCH  /api/admin/users/[id]  — change plan / role
 * Admin-only
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { prisma } from '@/lib/prisma'

async function requireAdmin(req: NextRequest) {
  const authUser = await getAuthUser(req)
  if (!authUser) return null
  const dbUser = await prisma.user.findUnique({ where: { id: authUser.id }, select: { role: true } })
  if (dbUser?.role !== 'ADMIN') return null
  return authUser
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

  // Prevent deleting yourself
  if (admin.id === id) return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })

  try {
    await prisma.user.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[admin/users DELETE]', err)
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin(req)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = params
  if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

  try {
    const body = await req.json()
    const { subscriptionStatus, role } = body

    const updateData: Record<string, string> = {}
    if (subscriptionStatus) updateData.subscriptionStatus = subscriptionStatus
    if (role) updateData.role = role

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, subscriptionStatus: true, role: true },
    })

    return NextResponse.json({ user: updated })
  } catch (err) {
    console.error('[admin/users PATCH]', err)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

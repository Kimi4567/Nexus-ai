/**
 * Publishing Sprint PR 2 — approval / scheduling split.
 *
 * Pins the honest separation of approval and scheduling:
 *   - normal approve moves DRAFT → APPROVED only (never DRAFT → SCHEDULED)
 *   - scheduling moves APPROVED → SCHEDULED only (and only through the schedule path)
 *   - approvedAt is set on approval; scheduledAt is NEVER written by either action
 *   - scheduling requires an existing valid scheduledAt/planned date
 *   - status history is recorded for every transition
 *   - re-approving an already-approved post is a no-op (no double approval)
 *   - no compound approval-and-scheduling transition exists
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planApproval, planScheduling, planRevert, type PlanPostInput } from '@/lib/approvalPlan'

const draft = (id: string): PlanPostInput => ({ id, workspaceId: 'w1', status: 'DRAFT' })
const approved = (id: string): PlanPostInput => ({ id, workspaceId: 'w1', status: 'APPROVED', scheduledAt: '2026-06-20T10:00:00Z' })
const approvedWithoutDate = (id: string): PlanPostInput => ({ id, workspaceId: 'w1', status: 'APPROVED', scheduledAt: null })
const scheduled = (id: string): PlanPostInput => ({ id, workspaceId: 'w1', status: 'SCHEDULED' })
const published = (id: string): PlanPostInput => ({ id, workspaceId: 'w1', status: 'PUBLISHED' })

// No update produced by approval/scheduling may ever carry a scheduledAt key.
const noScheduledAt = (updates: { data: Record<string, unknown> }[]) =>
  updates.every(u => !('scheduledAt' in u.data))

describe('planApproval — DRAFT → APPROVED only', () => {
  it('1. moves DRAFT → APPROVED and sets approvedAt', () => {
    const now = new Date('2026-06-13T10:00:00Z')
    const plan = planApproval([draft('p1'), draft('p2')], { now })
    expect(plan.mode).toBe('approve')
    expect(plan.changed).toBe(2)
    expect(plan.updates.every(u => u.data.status === 'APPROVED')).toBe(true)
    expect(plan.updates.every(u => u.data.approvedAt === now)).toBe(true)
  })

  it('2. normal approval never produces a DRAFT → SCHEDULED jump', () => {
    const plan = planApproval([draft('p1'), draft('p2'), draft('p3')])
    expect(plan.updates.some(u => u.data.status === 'SCHEDULED')).toBe(false)
    expect(plan.updates.every(u => u.data.status === 'APPROVED')).toBe(true)
  })

  it('3. approval never writes scheduledAt', () => {
    const plan = planApproval([draft('p1')])
    expect(noScheduledAt(plan.updates)).toBe(true)
  })

  it('4. records DRAFT → APPROVED history with actor USER by default', () => {
    const plan = planApproval([draft('p1')])
    expect(plan.history).toHaveLength(1)
    expect(plan.history[0]).toMatchObject({ socialPostId: 'p1', fromStatus: 'DRAFT', toStatus: 'APPROVED', actor: 'USER' })
  })

  it('5. no double approval — non-DRAFT posts are skipped', () => {
    const plan = planApproval([draft('p1'), approved('p2'), scheduled('p3')])
    expect(plan.changed).toBe(1)
    expect(plan.skipped).toBe(2)
    expect(plan.updates.map(u => u.id)).toEqual(['p1'])
  })

  it('respects a custom actor', () => {
    const plan = planApproval([draft('p1')], { actor: 'SYSTEM' })
    expect(plan.history[0].actor).toBe('SYSTEM')
  })
})

describe('planScheduling — APPROVED → SCHEDULED only', () => {
  it('6. moves APPROVED with valid scheduledAt → SCHEDULED through the scheduling path', () => {
    const plan = planScheduling([approved('p1'), approved('p2')])
    expect(plan.changed).toBe(2)
    expect(plan.updates.every(u => u.data.status === 'SCHEDULED')).toBe(true)
  })

  it('7. scheduling does NOT touch approvedAt and never writes scheduledAt', () => {
    const plan = planScheduling([approved('p1')])
    expect('approvedAt' in plan.updates[0].data).toBe(false)
    expect(noScheduledAt(plan.updates)).toBe(true)
  })

  it('8. DRAFT posts cannot be scheduled directly (skipped)', () => {
    const plan = planScheduling([draft('p1'), approved('p2')])
    expect(plan.changed).toBe(1)
    expect(plan.skipped).toBe(1)
    expect(plan.updates.map(u => u.id)).toEqual(['p2'])
  })

  it('records APPROVED → SCHEDULED history', () => {
    const plan = planScheduling([approved('p1')])
    expect(plan.history[0]).toMatchObject({ fromStatus: 'APPROVED', toStatus: 'SCHEDULED', actor: 'USER' })
  })

  it('requires a valid planned scheduledAt before scheduling approved posts', () => {
    const plan = planScheduling([
      approved('p1'),
      approvedWithoutDate('p2'),
      { id: 'p3', workspaceId: 'w1', status: 'APPROVED', scheduledAt: 'not-a-date' },
    ])

    expect(plan.changed).toBe(1)
    expect(plan.skipped).toBe(2)
    expect(plan.updates.map(u => u.id)).toEqual(['p1'])
  })

  it('does not schedule published posts or overwrite scheduledAt', () => {
    const plan = planScheduling([published('p1'), approved('p2')])

    expect(plan.changed).toBe(1)
    expect(plan.skipped).toBe(1)
    expect(plan.updates).toEqual([{ id: 'p2', data: { status: 'SCHEDULED' } }])
    expect(noScheduledAt(plan.updates)).toBe(true)
  })
})

describe('planRevert — un-approve / un-schedule', () => {
  it('10. APPROVED → DRAFT clears approvedAt and audits the transition', () => {
    const plan = planRevert([approved('p1')])
    expect(plan.updates[0].data).toEqual({ status: 'DRAFT', approvedAt: null })
    expect(plan.history[0]).toMatchObject({ fromStatus: 'APPROVED', toStatus: 'DRAFT' })
  })

  it('SCHEDULED → DRAFT is modelled as compound SCHEDULED→APPROVED→DRAFT', () => {
    const plan = planRevert([scheduled('p1')])
    expect(plan.changed).toBe(1)
    expect(plan.updates[0].data).toEqual({ status: 'DRAFT', approvedAt: null })
    expect(plan.history.map(h => `${h.fromStatus}->${h.toStatus}`)).toEqual(['SCHEDULED->APPROVED', 'APPROVED->DRAFT'])
  })

  it('does not revert DRAFT or PUBLISHED posts', () => {
    const plan = planRevert([draft('p1'), { id: 'p2', workspaceId: 'w1', status: 'PUBLISHED' }])
    expect(plan.changed).toBe(0)
    expect(plan.skipped).toBe(2)
  })
})

describe('schedule-content-plan route response counts', () => {
  it('counts linked posts only from posts actually moved to SCHEDULED', () => {
    const routeSource = readFileSync('src/app/api/campaigns/[id]/schedule-content-plan/route.ts', 'utf8')

    expect(routeSource).toContain('const scheduledIds = new Set(plan.updates.map((u) => u.id))')
    expect(routeSource).toContain('scheduledIds.has(p.id) && assignmentById.has(p.id)')
    expect(routeSource).not.toContain('const linked = approvedPosts.filter((p: any) => !!integrationMap[String(p.platform)]).length')
    expect(routeSource).toContain('skipped because planned dates were missing or invalid')
    expect(routeSource).toContain("code: 'MEDIA_REVIEW_REQUIRED'")
    expect(routeSource).toContain('isContentPostMediaReadyForScheduling(post)')
  })

  it('rejects the removed compound approval and scheduling bypass', () => {
    const routeSource = readFileSync('src/app/api/campaigns/[id]/approve-content-plan/route.ts', 'utf8')

    expect(routeSource).toContain("code: 'SEPARATE_SCHEDULING_REQUIRED'")
    expect(routeSource).toContain("body?.mode === 'approve_and_schedule'")
    expect(routeSource).not.toContain("{ mode, actor: 'USER' }")
  })
})

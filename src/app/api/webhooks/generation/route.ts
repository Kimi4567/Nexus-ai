import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Webhook to update generation status from provider
export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    const { generationId, status, output, error } = data

    const generation = await prisma.generation.update({
      where: { id: generationId },
      data: {
        status,
        output,
        error,
        progress: status === 'COMPLETED' ? 100 : 50,
      },
    })

    return NextResponse.json({
      success: true,
      generation,
    })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

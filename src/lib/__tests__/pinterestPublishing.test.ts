import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPinterestPin,
  parsePinterestPostOptions,
  pinterestBoardsFromConfig,
} from '@/lib/pinterestPublishing'

afterEach(() => vi.unstubAllGlobals())

const reviewedOptions = {
  boardId: '12345',
  title: 'Reviewed launch Pin',
  altText: 'The approved product shown in a clean branded scene.',
  destinationLink: 'https://example.com/launch',
  aiDisclosureReviewed: true,
  aiDisclosureValues: ['AI_MODIFIED'],
  explicitConsent: true,
}

describe('Pinterest publishing contract', () => {
  it('keeps only authorized public publishing Boards from stored provider data', () => {
    expect(pinterestBoardsFromConfig({ boards: [
      { id: '12345', name: 'Launches', privacy: 'PUBLIC' },
      { id: '12345', name: 'Duplicate' },
      { id: 'abc', name: 'Invalid' },
      { id: '67890', name: 'Ads', isAdsOnly: true },
    ] })).toEqual([{ id: '12345', name: 'Launches', privacy: 'PUBLIC', isAdsOnly: false }])
  })

  it('fails closed without explicit destination, disclosure review, and consent', () => {
    expect(() => parsePinterestPostOptions({ ...reviewedOptions, boardId: '' })).toThrow('Board')
    expect(() => parsePinterestPostOptions({ ...reviewedOptions, aiDisclosureReviewed: false })).toThrow('disclosure')
    expect(() => parsePinterestPostOptions({ ...reviewedOptions, explicitConsent: false })).toThrow('consent')
    expect(() => parsePinterestPostOptions({ ...reviewedOptions, destinationLink: 'http://localhost/internal' })).toThrow('public HTTPS')
  })

  it('publishes an approved Cloudinary image to the exact reviewed Board', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: '998877' }), {
      status: 201,
      headers: { 'content-type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await createPinterestPin({
      accessToken: 'token',
      description: 'A reviewed description tied to the approved campaign offer.',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/pin.jpg',
      integrationConfig: { boards: [{ id: '12345', name: 'Launches' }] },
      options: reviewedOptions,
    })

    expect(result).toEqual({ pinId: '998877', platformUrl: 'https://www.pinterest.com/pin/998877/' })
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      board_id: '12345',
      title: 'Reviewed launch Pin',
      description: 'A reviewed description tied to the approved campaign offer.',
      alt_text: 'The approved product shown in a clean branded scene.',
      link: 'https://example.com/launch',
      ai_disclosures: { values: ['AI_MODIFIED'] },
      media_source: {
        source_type: 'image_url',
        url: 'https://res.cloudinary.com/demo/image/upload/pin.jpg',
        is_standard: true,
      },
    })
  })
})

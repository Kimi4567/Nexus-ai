/**
 * Storage adapter abstraction for local / cloud storage.
 * Implementations should expose `upload` and `getUrl` methods.
 */

export type UploadResult = { url: string; key?: string }

export interface StorageAdapter {
  upload: (buffer: Buffer, fileName: string, mimeType: string) => Promise<UploadResult>
  getUrl: (keyOrUrl: string) => string
}

// Local filesystem adapter (MVP)
import fs from 'fs'
import path from 'path'
import { v2 as cloudinary } from 'cloudinary'

const LOCAL_BASE = path.resolve(process.cwd(), '.storage', 'uploads')
if (!fs.existsSync(LOCAL_BASE)) fs.mkdirSync(LOCAL_BASE, { recursive: true })

// configure Cloudinary if env available
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
}

export const LocalAdapter: StorageAdapter = {
  upload: async (buffer: Buffer, fileName: string) => {
    const id = crypto.randomUUID()
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : ''
    const safeName = `${id}${ext}`
    const full = path.join(LOCAL_BASE, safeName)
    fs.writeFileSync(full, buffer)
    return { url: `/api/storage/uploads/${safeName}`, key: safeName }
  },
  getUrl: (keyOrUrl: string) => {
    if (keyOrUrl.startsWith('http')) return keyOrUrl
    return `/api/storage/uploads/${keyOrUrl}`
  },
}

// Cloudinary stub
export const CloudinaryAdapter: StorageAdapter = {
  upload: async (buffer: Buffer, fileName: string, mimeType?: string) => {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new Error('Cloudinary not configured')
    }
    const b64 = buffer.toString('base64')
    const dataUri = `data:${mimeType || 'application/octet-stream'};base64,${b64}`
    const folder = `nexus`
    const res = await cloudinary.uploader.upload(dataUri, { folder })
    return { url: res.secure_url, key: res.public_id }
  },
  getUrl: (keyOrUrl: string) => keyOrUrl,
}

// S3 stub
export const S3Adapter: StorageAdapter = {
  upload: async (_buffer: Buffer, fileName: string) => {
    return { url: `https://s3.amazonaws.com/your-bucket/${fileName}`, key: fileName }
  },
  getUrl: (keyOrUrl: string) => keyOrUrl,
}

export default LocalAdapter

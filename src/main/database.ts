import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs'
import { parseFile } from 'music-metadata'

const coverDir = join(app.getPath('userData'), 'covers')

// Initialize cover directory
export function initDatabase(): void {
  if (!existsSync(coverDir)) {
    mkdirSync(coverDir, { recursive: true })
  }
  console.log('Cover cache directory:', coverDir)
}

function getFileHash(filePath: string): string {
  const crypto = require('crypto')
  return crypto.createHash('md5').update(filePath).digest('hex')
}

// Get file extension from MIME type
function getExtFromMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('gif')) return 'gif'
  return 'jpg' // default for jpeg and unknown
}

// Extract and cache cover image to file system
export async function getSongCover(filePath: string): Promise<string | undefined> {
  try {
    // Parse and extract cover first to get correct format
    const metadata = await parseFile(filePath, { skipCovers: false })
    if (metadata.common.picture && metadata.common.picture.length > 0) {
      const pic = metadata.common.picture[0]
      
      // Normalize MIME type: handle cases where format is "JPEG", "PNG", etc.
      let mime = pic.format || 'image/jpeg'
      if (!mime.includes('/')) {
        // Convert "JPEG" -> "image/jpeg", "PNG" -> "image/png"
        mime = `image/${mime.toLowerCase()}`
      }
      
      // Convert picture data to base64 properly
      // pic.data may be Uint8Array, not Buffer
      const coverBuffer = Buffer.isBuffer(pic.data) ? pic.data : Buffer.from(pic.data)
      const coverBase64 = coverBuffer.toString('base64')
      
      const ext = getExtFromMime(mime)
      const coverPath = join(coverDir, `${getFileHash(filePath)}.${ext}`)
      
      // Check cache first (with correct extension)
      if (existsSync(coverPath)) {
        const data = readFileSync(coverPath)
        return `data:${mime};base64,${data.toString('base64')}`
      }
      
      // Save to file with correct extension
      writeFileSync(coverPath, coverBuffer)
      
      return `data:${mime};base64,${coverBase64}`
    }
  } catch (e) {
    // Ignore parse errors
    console.error('Failed to extract cover from', filePath, e)
  }
  return undefined
}

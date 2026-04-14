import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

export interface NcmMetaData {
  musicName: string
  artist: string[]
  album: string
  format: string
  bitrate: number
  duration: number
}

export interface ConversionResult {
  success: boolean
  outputPath?: string
  metadata?: NcmMetaData
  error?: string
}

/**
 * NCM 格式音频解密转换器
 */
export class NcmConverter {
  private static readonly CORE_KEY = Buffer.from('687A4852416D736F356B496E62617857', 'hex')
  private static readonly META_KEY = Buffer.from('2331346C6A6B5F215C5D2630553C2728', 'hex')
  private static readonly CHUNK_SIZE = 0x40000 // 256KB

  /**
   * 转换单个 NCM 文件
   */
  async convert(inputPath: string, outputDir?: string): Promise<ConversionResult> {
    try {
      const fileBuffer = fs.readFileSync(inputPath)
      
      // 验证 NCM 文件头
      const header = fileBuffer.slice(0, 8)
      if (header.toString('hex') !== '4354454e4644414d') {
        throw new Error('Not a valid NCM file')
      }

      let offset = 10 // 8 + 2 skip

      // 读取并解密 key_box
      const keyLength = fileBuffer.readUInt32LE(offset)
      offset += 4
      
      const keyData = this.unpad(this.aesDecrypt(fileBuffer.slice(offset, offset + keyLength), NcmConverter.CORE_KEY))
      offset += keyLength
      
      const keyBox = this.buildKeyBox(keyData.subarray(17))

      // 读取并解密元数据
      const metaLength = fileBuffer.readUInt32LE(offset)
      offset += 4
      
      const metaBuf = Buffer.from(fileBuffer.slice(offset, offset + metaLength))
      offset += metaLength
      
      // XOR 解密
      for (let i = 0; i < metaBuf.length; i++) {
        metaBuf[i] ^= 0x63
      }
      
      // Base64 解码并 AES 解密
      const metaJsonStr = this.unpad(
        this.aesDecrypt(
          Buffer.from(metaBuf.toString('utf-8', 22), 'base64'),
          NcmConverter.META_KEY
        )
      ).toString('utf-8', 6)
      
      const metadata: NcmMetaData = JSON.parse(metaJsonStr)

      // 跳过 CRC32
      offset += 9 // 4 + 5
      
      // 读取封面
      const imageLen = fileBuffer.readUInt32LE(offset)
      offset += 4
      const imageData = fileBuffer.slice(offset, offset + imageLen)
      offset += imageLen

      // 确定输出格式和路径
      const format = metadata.format || 'mp3'
      const fileName = path.basename(inputPath, '.ncm') + '.' + format
      const outputPath = outputDir 
        ? path.join(outputDir, fileName)
        : path.join(path.dirname(inputPath), fileName)

      // 确保输出目录存在
      if (outputDir && !fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true })
      }

      // 解密并写入文件
      this.decryptToFile(fileBuffer.subarray(offset), keyBox, outputPath)
      
      // 格式化艺术家信息
      const formattedArtist = this.formatArtist(metadata.artist)

      return {
        success: true,
        outputPath,
        metadata: {
          musicName: metadata.musicName,
          artist: [formattedArtist],
          album: metadata.album,
          format,
          bitrate: metadata.bitrate,
          duration: metadata.duration,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      }
    }
  }

  /**
   * 批量转换（并行处理）
   */
  async batchConvert(filePaths: string[], outputDir: string, maxConcurrent = 4): Promise<ConversionResult[]> {
    const results: ConversionResult[] = []
    
    // 确保输出目录存在
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    // 控制并发数
    for (let i = 0; i < filePaths.length; i += maxConcurrent) {
      const batch = filePaths.slice(i, i + maxConcurrent)
      const batchResults = await Promise.all(
        batch.map(file => this.convert(file, outputDir))
      )
      results.push(...batchResults)
    }

    return results
  }

  private aesDecrypt(data: Buffer, key: Buffer): Buffer {
    const cipher = crypto.createDecipheriv('aes-128-ecb', key, Buffer.alloc(0))
    return Buffer.concat([cipher.update(data), cipher.final()])
  }

  private unpad(data: Buffer): Buffer {
    const padLen = data[data.length - 1]
    return data.slice(0, data.length - padLen)
  }

  private buildKeyBox(decryptedKey: Buffer): Uint8Array {
    const keyBox = new Uint8Array(256)
    for (let i = 0; i < 256; i++) {
      keyBox[i] = i
    }

    const keyLen = decryptedKey.length
    let lastByte = 0
    let keyOffset = 0

    for (let i = 0; i < 256; i++) {
      const swap = keyBox[i]
      const c = (swap + lastByte + decryptedKey[keyOffset]) & 0xff
      keyOffset++
      if (keyOffset >= keyLen) keyOffset = 0
      keyBox[i] = keyBox[c]
      keyBox[c] = swap
      lastByte = c
    }

    return keyBox
  }

  private decryptToFile(data: Buffer, keyBox: Uint8Array, outputPath: string): void {
    const writeStream = fs.createWriteStream(outputPath)
    const chunkSize = NcmConverter.CHUNK_SIZE

    let offset = 0
    const writeChunk = () => {
      const end = Math.min(offset + chunkSize, data.length)
      const chunk = Buffer.from(data.subarray(offset, end))
      
      if (chunk.length > 0) {
        // 解密 chunk
        for (let i = 1; i <= chunk.length; i++) {
          const j = i & 0xff
          chunk[i - 1] ^= keyBox[(keyBox[j] + keyBox[(keyBox[j] + j) & 0xff]) & 0xff]
        }
        
        writeStream.write(chunk)
        offset = end
        setImmediate(writeChunk)
      } else {
        writeStream.end()
      }
    }

    writeStream.on('finish', () => {
      // 文件写入完成
    })

    writeChunk()
  }

  private formatArtist(artist: string[]): string {
    return artist
      .map(a => (Array.isArray(a) ? a[0] : a))
      .join(', ')
  }
}

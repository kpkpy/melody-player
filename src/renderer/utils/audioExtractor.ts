/**
 * 音频特征提取器（基于 Web Audio API - OfflineAudioContext）
 * 
 * 运行在 Electron Renderer 进程
 * 通过 IPC 从主进程获取音频文件数据（解决 fetch 不支持 audio:// 协议的问题）
 * 功能：从本地音频文件提取真实的音频特征
 */

export interface AudioFeatures {
  bpm: number
  tempoConfidence: number
  energy: number
  rmsEnergy: number
  dynamicRange: number
  spectralCentroid: number
  spectralFlatness: number
  spectralRolloff: number
  zeroCrossingRate: number
  key: string
  mode: 'major' | 'minor' | 'unknown'
  keyStrength: number
  danceability: number
  valence: number
  acousticness: number
  instrumentalness: number
  speechiness: number
  loudness: number
  loudnessRange: number
  featuresSource: 'audio' | 'metadata' | 'estimated'
}

const ANALYSIS_SAMPLE_RATE = 22050
const FFT_SIZE = 2048

/**
 * 从主进程加载音频文件数据 → PCM AudioBuffer
 * 使用 IPC 而非 fetch，因为 fetch 不支持 audio:// 协议
 */
async function loadAudio(fileUrl: string): Promise<AudioBuffer> {
  const filePath = fileUrl.startsWith('audio://') ? fileUrl.slice(8) : fileUrl
  
  const arrayBuffer: ArrayBuffer | null = await window.electron.audioFeatures.loadAudioFile(filePath)
  
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error(`Failed to load audio file: ${filePath}`)
  }
  
  const audioContext = new AudioContext()
  try {
    return await audioContext.decodeAudioData(arrayBuffer)
  } catch (e) {
    throw new Error(`Failed to decode audio: ${e instanceof Error ? e.message : 'Unknown error'}`)
  } finally {
    await audioContext.close()
  }
}

function convertToMono(channels: Float32Array[], numChannels: number, length: number): Float32Array {
  const mono = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    let sum = 0
    for (let ch = 0; ch < numChannels; ch++) {
      sum += channels[ch][i]
    }
    mono[i] = sum / numChannels
  }
  return mono
}

function computeRms(samples: Float32Array): number {
  let sum = 0
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i]
  }
  return Math.sqrt(sum / samples.length)
}

function computeZeroCrossingRate(samples: Float32Array): number {
  let crossings = 0
  for (let i = 1; i < samples.length; i++) {
    if ((samples[i] >= 0 && samples[i - 1] < 0) || (samples[i] < 0 && samples[i - 1] >= 0)) {
      crossings++
    }
  }
  return crossings / samples.length
}

function computeSpectralCentroid(analyser: AnalyserNode, frequencyData: Uint8Array): number {
  analyser.getByteFrequencyData(frequencyData)
  
  let weightedSum = 0
  let totalWeight = 0
  const binCount = analyser.frequencyBinCount
  const nyquist = ANALYSIS_SAMPLE_RATE / 2
  
  for (let i = 0; i < binCount; i++) {
    const frequency = (i / binCount) * nyquist
    const magnitude = frequencyData[i]
    weightedSum += frequency * magnitude
    totalWeight += magnitude
  }
  
  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

function computeSpectralRolloff(analyser: AnalyserNode, frequencyData: Uint8Array, rolloffPercent: number = 0.85): number {
  analyser.getByteFrequencyData(frequencyData)
  
  let totalSum = 0
  for (let i = 0; i < analyser.frequencyBinCount; i++) {
    totalSum += frequencyData[i]
  }
  
  let cumulativeSum = 0
  const nyquist = ANALYSIS_SAMPLE_RATE / 2
  
  for (let i = 0; i < analyser.frequencyBinCount; i++) {
    cumulativeSum += frequencyData[i]
    if (totalSum > 0 && cumulativeSum >= totalSum * rolloffPercent) {
      return (i / analyser.frequencyBinCount) * nyquist
    }
  }
  
  return nyquist
}

function computeSpectralFlatness(analyser: AnalyserNode, frequencyData: Uint8Array): number {
  analyser.getByteFrequencyData(frequencyData)
  
  const binCount = analyser.frequencyBinCount
  let logSum = 0
  let linearSum = 0
  let zeroCount = 0
  
  for (let i = 0; i < binCount; i++) {
    const mag = frequencyData[i] / 255
    if (mag > 0.0001) {
      logSum += Math.log(mag)
    } else {
      zeroCount++
    }
    linearSum += mag
  }
  
  if (zeroCount > binCount * 0.8) return 0.1
  if (linearSum === 0) return 1
  
  const geometricMean = Math.exp(logSum / (binCount - zeroCount))
  const arithmeticMean = linearSum / binCount
  
  return arithmeticMean > 0 ? Math.min(1, geometricMean / arithmeticMean) : 0
}

function computeBpm(samples: Float32Array): { bpm: number; confidence: number } {
  const frameSize = 1024
  const hopSize = 512
  const numFrames = Math.floor((samples.length - frameSize) / hopSize)
  
  if (numFrames < 2) return { bpm: 100, confidence: 0.3 }
  
  const frameEnergies = new Float32Array(numFrames)
  for (let f = 0; f < numFrames; f++) {
    const offset = f * hopSize
    let energy = 0
    for (let i = 0; i < frameSize; i++) {
      energy += samples[offset + i] * samples[offset + i]
    }
    frameEnergies[f] = Math.sqrt(energy / frameSize)
  }
  
  const diff = new Float32Array(numFrames - 1)
  for (let i = 1; i < numFrames; i++) {
    diff[i - 1] = Math.max(0, frameEnergies[i] - frameEnergies[i - 1])
  }
  
  const minBpm = 40
  const maxBpm = 240
  const frameRate = ANALYSIS_SAMPLE_RATE / hopSize
  
  let bestBpm = 120
  let bestCorr = -1
  
  for (let targetBpm = minBpm; targetBpm <= maxBpm; targetBpm += 0.5) {
    const lag = Math.round(frameRate * 60 / targetBpm)
    if (lag < 1 || lag >= diff.length - 1) continue
    
    let correlation = 0
    let count = 0
    
    for (let i = 0; i < diff.length - lag; i += lag) {
      let maxVal = 0
      const searchHalf = Math.max(1, Math.floor(lag * 0.2))
      for (let j = -searchHalf; j <= searchHalf; j++) {
        const idx = i + lag + j
        if (idx >= 0 && idx < diff.length && diff[idx] > maxVal) {
          maxVal = diff[idx]
        }
      }
      
      if (maxVal > 0.01) {
        correlation += maxVal
        count++
      }
    }
    
    if (count > 0) {
      correlation /= count
      if (correlation > bestCorr) {
        bestCorr = correlation
        bestBpm = targetBpm
      }
    }
  }
  
  const maxDiff = Math.max(...diff.slice(0, Math.min(100, diff.length)))
  const confidence = maxDiff > 0 ? Math.min(1, bestCorr / maxDiff) : 0.3
  
  if (bestBpm > 220) bestBpm /= 2
  if (bestBpm < 50 && bestBpm * 2 <= 200) bestBpm *= 2
  
  return { bpm: Math.max(40, Math.round(bestBpm)), confidence: Math.max(0.2, Math.min(0.9, confidence)) }
}

function computeLoudness(samples: Float32Array): { loudness: number; loudnessRange: number } {
  const windowSize = 400
  const hopSize = 200
  const numWindows = Math.floor((samples.length - windowSize) / hopSize)
  
  if (numWindows < 2) return { loudness: -14, loudnessRange: 5 }
  
  const windowLevels = new Float32Array(numWindows)
  for (let w = 0; w < numWindows; w++) {
    let sum = 0
    const offset = w * hopSize
    for (let i = 0; i < windowSize; i++) {
      sum += samples[offset + i] * samples[offset + i]
    }
    const rms = Math.sqrt(sum / windowSize)
    windowLevels[w] = 20 * Math.log10(rms + 1e-10)
  }
  
  const sorted = [...windowLevels].sort((a, b) => a - b)
  const p10 = sorted[Math.floor(sorted.length * 0.1)]
  const p90 = sorted[Math.floor(sorted.length * 0.9)]
  const median = sorted[Math.floor(sorted.length * 0.5)]
  
  return {
    loudness: Math.round(median * 10) / 10,
    loudnessRange: Math.round((p90 - p10) * 10) / 10,
  }
}

function computeKeyAndMode(samples: Float32Array): { key: string; mode: 'major' | 'minor' | 'unknown'; keyStrength: number } {
  const audioContext = new AudioContext({ sampleRate: ANALYSIS_SAMPLE_RATE })
  const buffer = audioContext.createBuffer(1, samples.length, ANALYSIS_SAMPLE_RATE)
  buffer.copyToChannel(samples, 0)
  
  const source = audioContext.createBufferSource()
  source.buffer = buffer
  
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 4096
  analyser.smoothingTimeConstant = 0.3
  
  source.connect(analyser)
  source.start()
  source.stop(buffer.duration)
  
  const frequencyData = new Uint8Array(analyser.frequencyBinCount)
  let totalChroma = new Float64Array(12)
  let samplesCollected = 0
  
  for (let i = 0; i < 50; i++) {
    analyser.getByteFrequencyData(frequencyData)
    
    const chroma = new Float64Array(12)
    const nyquist = ANALYSIS_SAMPLE_RATE / 2
    
    for (let j = 0; j < analyser.frequencyBinCount; j++) {
      const freq = (j / analyser.frequencyBinCount) * nyquist
      if (freq < 40 || freq > 4000) continue
      
      const midiNote = 69 + 12 * Math.log2(freq / 440)
      const pitchClass = ((Math.round(midiNote) % 12) + 12) % 12
      chroma[pitchClass] += frequencyData[j] / 255
    }
    
    const maxVal = Math.max(...chroma)
    if (maxVal > 0) {
      for (let j = 0; j < 12; j++) {
        chroma[j] /= maxVal
      }
      totalChroma = totalChroma.map((v, idx) => v + chroma[idx])
      samplesCollected++
    }
  }
  
  audioContext.close()
  
  if (samplesCollected === 0) {
    return { key: 'C', mode: 'unknown', keyStrength: 0 }
  }
  
  const avgChroma = totalChroma.map(v => v / samplesCollected)
  const keyStrength = Math.max(...avgChroma)
  
  const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
  
  const majorProfile = [6.35, 2.23, 3.48, 2.36, 4.54, 4.08, 2.14, 4.96, 2.67, 3.32, 2.39, 3.47]
  const minorProfile = [6.35, 2.68, 3.52, 5.38, 2.28, 4.67, 2.68, 3.98, 3.67, 2.2, 4.95, 2.49]
  
  let bestKeyIdx = 0
  let bestScore = -Infinity
  let bestMode: 'major' | 'minor' = 'major'
  
  for (let k = 0; k < 12; k++) {
    const rotated = avgChroma.slice(k).concat(avgChroma.slice(0, k))
    const majorCorr = rotated.reduce((sum, v, i) => sum + v * majorProfile[i], 0)
    const minorCorr = rotated.reduce((sum, v, i) => sum + v * minorProfile[i], 0)
    
    if (majorCorr > bestScore) {
      bestScore = majorCorr
      bestKeyIdx = k
      bestMode = 'major'
    }
    if (minorCorr > bestScore) {
      bestScore = minorCorr
      bestKeyIdx = k
      bestMode = 'minor'
    }
  }
  
  return {
    key: keyNames[bestKeyIdx],
    mode: bestMode,
    keyStrength: Math.max(0, Math.min(1, keyStrength)),
  }
}

export async function extractFeatures(fileUrl: string): Promise<AudioFeatures> {
  const audioBuffer = await loadAudio(fileUrl)
  
  const numChannels = audioBuffer.numberOfChannels
  const channels = Array.from({ length: numChannels }, (_, i) => audioBuffer.getChannelData(i))
  const samples = convertToMono(channels, numChannels, audioBuffer.length)
  
  let analysisSamples: Float32Array
  if (audioBuffer.sampleRate > ANALYSIS_SAMPLE_RATE) {
    const ratio = audioBuffer.sampleRate / ANALYSIS_SAMPLE_RATE
    const targetLength = Math.ceil(audioBuffer.length / ratio)
    analysisSamples = new Float32Array(targetLength)
    for (let i = 0; i < targetLength; i++) {
      const srcIndex = Math.floor(i * ratio)
      analysisSamples[i] = samples[Math.min(srcIndex, samples.length - 1)]
    }
  } else {
    analysisSamples = samples
  }
  
  const rtContext = new AudioContext({ sampleRate: ANALYSIS_SAMPLE_RATE })
  const rtBuffer = rtContext.createBuffer(1, analysisSamples.length, ANALYSIS_SAMPLE_RATE)
  rtBuffer.copyToChannel(analysisSamples, 0)
  
  const rtSource = rtContext.createBufferSource()
  rtSource.buffer = rtBuffer
  
  const rtAnalyser = rtContext.createAnalyser()
  rtAnalyser.fftSize = FFT_SIZE
  rtAnalyser.smoothingTimeConstant = 0.8
  
  rtSource.connect(rtAnalyser)
  rtSource.start()
  rtSource.stop(audioBuffer.duration)
  
  const frequencyData = new Uint8Array(rtAnalyser.frequencyBinCount)
  rtAnalyser.getByteFrequencyData(frequencyData)
  
  const rms = computeRms(analysisSamples)
  const zcr = computeZeroCrossingRate(analysisSamples)
  const spectralCentroid = computeSpectralCentroid(rtAnalyser, frequencyData)
  const spectralRolloff = computeSpectralRolloff(rtAnalyser, frequencyData)
  const spectralFlatness = computeSpectralFlatness(rtAnalyser, frequencyData)
  const { bpm, confidence: tempoConfidence } = computeBpm(analysisSamples)
  const { loudness, loudnessRange } = computeLoudness(analysisSamples)
  const { key, mode, keyStrength } = computeKeyAndMode(analysisSamples)
  
  rtContext.close()
  
  const energy = clamp(rms * 2 + (spectralCentroid / 5000) * 0.3 + (bpm / 200) * 0.2)
  const danceability = clamp(
    (1 - Math.abs(bpm - 120) / 120) * 0.4 +
    tempoConfidence * 0.3 +
    (zcr > 0.1 ? 0.3 : rms * 2) * 0.3
  )
  
  const majorFactor = mode === 'major' ? 0.6 : 0.3
  const valence = clamp(
    majorFactor * 0.4 +
    Math.min(1, spectralCentroid / 4000) * 0.3 +
    (1 - Math.abs(normalizeTempo(bpm, 70, 150))) * 0.2 +
    0.5 - Math.abs(rms - 0.3) * 0.1
  )
  
  const acousticness = clamp(
    (1 - spectralFlatness) * 0.4 +
    (spectralCentroid < 3000 ? 0.3 : 0) +
    (1 - energy) * 0.2
  )
  
  const instrumentalness = clamp(
    (1 - zcr) * 0.3 +
    (spectralFlatness < 0.1 ? 0.4 : 0) +
    (bpm > 60 && bpm < 180 ? 0.3 : 0.1)
  )
  
  const speechiness = clamp(zcr * 2 + (spectralCentroid > 3000 ? 0.3 : 0))
  
  return {
    bpm,
    tempoConfidence,
    energy,
    rmsEnergy: rms,
    dynamicRange: clamp(loudnessRange / 40),
    spectralCentroid: Math.round(spectralCentroid),
    spectralFlatness: Math.round(spectralFlatness * 100) / 100,
    spectralRolloff: Math.round(spectralRolloff),
    zeroCrossingRate: Math.round(zcr * 100) / 100,
    key,
    mode,
    keyStrength: Math.round(keyStrength * 100) / 100,
    danceability: Math.round(danceability * 100) / 100,
    valence: Math.round(valence * 100) / 100,
    acousticness: Math.round(acousticness * 100) / 100,
    instrumentalness: Math.round(instrumentalness * 100) / 100,
    speechiness: Math.round(speechiness * 100) / 100,
    loudness,
    loudnessRange,
    featuresSource: 'audio' as const,
  }
}

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function normalizeTempo(bpm: number, slow: number, fast: number): number {
  if (bpm <= slow) return -1
  if (bpm >= fast) return 1
  return ((bpm - slow) / (fast - slow)) * 2 - 1
}

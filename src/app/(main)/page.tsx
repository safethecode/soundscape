'use client'

import { useState } from 'react'
import AudioSpectrum from '@/components/AudioSpectrum'
import AudioSidebar from '@/components/AudioSidebar'

type LPFFrequency = 0.25 | 0.5 | 1
type FFTSize = 1024 | 2048 | 4096

export default function Main() {
  const [audioContext, setAudioContext] = useState<AudioContext>()
  const [source, setSource] = useState<MediaStreamAudioSourceNode>()
  const [lpfFrequency, setLpfFrequency] = useState<LPFFrequency>(1)
  const [fftSize, setFftSize] = useState<FFTSize>(2048)
  const [averageType, setAverageType] = useState<'LPF' | 'FIFO'>('LPF')
  const [visualType, setVisualType] = useState<'line' | 'bar'>('line')

  const handleSourceChange = (stream: MediaStream) => {
    if (!audioContext) {
      const newContext = new AudioContext()
      setAudioContext(newContext)
      setSource(newContext.createMediaStreamSource(stream))
    } else {
      if (source) {
        source.disconnect()
      }
      setSource(audioContext.createMediaStreamSource(stream))
    }
  }

  return (
    <main className="flex min-h-screen">
      <div className="flex-1">
        {audioContext && source && (
          <AudioSpectrum
            audioContext={audioContext}
            source={source}
            onSourceChange={handleSourceChange}
            lpfFrequency={lpfFrequency}
            onLpfFrequencyChange={setLpfFrequency}
            fftSize={fftSize}
            averageType={averageType}
            visualType={visualType}
            onVisualTypeChange={setVisualType}
          />
        )}
      </div>
      <AudioSidebar
        audioContext={audioContext}
        source={source}
        onSourceChange={handleSourceChange}
        lpfFrequency={lpfFrequency}
        onLpfFrequencyChange={setLpfFrequency}
        fftSize={fftSize}
        onFftSizeChange={setFftSize}
        averageType={averageType}
        onAverageTypeChange={setAverageType}
      />
    </main>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import ComplexArray from '@/lib/complex_array'
import { FFT } from '@/lib/fft'
import { LowPassFilter, FIFOFilter } from '@/lib/filters'

type AverageType = 'LPF' | 'FIFO'
type LPFFrequency = 0.25 | 0.5 | 1

interface AudioSpectrumProps {
  width?: number;
  height?: number;
}

export default function AudioSpectrum({ width = 800, height = 400 }: AudioSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext>()
  const sourceRef = useRef<MediaStreamAudioSourceNode>()
  const scriptProcessorRef = useRef<ScriptProcessorNode>()
  const lpfFiltersRef = useRef<LowPassFilter[]>([])
  const fifoFiltersRef = useRef<FIFOFilter[]>([])

  const [averageType, setAverageType] = useState<AverageType>('LPF')
  const [lpfFrequency, setLpfFrequency] = useState<LPFFrequency>(1)
  const [fifoCount, setFifoCount] = useState<number>(4)

  const calculateAlpha = (frequency: number) => {
    // T = 1/frequency (period)
    // α = 1 - e^(-2π × frequency × Δt)
    // Δt = 1/60 (assuming 60fps)
    return 1 - Math.exp(-2 * Math.PI * frequency / 60)
  }

  useEffect(() => {
    // LPF 주파수가 변경될 때마다 필터 재설정
    lpfFiltersRef.current = Array(1024) // FFT size의 절반
      .fill(null)
      .map(() => new LowPassFilter(lpfFrequency))
  }, [lpfFrequency])

  const applyLPF = (currentData: Float32Array) => {
    if (lpfFiltersRef.current.length !== currentData.length) {
      lpfFiltersRef.current = Array(currentData.length)
        .fill(null)
        .map(() => new LowPassFilter(lpfFrequency))
    }

    const filtered = new Float32Array(currentData.length)
    for (let i = 0; i < currentData.length; i++) {
      filtered[i] = lpfFiltersRef.current[i].process(currentData[i])
    }
    return filtered
  }

  const applyFIFO = (currentData: Float32Array) => {
    if (fifoFiltersRef.current.length !== currentData.length) {
      fifoFiltersRef.current = Array(currentData.length)
        .fill(null)
        .map(() => new FIFOFilter(fifoCount))
    }

    const filtered = new Float32Array(currentData.length)
    for (let i = 0; i < currentData.length; i++) {
      filtered[i] = fifoFiltersRef.current[i].process(currentData[i])
    }
    return filtered
  }

  const calculateFFT = (timeData: Float32Array) => {
    const complexArray = new ComplexArray(timeData.length)
    for (let i = 0; i < timeData.length; i++) {
      complexArray.real[i] = timeData[i]
      complexArray.imag[i] = 0
    }

    FFT(complexArray)

    // Calculate magnitude in dB
    const magnitudes = new Float32Array(complexArray.length / 2)
    for (let i = 0; i < magnitudes.length; i++) {
      const r = complexArray.real[i]
      const im = complexArray.imag[i]
      const magnitude = Math.sqrt(r * r + im * im)
      magnitudes[i] = 20 * Math.log10(magnitude + 1e-10)
    }

    return magnitudes
  }

  useEffect(() => {
    const processAudioData = (event: AudioProcessingEvent) => {
      const inputData = event.inputBuffer.getChannelData(0)
      const fftData = calculateFFT(inputData)

      // 필터 적용
      const filteredData = averageType === 'LPF'
        ? applyLPF(fftData)
        : applyFIFO(fftData)

      drawSpectrum(filteredData)
    }

    const initAudio = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(stream)
        const scriptProcessor = audioContext.createScriptProcessor(2048, 1, 1)

        scriptProcessor.onaudioprocess = processAudioData
        source.connect(scriptProcessor)
        scriptProcessor.connect(audioContext.destination)

        audioContextRef.current = audioContext
        sourceRef.current = source
        scriptProcessorRef.current = scriptProcessor

      } catch (err) {
        console.error('Error accessing microphone:', err)
      }
    }

    initAudio()

    return () => {
      if (scriptProcessorRef.current) {
        scriptProcessorRef.current.disconnect()
      }
      if (sourceRef.current) {
        sourceRef.current.disconnect()
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
      }
    }
  }, [averageType]) // averageType이 변경될 때마다 재초기화

  useEffect(() => {
    fifoFiltersRef.current.forEach(filter => {
      if (filter) filter.resize(fifoCount)
    })
  }, [fifoCount])

  const drawSpectrum = (fftData: Float32Array) => {
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = 'rgb(0, 0, 0)'
    ctx.fillRect(0, 0, width, height)

    // Draw grid and labels
    drawGrid(ctx)

    // Draw frequency bars with interpolation
    const barWidth = (width / fftData.length) * 2.5
    ctx.beginPath()
    ctx.moveTo(0, height)

    for (let i = 0; i < fftData.length; i++) {
      const dbValue = Math.max(Math.min(fftData[i], 40), -140) // 값 범위 제한
      const normalizedHeight = (dbValue + 140) / 180 // -140 ~ 40 범위를 0 ~ 1로 정규화
      const barHeight = normalizedHeight * height
      const x = i * (barWidth + 1)

      if (i === 0) {
        ctx.lineTo(x, height - barHeight)
      } else {
        ctx.lineTo(x, height - barHeight)
      }
    }

    // 그래프 스타일 설정
    ctx.lineTo(width, height)
    ctx.fillStyle = 'rgba(0, 191, 255, 0.5)'
    ctx.strokeStyle = 'rgb(0, 191, 255)'
    ctx.lineWidth = 2

    // 그래프 채우기와 선 그리기
    ctx.fill()
    ctx.stroke()
  }

  const drawGrid = (ctx: CanvasRenderingContext2D) => {
    ctx.strokeStyle = 'rgba(128, 128, 128, 0.2)'
    ctx.lineWidth = 1

    // 수평 그리드 라인과 dB 레이블
    for (let db = -140; db <= 40; db += 10) {
      const y = height * (1 - (db + 140) / 180)

      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()

      // dB 레이블
      ctx.fillStyle = 'rgba(128, 128, 128, 0.8)'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${db}dB`, 30, y + 4)
    }

    // 주파수 레이블 (기존과 동일)
    const freqLabels = ['31.5', '63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k']
    const step = width / (freqLabels.length - 1)

    ctx.textAlign = 'center'
    freqLabels.forEach((label, i) => {
      const x = i * step
      ctx.fillText(label, x, height - 5)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <select
          value={averageType}
          onChange={(e) => setAverageType(e.target.value as AverageType)}
          className="bg-gray-800 text-white p-2 rounded"
        >
          <option value="LPF">LPF</option>
          <option value="FIFO">FIFO</option>
        </select>

        {averageType === 'LPF' ? (
          <select
            value={lpfFrequency}
            onChange={(e) => setLpfFrequency(Number(e.target.value) as LPFFrequency)}
            className="bg-gray-800 text-white p-2 rounded"
          >
            <option value={0.25}>0.25Hz</option>
            <option value={0.5}>0.5Hz</option>
            <option value={1}>1Hz</option>
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="1"
              max="32"
              value={fifoCount}
              onChange={(e) => setFifoCount(Number(e.target.value))}
              className="w-32"
            />
            <span className="text-white min-w-12">{fifoCount}</span>
          </div>
        )}
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="bg-black rounded"
      />
    </div>
  )
} 
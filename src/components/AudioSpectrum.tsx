'use client'

import { useEffect, useRef, useState } from 'react'
import ComplexArray from '@/lib/complex_array'
import { FFT } from '@/lib/fft'
import { LowPassFilter, FIFOFilter } from '@/lib/filters'
import AudioSpectrumHeader from './AudioSpectrumHeader'

type LPFFrequency = 0.25 | 0.5 | 1

interface AudioSpectrumProps {
  width?: number;
  height?: number;
  audioContext: AudioContext;
  source: MediaStreamAudioSourceNode;
  onSourceChange: (stream: MediaStream) => void;
  lpfFrequency: LPFFrequency;
  fftSize: number;
  onLpfFrequencyChange: (freq: LPFFrequency) => void;
  averageType: 'LPF' | 'FIFO';
  visualType: 'line' | 'bar';
  onVisualTypeChange: (type: 'line' | 'bar') => void;
}

interface Point {
  frequency: number;
  decibel: number;
  clientX: number;
  clientY: number;
}

export default function AudioSpectrum({ width = 800, height = 400, audioContext, source, onSourceChange, lpfFrequency, fftSize, onLpfFrequencyChange, averageType, visualType, onVisualTypeChange }: AudioSpectrumProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext>()
  const sourceRef = useRef<MediaStreamAudioSourceNode>()
  const scriptProcessorRef = useRef<ScriptProcessorNode>()
  const lpfFiltersRef = useRef<LowPassFilter[]>([])
  const fifoFiltersRef = useRef<FIFOFilter[]>([])

  const [fifoCount, setFifoCount] = useState<number>(4)
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null);

  const calculateAlpha = (frequency: number) => {
    // T = 1/frequency (period)
    // α = 1 - e^(-2π × frequency × Δt)
    // Δt = 1/60 (assuming 60fps)
    return 1 - Math.exp(-2 * Math.PI * frequency / 60)
  }

  useEffect(() => {
    lpfFiltersRef.current = Array(fftSize / 2)
      .fill(null)
      .map(() => new LowPassFilter(lpfFrequency))
  }, [lpfFrequency, fftSize])

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
        const scriptProcessor = audioContext.createScriptProcessor(fftSize, 1, 1)

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

    if (!audioContextRef.current) {
      initAudio()
    }

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
  }, [averageType, fftSize])

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

    // Draw grid and labels first
    drawGrid(ctx)

    // 그래프를 그리드 내부에 맞추기 위한 여백 설정
    const marginLeft = 40  // dB 레이블을 위한 왼쪽 여백
    const marginBottom = 20  // 주파수 레이블을 위한 아래쪽 여백
    const graphWidth = width - marginLeft
    const graphHeight = height - marginBottom

    const barWidth = (graphWidth / fftData.length) * 2.5

    if (visualType === 'bar') {
      for (let i = 0; i < fftData.length; i++) {
        const dbValue = Math.max(Math.min(fftData[i], 40), -140)
        const normalizedHeight = (dbValue + 140) / 180
        const barHeight = normalizedHeight * graphHeight
        const x = marginLeft + i * (barWidth + 1)

        const gradient = ctx.createLinearGradient(0, height - marginBottom, 0, height - marginBottom - barHeight)
        gradient.addColorStop(0, 'rgba(0, 191, 255, 0.8)')
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0.4)')

        ctx.fillStyle = gradient
        ctx.fillRect(x, height - marginBottom - barHeight, barWidth, barHeight)

        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        ctx.fillRect(x, height - marginBottom - barHeight, barWidth, 2)
      }
    } else {
      ctx.beginPath()
      ctx.moveTo(marginLeft, height - marginBottom)
      let prevHeight = 0

      for (let i = 0; i < fftData.length; i++) {
        const dbValue = Math.max(Math.min(fftData[i], 40), -140)
        const normalizedHeight = (dbValue + 140) / 180
        const barHeight = normalizedHeight * graphHeight
        const x = marginLeft + i * (barWidth + 1)

        if (i === 0) {
          ctx.lineTo(x, height - marginBottom - barHeight)
        } else {
          ctx.bezierCurveTo(
            x - (barWidth + 1) * 0.5, height - marginBottom - prevHeight,
            x - (barWidth + 1) * 0.5, height - marginBottom - barHeight,
            x, height - marginBottom - barHeight
          )
        }
        prevHeight = barHeight
      }

      ctx.lineTo(width, height - marginBottom)

      const gradient = ctx.createLinearGradient(0, 0, 0, graphHeight)
      gradient.addColorStop(0, 'rgba(0, 255, 255, 0.5)')
      gradient.addColorStop(1, 'rgba(0, 191, 255, 0.2)')

      ctx.fillStyle = gradient
      ctx.strokeStyle = 'rgb(0, 191, 255)'
      ctx.lineWidth = 2

      ctx.fill()
      ctx.stroke()
    }
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

  const getFrequencyAtX = (x: number) => {
    const freqMin = 20;
    const freqMax = 20000;
    const xNormalized = x / width;
    return Math.round(freqMin * Math.pow(freqMax / freqMin, xNormalized));
  }

  const getDecibelAtY = (y: number) => {
    const yNormalized = 1 - (y / height);
    return Math.round(-140 + yNormalized * 180);
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setHoveredPoint({
      frequency: getFrequencyAtX(x),
      decibel: getDecibelAtY(y),
      clientX: e.clientX,  // 마우스 위치 저장
      clientY: e.clientY
    });
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  useEffect(() => {
    // visualType이 변경될 때마다 캔버스 초기화
    if (!canvasRef.current) return
    const ctx = canvasRef.current.getContext('2d')
    if (!ctx) return

    // 캔버스 초기화
    ctx.fillStyle = 'rgb(0, 0, 0)'
    ctx.fillRect(0, 0, width, height)
    // 현재 오디오 데이터로 다시 그리기
    if (scriptProcessorRef.current) {
      const inputData = new Float32Array(fftSize)
      const fftData = calculateFFT(inputData)
      const filteredData = averageType === 'LPF'
        ? applyLPF(fftData)
        : applyFIFO(fftData)
      drawSpectrum(filteredData)
    }
  }, [visualType]) // visualType이 변경될 때만 실행

  return (
    <div className="flex flex-col gap-4">
      <AudioSpectrumHeader
        visualType={visualType}
        onVisualTypeChange={onVisualTypeChange}
      />

      {hoveredPoint && (
        <div className="absolute bg-gray-900 text-white px-3 py-1.5 rounded-md text-sm pointer-events-none"
          style={{ left: `${hoveredPoint.clientX + 10}px`, top: `${hoveredPoint.clientY + 10}px` }}>
          {hoveredPoint.frequency.toFixed(1)}Hz
          <br />
          {hoveredPoint.decibel.toFixed(1)}dB
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="bg-black rounded-lg"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      />
    </div>
  )
} 
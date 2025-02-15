"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import ComplexArray from "@/lib/complex_array"
import { FFT } from "@/lib/fft"
import { LowPassFilter, FIFOFilter } from "@/lib/filters"
import AudioSpectrumHeader from "./AudioSpectrumHeader"

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
  averageType: "LPF" | "FIFO";
  visualType: "line" | "bar";
  onVisualTypeChange: (type: "line" | "bar") => void;
}

interface Point {
  frequency: number;
  decibel: number;
  clientX: number;
  clientY: number;
}

export default function AudioSpectrum({
  width = window.innerWidth - 288, // 기본값을 window 너비로 변경
  height = window.innerHeight - 48, // 헤더 높이(48px)를 제외한 window 높이
  audioContext,
  source,
  onSourceChange,
  lpfFrequency,
  fftSize,
  onLpfFrequencyChange,
  averageType,
  visualType,
  onVisualTypeChange
}: AudioSpectrumProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const audioContextRef = useRef<AudioContext>()
  const sourceRef = useRef<MediaStreamAudioSourceNode>()
  const scriptProcessorRef = useRef<ScriptProcessorNode>()
  const lpfFiltersRef = useRef<LowPassFilter[]>([])
  const fifoFiltersRef = useRef<FIFOFilter[]>([])
  const lineGraphRef = useRef<SVGSVGElement>(null)
  const barGraphRef = useRef<SVGSVGElement>(null)

  const margin = { top: 30, right: 40, bottom: 40, left: 60 }
  const graphWidth = width - margin.left - margin.right
  const graphHeight = height - margin.top - margin.bottom

  const [fifoCount, setFifoCount] = useState<number>(4)
  const [hoveredPoint, setHoveredPoint] = useState<Point | null>(null)

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
      const filteredData = averageType === "LPF"
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
        console.error("Error accessing microphone:", err)
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
    // 두 그래프 모두 그리기
    [lineGraphRef, barGraphRef].forEach((ref, index) => {
      if (!ref.current) return

      const svg = d3.select(ref.current)
      svg.selectAll("*").remove()

      const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`)

      // 배경 그리드
      g.append("rect")
        .attr("width", graphWidth)
        .attr("height", graphHeight)
        .attr("fill", "rgba(0, 0, 0, 0.3)")
        .attr("rx", 8) // 모서리 둥글게

      // X축 스케일 (주파수)
      const xScale = d3.scaleLog()
        .domain([20, 20000])
        .range([0, graphWidth])

      // Y축 스케일 (데시벨)
      const yScale = d3.scaleLinear()
        .domain([-140, 0])
        .range([graphHeight, 0])

      // X축 그리드
      const xGrid = d3.axisBottom(xScale)
        .tickSize(-graphHeight)
        .tickFormat(() => '')
        .ticks(10)

      g.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${graphHeight})`)
        .call(xGrid)
        .attr("color", "rgba(255, 255, 255, 0.1)")
        .style("stroke-dasharray", "3,3")

      // Y축 그리드
      const yGrid = d3.axisLeft(yScale)
        .tickSize(-graphWidth)
        .tickFormat(() => '')
        .ticks(10)

      g.append("g")
        .attr("class", "grid")
        .call(yGrid)
        .attr("color", "rgba(255, 255, 255, 0.1)")
        .style("stroke-dasharray", "3,3")

      // X축
      g.append("g")
        .attr("transform", `translate(0,${graphHeight})`)
        .call(d3.axisBottom(xScale)
          .tickFormat(d => {
            if (+d >= 1000) return `${+d / 1000}k`
            return d.toString()
          }))
        .attr("color", "rgba(255, 255, 255, 0.7)")
        .style("font-size", "12px")
        .select(".domain")
        .attr("stroke", "rgba(255, 255, 255, 0.7)")

      // Y축
      g.append("g")
        .call(d3.axisLeft(yScale))
        .attr("color", "rgba(255, 255, 255, 0.7)")
        .style("font-size", "12px")
        .select(".domain")
        .attr("stroke", "rgba(255, 255, 255, 0.7)")

      // 데이터 포인트 생성
      const points = Array.from(fftData).map((value, i) => ({
        frequency: 20 * Math.pow(20000 / 20, i / fftData.length),
        decibel: Math.max(Math.min(value, 0), -140)
      }))

      if (index === 1) { // barGraphRef
        // 막대 그래프
        g.selectAll("rect.bar")
          .data(points)
          .enter()
          .append("rect")
          .attr("class", "bar")
          .attr("x", d => xScale(d.frequency))
          .attr("y", d => yScale(d.decibel))
          .attr("width", 2)
          .attr("height", d => graphHeight - yScale(d.decibel))
          .attr("fill", "rgb(0, 191, 255)")
          .attr("opacity", 0.8)
      } else { // lineGraphRef
        // 라인 그래프
        const line = d3.line<{ frequency: number, decibel: number }>()
          .x(d => xScale(d.frequency))
          .y(d => yScale(d.decibel))
          .curve(d3.curveMonotoneX)

        // 그라데이션 정의
        const gradient = g.append("defs")
          .append("linearGradient")
          .attr("id", `line-gradient-${index}`)
          .attr("gradientUnits", "userSpaceOnUse")
          .attr("x1", 0)
          .attr("y1", yScale(-140))
          .attr("x2", 0)
          .attr("y2", yScale(0))

        gradient.append("stop")
          .attr("offset", "0%")
          .attr("stop-color", "rgba(0, 191, 255, 0.1)")

        gradient.append("stop")
          .attr("offset", "100%")
          .attr("stop-color", "rgba(0, 191, 255, 0.8)")

        // 영역 그래프
        const area = d3.area<{ frequency: number, decibel: number }>()
          .x(d => xScale(d.frequency))
          .y0(graphHeight)
          .y1(d => yScale(d.decibel))
          .curve(d3.curveMonotoneX)

        g.append("path")
          .datum(points)
          .attr("fill", `url(#line-gradient-${index})`)
          .attr("d", area)

        // 라인
        g.append("path")
          .datum(points)
          .attr("fill", "none")
          .attr("stroke", "rgb(0, 191, 255)")
          .attr("stroke-width", 2)
          .attr("d", line)
      }

      // 축 레이블
      g.append("text")
        .attr("transform", `translate(${-margin.left + 16},${graphHeight / 2}) rotate(-90)`)
        .style("text-anchor", "middle")
        .style("fill", "rgba(255, 255, 255, 0.7)")
        .style("font-size", "14px")
        .text("Amplitude (dB)")

      g.append("text")
        .attr("transform", `translate(${graphWidth / 2},${graphHeight + margin.bottom - 10})`)
        .style("text-anchor", "middle")
        .style("fill", "rgba(255, 255, 255, 0.7)")
        .style("font-size", "14px")
        .text("Frequency (Hz)")
    })
  }

  const getFrequencyAtX = (x: number) => {
    const freqMin = 20
    const freqMax = 20000
    const xNormalized = x / width
    return Math.round(freqMin * Math.pow(freqMax / freqMin, xNormalized))
  }

  const getDecibelAtY = (y: number) => {
    const yNormalized = 1 - (y / height)
    return Math.round(-140 + yNormalized * 180)
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    setHoveredPoint({
      frequency: getFrequencyAtX(x),
      decibel: getDecibelAtY(y),
      clientX: e.clientX,  // 마우스 위치 저장
      clientY: e.clientY
    })
  }

  const handleMouseLeave = () => {
    setHoveredPoint(null)
  }

  useEffect(() => {
    // visualType이 변경될 때마다 캔버스 초기화
    if (!svgRef.current) return
    const svg = d3.select(svgRef.current)
    if (!svg) return

    // 캔버스 초기화
    svg.selectAll("*").remove()
    // 현재 오디오 데이터로 다시 그리기
    if (scriptProcessorRef.current) {
      const inputData = new Float32Array(fftSize)
      const fftData = calculateFFT(inputData)
      const filteredData = averageType === "LPF"
        ? applyLPF(fftData)
        : applyFIFO(fftData)
      drawSpectrum(filteredData)
    }
  }, [visualType]) // visualType이 변경될 때만 실행

  // 창 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      if (svgRef.current) {
        svgRef.current.setAttribute("width", window.innerWidth.toString())
        svgRef.current.setAttribute("height", (window.innerHeight - 48).toString())
      }
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="flex flex-col">
      <AudioSpectrumHeader
        visualType={visualType}
        onVisualTypeChange={onVisualTypeChange}
      />
      <div className="relative flex-1">
        <svg
          ref={lineGraphRef}
          width={width}
          height={height}
          className={`absolute bg-gradient-to-b from-gray-900 to-black transition-opacity duration-300 ${visualType === "line" ? "opacity-100" : "opacity-0"
            }`}
        />
        <svg
          ref={barGraphRef}
          width={width}
          height={height}
          className={`absolute bg-gradient-to-b from-gray-900 to-black transition-opacity duration-300 ${visualType === "bar" ? "opacity-100" : "opacity-0"
            }`}
        />
        {hoveredPoint && (
          <div
            className="absolute pointer-events-none px-4 py-2 bg-black/80 backdrop-blur-sm rounded-lg border border-white/20 text-white shadow-lg"
            style={{
              left: hoveredPoint.clientX + 12,
              top: hoveredPoint.clientY - 12,
              transform: 'translate(-55%, -20%)',
            }}
          >
            <div className="flex flex-col gap-1 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">Frequency:</span>
                <span className="font-mono">
                  {hoveredPoint.frequency < 1000
                    ? `${hoveredPoint.frequency} Hz`
                    : `${(hoveredPoint.frequency / 1000).toFixed(1)} kHz`}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">Amplitude:</span>
                <span className="font-mono">{hoveredPoint.decibel} dB</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 
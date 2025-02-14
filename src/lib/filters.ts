export class LowPassFilter {
  private prevValue: number | null = null
  private alpha: number

  constructor(cutoffFrequency: number) {
    // 더 느린 응답을 위해 alpha 값 조정
    this.alpha = cutoffFrequency * 0.02 // 0.25Hz -> 0.005, 0.5Hz -> 0.01, 1Hz -> 0.02
  }

  process(value: number): number {
    if (this.prevValue === null) {
      this.prevValue = value
      return value
    }
    
    const filtered = this.alpha * value + (1 - this.alpha) * this.prevValue
    this.prevValue = filtered
    return filtered
  }

  reset() {
    this.prevValue = null
  }
}

export class FIFOFilter {
  private buffer: number[]
  private size: number
  private head: number = 0
  private isFull: boolean = false
  private lastOutput: number | null = null
  private readonly smoothingFactor: number = 0.07 // 0.3 → 0.07로 감소

  constructor(size: number = 6) { // 4 → 6으로 증가
    this.size = size
    this.buffer = new Array(size).fill(0)
  }

  process(value: number): number {
    this.buffer[this.head] = value

    this.head = (this.head + 1) % this.size
    if (this.head === 0) {
      this.isFull = true
    }

    let sum = 0
    let weightSum = 0
    const count = this.isFull ? this.size : this.head

    for (let i = 0; i < count; i++) {
      const weight = i + 1 // 최근 값일수록 가중치 증가
      sum += this.buffer[i] * weight
      weightSum += weight
    }

    const currentAverage = count > 0 ? sum / weightSum : value

    if (this.lastOutput === null) {
      this.lastOutput = currentAverage
    } else {
      this.lastOutput += (currentAverage - this.lastOutput) * this.smoothingFactor
    }

    return this.lastOutput
  }

  resize(newSize: number) {
    const oldBuffer = [...this.buffer]
    const oldHead = this.head
    const wasFullBuffer = this.isFull
    const oldOutput = this.lastOutput  // 이전 출력값 저장
    
    this.buffer = new Array(newSize).fill(0)
    this.size = newSize
    this.head = 0
    this.isFull = false
    this.lastOutput = oldOutput  // 이전 출력값 유지

    const validCount = Math.min(
      wasFullBuffer ? oldBuffer.length : oldHead,
      newSize
    )
    
    for (let i = 0; i < validCount; i++) {
      this.buffer[i] = oldBuffer[(oldHead - validCount + i + oldBuffer.length) % oldBuffer.length]
      this.head = (this.head + 1) % newSize
    }
  }

  reset() {
    this.buffer = new Array(this.size).fill(0)
    this.head = 0
    this.isFull = false
    this.lastOutput = null
  }
}

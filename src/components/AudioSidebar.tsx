import { useEffect, useState } from 'react'

type LPFFrequency = 0.25 | 0.5 | 1;
type FFTSize = 1024 | 2048 | 4096;

interface AudioSidebarProps {
  audioContext: AudioContext | undefined;
  source: MediaStreamAudioSourceNode | undefined;
  onSourceChange: (stream: MediaStream) => void;
  lpfFrequency: LPFFrequency;
  onLpfFrequencyChange: (freq: LPFFrequency) => void;
  fftSize: FFTSize;
  onFftSizeChange: (size: FFTSize) => void;
  averageType: 'LPF' | 'FIFO';
  onAverageTypeChange: (type: 'LPF' | 'FIFO') => void;
}

export default function AudioSidebar({ audioContext, source, onSourceChange, lpfFrequency, onLpfFrequencyChange, fftSize, onFftSizeChange, averageType, onAverageTypeChange }: AudioSidebarProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [volume, setVolume] = useState<number>(-Infinity)

  useEffect(() => {
    const initializeAudio = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioDevices = devices.filter(device => device.kind === 'audioinput')
        setDevices(audioDevices)

        if (audioDevices.length > 0 && !selectedDeviceId) {
          const defaultDevice = audioDevices[0]
          setSelectedDeviceId(defaultDevice.deviceId)

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: { exact: defaultDevice.deviceId } }
          })
          onSourceChange(stream)
        }
      } catch (err) {
        console.error('Error initializing audio:', err)
      }
    }

    initializeAudio()
  }, [])

  useEffect(() => {
    if (!audioContext || !source) return

    const analyser = audioContext.createAnalyser()
    analyser.minDecibels = -85
    analyser.maxDecibels = -30
    analyser.smoothingTimeConstant = 0.5

    const dataArray = new Float32Array(analyser.frequencyBinCount)

    let animationId: number

    const updateVolume = () => {
      analyser.getFloatTimeDomainData(dataArray)

      let rms = 0
      for (let i = 0; i < dataArray.length; i++) {
        rms += dataArray[i] * dataArray[i]
      }
      rms = Math.sqrt(rms / dataArray.length)

      const normalized = Math.max(0, Math.min(100, (20 * Math.log10(rms) + 85) / 55 * 100 * 0.7))
      setVolume(normalized)

      animationId = requestAnimationFrame(updateVolume)
    }

    source.connect(analyser)
    updateVolume()

    return () => {
      cancelAnimationFrame(animationId)
      analyser.disconnect()
      source.disconnect()
    }
  }, [source, audioContext])

  const handleDeviceChange = async (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } }
      })
      onSourceChange(stream)
    } catch (err) {
      console.error('Error changing audio source:', err)
    }
  }

  return (
    <div className="w-72 bg-[#1C1C1E] flex flex-col h-screen border-l border-[#2C2C2E]">
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
              <span className="text-white font-semibold">A</span>
            </div>
            <h2 className="text-white font-medium">Audio Input</h2>
          </div>
          <button className="px-4 py-1.5 bg-[#2C2C2E] text-white rounded-full text-sm">
            Share
          </button>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-gray-400 text-sm">Input Device</label>
            <select
              value={selectedDeviceId}
              onChange={(e) => handleDeviceChange(e.target.value)}
              className="w-full bg-[#2C2C2E] text-white p-2.5 rounded-md text-sm border-none focus:ring-0"
            >
              {devices.map(device => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Audio Input ${device.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-gray-400 text-sm">Input Level</label>
            <div className="flex gap-1">
              {Array.from({ length: 15 }, (_, index) => {
                const isActive = volume >= (index * 100 / 14);
                return (
                  <div
                    key={index}
                    className={`flex-1 h-1.5 rounded-full transition-all duration-100 
                      ${isActive ? 'bg-green-500' : 'bg-[#2C2C2E]'}`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-white font-medium">Analysis</span>
        </div>
        <div className="space-y-4">
          <div className='flex items-center justify-between'>
            <span className="text-gray-400">LPF frequency</span>
            <div className='flex items-center gap-2'>
              <select
                value={lpfFrequency}
                onChange={(e) => onLpfFrequencyChange(Number(e.target.value) as LPFFrequency)}
                className="bg-[#2C2C2E] text-white px-3 py-1.5 rounded-md text-sm"
              >
                <option value={0.25}>0.25Hz</option>
                <option value={0.5}>0.5Hz</option>
                <option value={1}>1Hz</option>
              </select>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">FFT Size</span>
            <select
              value={fftSize}
              onChange={(e) => onFftSizeChange(Number(e.target.value) as FFTSize)}
              className="bg-[#2C2C2E] text-white px-3 py-1.5 rounded-md text-sm"
            >
              <option value={1024}>1024</option>
              <option value={2048}>2048</option>
              <option value={4096}>4096</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-400">Average Type</span>
            <select
              value={averageType}
              onChange={(e) => onAverageTypeChange(e.target.value as 'LPF' | 'FIFO')}
              className="bg-[#2C2C2E] text-white px-3 py-1.5 rounded-md text-sm"
            >
              <option value="LPF">LPF</option>
              <option value="FIFO">FIFO</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  )
} 
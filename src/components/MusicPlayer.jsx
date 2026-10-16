import { useEffect, useRef, useState } from 'react'

const TRACKS = [
  {
    id: 'lofi',
    title: 'Cozy Bookstore Lofi',
    subtitle: 'Warm chords & gentle tape warmth',
    icon: '♪',
    bpm: 64,
  },
  {
    id: 'rain',
    title: 'Rain on the Window',
    subtitle: 'Soft steady rainfall & distant thunder',
    icon: '♪',
    bpm: 0,
  },
  {
    id: 'fireplace',
    title: 'Tea & Hearth Fire',
    subtitle: 'Cozy wooden crackle & warm drone',
    icon: '♪',
    bpm: 0,
  },
  {
    id: 'piano',
    title: 'Midnight Solitude',
    subtitle: 'Slow meditative piano notes',
    icon: '♪',
    bpm: 52,
  },
  {
    id: 'breeze',
    title: 'Autumn Garden Breeze',
    subtitle: 'Nature whisper & gentle chimes',
    icon: '♪',
    bpm: 48,
  },
]

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [volume, setVolume] = useState(0.5)
  const [isExpanded, setIsExpanded] = useState(false)
  const [addRainOverlay, setAddRainOverlay] = useState(false)

  const audioCtxRef = useRef(null)
  const masterGainRef = useRef(null)
  const rainGainRef = useRef(null)
  const timerIdsRef = useRef([])
  const nodesRef = useRef([])

  const currentTrack = TRACKS[currentTrackIndex]

  // Setup Web Audio Context
  function initAudio() {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      const ctx = new AudioCtx()
      const master = ctx.createGain()
      master.gain.value = volume
      master.connect(ctx.destination)

      const rainGain = ctx.createGain()
      rainGain.gain.value = addRainOverlay ? 0.25 : 0
      rainGain.connect(master)

      audioCtxRef.current = ctx
      masterGainRef.current = master
      rainGainRef.current = rainGain
    }

    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume()
    }
  }

  // Clear running audio nodes and timers
  function stopCurrentSounds() {
    timerIdsRef.current.forEach((id) => clearInterval(id))
    timerIdsRef.current = []

    nodesRef.current.forEach((node) => {
      try {
        node.stop?.()
        node.disconnect?.()
      } catch {
        // ignore
      }
    })
    nodesRef.current = []
  }

  // Update volume
  useEffect(() => {
    if (masterGainRef.current && audioCtxRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        volume,
        audioCtxRef.current.currentTime,
        0.05
      )
    }
  }, [volume])

  // Rain overlay toggle
  useEffect(() => {
    if (rainGainRef.current && audioCtxRef.current) {
      rainGainRef.current.gain.setTargetAtTime(
        addRainOverlay ? 0.22 : 0,
        audioCtxRef.current.currentTime,
        0.1
      )
    }
  }, [addRainOverlay])

  // Sound Synthesizers for pure aesthetic slow soundscapes
  function startTrackAudio(trackId) {
    const ctx = audioCtxRef.current
    const master = masterGainRef.current
    if (!ctx || !master) return

    stopCurrentSounds()

    // 1. Pink noise generator for soothing rain / fireplace / tape hiss
    function createPinkNoise(filterFreq = 900, Q = 1.0) {
      const bufferSize = ctx.sampleRate * 2
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
      const data = buffer.getChannelData(0)
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1
        b0 = 0.99886 * b0 + white * 0.0555179
        b1 = 0.99332 * b1 + white * 0.0750759
        b2 = 0.96900 * b2 + white * 0.1538520
        b3 = 0.86650 * b3 + white * 0.3104856
        b4 = 0.55000 * b4 + white * 0.5329522
        b5 = -0.7616 * b5 - white * 0.0168980
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.04
        b6 = white * 0.115926
      }
      const noise = ctx.createBufferSource()
      noise.buffer = buffer
      noise.loop = true

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = filterFreq
      filter.Q.value = Q

      const gain = ctx.createGain()
      noise.connect(filter)
      filter.connect(gain)
      gain.connect(master)
      noise.start()
      nodesRef.current.push(noise, filter, gain)
      return { gain, filter }
    }

    // Warm note player
    function playWarmNote(freq, startTime, duration = 3.5, type = 'sine', peakGain = 0.09) {
      const osc = ctx.createOscillator()
      const noteGain = ctx.createGain()
      const filter = ctx.createBiquadFilter()

      osc.type = type
      osc.frequency.setValueAtTime(freq, startTime)

      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(freq * 2.2, startTime)

      noteGain.gain.setValueAtTime(0.0001, startTime)
      noteGain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.18)
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

      osc.connect(filter)
      filter.connect(noteGain)
      noteGain.connect(master)

      osc.start(startTime)
      osc.stop(startTime + duration)
      nodesRef.current.push(osc, noteGain, filter)
    }

    if (trackId === 'rain') {
      const { gain } = createPinkNoise(750, 0.7)
      gain.gain.value = 0.35

      // Random gentle droplets
      const dropTimer = setInterval(() => {
        if (!isPlaying) return
        const t = ctx.currentTime
        const dropFreq = 1200 + Math.random() * 800
        playWarmNote(dropFreq, t, 0.15, 'sine', 0.015)
      }, 700)
      timerIdsRef.current.push(dropTimer)
    } else if (trackId === 'fireplace') {
      const { gain } = createPinkNoise(450, 1.2)
      gain.gain.value = 0.3

      // Random wood crackles
      const crackleTimer = setInterval(() => {
        if (!isPlaying) return
        const t = ctx.currentTime
        if (Math.random() > 0.4) {
          playWarmNote(200 + Math.random() * 500, t, 0.05, 'triangle', 0.04)
        }
      }, 350)
      timerIdsRef.current.push(crackleTimer)
    } else if (trackId === 'lofi') {
      // Gentle tape noise bed
      const { gain } = createPinkNoise(500, 0.8)
      gain.gain.value = 0.06

      // Slow relaxing Lofi Chord Progressions (Dm9 -> G13 -> Cmaj9 -> Am7)
      const chords = [
        [146.83, 220.00, 261.63, 329.63], // Dm9
        [196.00, 246.94, 329.63, 392.00], // G13
        [130.81, 196.00, 246.94, 329.63], // Cmaj9
        [220.00, 261.63, 329.63, 392.00], // Am7
      ]
      let chordIndex = 0

      function triggerChord() {
        const chord = chords[chordIndex % chords.length]
        const now = ctx.currentTime
        chord.forEach((freq, idx) => {
          playWarmNote(freq, now + idx * 0.04, 3.8, 'triangle', 0.035)
        })
        chordIndex++
      }

      triggerChord()
      const lofiTimer = setInterval(triggerChord, 4000)
      timerIdsRef.current.push(lofiTimer)
    } else if (trackId === 'piano') {
      // Midnight piano: slow meditative notes (pentatonic C - D - E - G - A)
      const notes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]
      function playPianoNote() {
        const note = notes[Math.floor(Math.random() * notes.length)]
        const now = ctx.currentTime
        playWarmNote(note, now, 4.5, 'sine', 0.06)
        // Harmonics
        playWarmNote(note * 2, now + 0.01, 2.5, 'sine', 0.02)
      }

      playPianoNote()
      const pianoTimer = setInterval(playPianoNote, 2800)
      timerIdsRef.current.push(pianoTimer)
    } else if (trackId === 'breeze') {
      const { gain } = createPinkNoise(380, 2.0)
      gain.gain.value = 0.18

      // Soft wind chimes
      const chimeTimer = setInterval(() => {
        if (!isPlaying) return
        if (Math.random() > 0.3) {
          const chimes = [1046.50, 1174.66, 1318.51, 1567.98]
          const f = chimes[Math.floor(Math.random() * chimes.length)]
          playWarmNote(f, ctx.currentTime, 3.0, 'sine', 0.02)
        }
      }, 2200)
      timerIdsRef.current.push(chimeTimer)
    }
  }

  // Play / Pause toggle
  function handleTogglePlay() {
    initAudio()
    if (isPlaying) {
      stopCurrentSounds()
      setIsPlaying(false)
    } else {
      setIsPlaying(true)
      startTrackAudio(currentTrack.id)
    }
  }

  // Switch Track
  function handleSelectTrack(index) {
    initAudio()
    setCurrentTrackIndex(index)
    if (isPlaying) {
      startTrackAudio(TRACKS[index].id)
    }
  }

  function handleNextTrack() {
    const nextIdx = (currentTrackIndex + 1) % TRACKS.length
    handleSelectTrack(nextIdx)
  }

  function handlePrevTrack() {
    const prevIdx = (currentTrackIndex - 1 + TRACKS.length) % TRACKS.length
    handleSelectTrack(prevIdx)
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCurrentSounds()
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {})
      }
    }
  }, [])

  return (
    <aside className={`music-widget ${isExpanded ? 'expanded' : 'collapsed'}`}>
      {/* Collapsed Pill Button */}
      {!isExpanded ? (
        <button
          type="button"
          className={`music-pill-btn ${isPlaying ? 'playing' : ''}`}
          onClick={() => setIsExpanded(true)}
          aria-label="Open reading soundtrack player"
          title="Reading Soundtrack"
        >
          <span className="music-pill-icon">{currentTrack.icon}</span>
          <span className="music-pill-label">
            {isPlaying ? currentTrack.title : 'Play Reading Music'}
          </span>
          {isPlaying && (
            <span className="sound-bars" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          )}
        </button>
      ) : (
        /* Expanded Aesthetic Player Card */
        <div className="music-card">
          <div className="music-card-header">
            <div className="music-card-title">
              <span className="music-tag">READING SOUNDTRACK</span>
              <h4>Slow & Cozy Sounds</h4>
            </div>
            <button
              type="button"
              className="music-minimize-btn"
              onClick={() => setIsExpanded(false)}
              aria-label="Minimize music player"
            >
              ▾
            </button>
          </div>

          <div className="music-track-display">
            <div className={`music-disc ${isPlaying ? 'spinning' : ''}`}>
              <span className="disc-icon">{currentTrack.icon}</span>
            </div>
            <div className="music-track-info">
              <strong>{currentTrack.title}</strong>
              <small>{currentTrack.subtitle}</small>
            </div>
          </div>

          {/* Player controls */}
          <div className="music-controls-row">
            <button
              type="button"
              className="music-ctrl-btn"
              onClick={handlePrevTrack}
              aria-label="Previous track"
              title="Previous"
            >
              «
            </button>

            <button
              type="button"
              className="music-play-btn"
              onClick={handleTogglePlay}
              aria-label={isPlaying ? 'Pause music' : 'Play music'}
            >
              {isPlaying ? '❚❚' : '▶'}
            </button>

            <button
              type="button"
              className="music-ctrl-btn"
              onClick={handleNextTrack}
              aria-label="Next track"
              title="Next"
            >
              »
            </button>
          </div>

          {/* Volume control */}
          <div className="music-volume-row">
            <span className="vol-icon" aria-hidden="true">
              {volume === 0 ? 'Mute' : 'Vol'}
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              aria-label="Soundtrack Volume"
              className="music-vol-slider"
            />
            <span className="vol-text">{Math.round(volume * 100)}%</span>
          </div>

          {/* Ambient Rain overlay checkbox */}
          <label className="music-ambient-toggle">
            <input
              type="checkbox"
              checked={addRainOverlay}
              onChange={(e) => setAddRainOverlay(e.target.checked)}
            />
            <span>Blend soft rain in background</span>
          </label>

          {/* Track selector playlist */}
          <div className="music-playlist">
            {TRACKS.map((t, idx) => (
              <button
                key={t.id}
                type="button"
                className={`playlist-item ${idx === currentTrackIndex ? 'active' : ''}`}
                onClick={() => handleSelectTrack(idx)}
              >
                <span>{t.icon}</span>
                <span className="playlist-title">{t.title}</span>
                {idx === currentTrackIndex && isPlaying && (
                  <span className="playlist-playing-badge">Playing</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  )
}

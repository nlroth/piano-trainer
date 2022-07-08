import { invoke } from '@tauri-apps/api'
import { listen, UnlistenFn } from '@tauri-apps/api/event'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { KeyboardShortcuts, MidiNumbers, Piano } from 'react-piano'
import 'react-piano/dist/styles.css'
import styled from 'styled-components'
import { getFifthFromMidiNote, getTriadChordFromMidiNote } from '../../utils'
import SoundfontProvider from '../SoundfontProvider'
import { TrainerContext } from '../TrainerProvider'

const KeyboardContainer = styled.div`
  height: 25vh;
`

const Keyboard = () => {
  const {
    noteTracker,
    setNoteTracker,
    practiceMode,
    chordStack,
    setChordStack,
    scale,
  } = useContext(TrainerContext)
  const unlistenRef = useRef<UnlistenFn>()
  const [activeNotes, setActiveNotes] = useState<{ [note: string]: boolean }>(
    {}
  )
  const firstNote = MidiNumbers.fromNote('c3')
  const lastNote = MidiNumbers.fromNote('c5')
  const keyboardShortcuts = KeyboardShortcuts.create({
    firstNote,
    lastNote,
    keyboardConfig: KeyboardShortcuts.HOME_ROW,
  })

  const [isListening, setIsListening] = useState(false)

  const onLoadCallback = useCallback(() => {
    if (isListening) return
    invoke('open_midi_connection', { inputIdx: 0 })

    listen('midi_message', (event) => {
      const payload = event.payload as { message: number[] }
      const [command, note] = payload.message

      if (command === 144) {
        setActiveNotes((an) => ({
          ...an,
          [note]: true,
        }))
      }

      if (command === 128) {
        setActiveNotes((an) => ({
          ...an,
          [note]: false,
        }))
      }
    })
      .then((ul) => (unlistenRef.current = ul))
      .catch(console.error)

    console.log('Connected & listening to MIDI device...')
    setIsListening(true)
  }, [isListening, setIsListening])

  useEffect(() => {
    onLoadCallback()
  }, [onLoadCallback, isListening])

  useEffect(() => {
    if (practiceMode === 'chords') {
      const targetChord = getTriadChordFromMidiNote(
        noteTracker?.nextTargetMidiNumber!,
        scale!
      )
      const matches = targetChord.every((e) => chordStack?.includes(e))
      if (matches) {
        setNoteTracker?.((nt) => ({
          ...nt,
          noteCounter: nt.noteCounter + 1,
          currentMidiNumber: targetChord[0],
        }))
        setChordStack?.([])
      }
    } else if (practiceMode === 'fifths') {
      const targetFifths = [
        noteTracker?.nextTargetMidiNumber!,
        getFifthFromMidiNote(noteTracker?.nextTargetMidiNumber!, scale?.value!),
      ]
      const matches = targetFifths.every((e) => chordStack?.includes(e))
      if (matches) {
        setNoteTracker?.((nt) => ({
          ...nt,
          noteCounter: nt.noteCounter + 1,
          currentMidiNumber: targetFifths[0],
        }))
        setChordStack?.([])
      }
    }
  }, [
    setNoteTracker,
    chordStack,
    noteTracker?.nextTargetMidiNumber,
    scale,
    practiceMode,
    setChordStack,
  ])

  useEffect(() => {
    const unlisten = async () => {
      unlistenRef.current?.()
    }
    return () => {
      unlisten()
    }
  }, [])

  return (
    <SoundfontProvider
      instrumentName={'acoustic_grand_piano'}
      hostname={'https://d1pzp51pvbm36p.cloudfront.net'}
      format={'mp3'}
      soundfont={'MusyngKite'}
      onLoad={() => {}}
      render={({ playNote, stopNote }) => {
        return (
          <KeyboardContainer>
            <Piano
              noteRange={{ first: firstNote, last: lastNote }}
              playNote={(midiNumber: number) => {
                if (
                  midiNumber === noteTracker?.nextTargetMidiNumber &&
                  practiceMode === 'scales'
                ) {
                  setNoteTracker?.((nt) => ({
                    ...nt,
                    noteCounter: nt.noteCounter + 1,
                    currentMidiNumber: midiNumber,
                  }))
                } else if (
                  practiceMode === 'chords' ||
                  practiceMode === 'fifths'
                ) {
                  setChordStack?.((cs) => [...cs, midiNumber])
                }

                playNote(midiNumber)
              }}
              stopNote={(midiNumber: number) => {
                stopNote(midiNumber)

                if (practiceMode === 'chords' || practiceMode === 'fifths') {
                  // remove midiNumber from chordStack
                  setChordStack?.((cs) => {
                    const removalIdx = cs.indexOf(midiNumber)
                    if (removalIdx > -1) {
                      cs.splice(removalIdx, 1)
                    }

                    return cs
                  })
                }
              }}
              keyboardShortcuts={keyboardShortcuts}
              renderNoteLabel={({ midiNumber }: { midiNumber: number }) => (
                <p className='ReactPiano__NoteLabel'>
                  {MidiNumbers.getAttributes(midiNumber).note.replace(
                    /[0-9]/,
                    ''
                  )}
                </p>
              )}
              activeNotes={Object.keys(activeNotes)
                .filter((v: string) => activeNotes[v])
                .map((s: string) => Number(s))}
            />
          </KeyboardContainer>
        )
      }}
    />
  )
}

export default Keyboard

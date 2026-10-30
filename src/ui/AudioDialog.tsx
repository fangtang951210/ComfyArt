import { useState } from 'react'
import { atom, useValue, type Editor } from 'tldraw'

import { generateAudio, musicModels, SFX_SECONDS, voices, type AudioSpec } from '../assetGen'
import { workflowConfigAtom } from '../customWorkflows'
import { AUDIO, clock, type AudioShape } from '../shapes/EmbedShapes'
import { Modal } from './Modal'
import { Chips } from './Chips'
import { t } from '../i18n'

type Tab = 'music' | 'speech' | 'sfx'
const TABS: [Tab, string][] = [['music', t('audio.music')], ['speech', t('audio.voiceover')], ['sfx', t('audio.soundEffect')]]
const CLONE = 'clone'

export const audioDialogAtom = atom<boolean>('audio dialog', false)

export function AudioDialog({ editor, onError }: { editor: Editor; onError: (msg: string) => void }) {
  const open = useValue(audioDialogAtom)
  const [tab, setTab] = useState<Tab>('music')
  const [prompts, setPrompts] = useState<Record<Tab, string>>({ music: '', speech: '', sfx: '' })
  const [lyrics, setLyrics] = useState('')
  const [seconds, setSeconds] = useState(30)
  const [sfxSeconds, setSfxSeconds] = useState(8)
  const models = useValue('music models', musicModels, [])
  const [pickedModel, setModel] = useState(models[0].id)
  const model = models.find((m) => m.id === pickedModel) ?? models[0]
  const [picked, setVoice] = useState('')
  const speechFile = useValue('speech workflow', () => workflowConfigAtom.get().speech, [])
  const reference = useValue('selected audio', () => {
    const s = editor.getOnlySelectedShape()
    return s?.type === AUDIO ? (s as AudioShape).props.src : null
  }, [editor])
  if (!open) return null
  const list = speechFile ? [speechFile.replace(/\.json$/, '')] : voices()
  const voice = picked === CLONE || list.includes(picked) ? picked : list[0]
  const close = () => audioDialogAtom.set(false)
  const musicSeconds = Math.min(seconds, model.maxSeconds)
  const prompt = prompts[tab]
  const spec = (): AudioSpec | null => {
    const text = prompt.trim()
    if (!text) return null
    if (tab === 'music') return { kind: 'music', model: model.id, prompt: text, lyrics: lyrics.trim(), seconds: musicSeconds }
    if (tab === 'sfx') return { kind: 'sfx', prompt: text, seconds: sfxSeconds }
    return voice === CLONE && reference ? { kind: 'clone', text, reference } : { kind: 'speech', text, voice: voice === CLONE ? list[0] : voice }
  }
  const run = () => {
    const s = spec()
    if (!s) return
    close()
    generateAudio(editor, s, onError)
  }

  return (
    <Modal title={t('audio.generateAudio')} onClose={close}>
      <div className="ca-rename__body">
        <Chips value={tab} options={TABS} onPick={setTab} />
        <textarea
          autoFocus
          className="ca-panel__prompt ca-panel__prompt--boxed"
          value={prompt}
          placeholder={tab === 'music' ? t('audio.musicPlaceholder') : tab === 'sfx' ? t('audio.sfxPlaceholder') : t('audio.speechPlaceholder')}
          onChange={(e) => setPrompts({ ...prompts, [tab]: e.target.value })}
          onKeyDown={(e) => e.stopPropagation()}
        />
        {tab === 'music' && (
          <>
            <textarea className="ca-panel__prompt ca-panel__prompt--boxed" value={lyrics} placeholder={t('audio.lyricsPlaceholder')} onChange={(e) => setLyrics(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
            <div className="ca-rename__field"><span>{t('audio.model')}</span>
              <select className="ca-panel__input" value={model.id} onChange={(e) => setModel(e.target.value)}>
                {models.map((m) => <option key={m.id} value={m.id} title={m.desc}>{m.label}</option>)}
              </select>
            </div>
          </>
        )}
        {tab === 'music' ? (
          <label className="ca-panel__row"><span>{t('audio.duration')}</span><input type="range" min={5} max={model.maxSeconds} step={5} value={musicSeconds} onChange={(e) => setSeconds(Number(e.target.value))} /><span className="ca-panel__val">{clock(musicSeconds)}</span></label>
        ) : tab === 'speech' ? (
          <div className="ca-rename__field"><span>{t('audio.voice')}</span>
            <select className="ca-panel__input" value={voice} onChange={(e) => setVoice(e.target.value)}>
              {reference && <option value={CLONE}>{t('audio.cloneSelected')}</option>}
              {list.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        ) : (
          <div className="ca-rename__field"><span>{t('audio.duration')}</span>
            <Chips value={sfxSeconds} options={SFX_SECONDS.map((s) => [s, `${s}s`] as const)} onPick={setSfxSeconds} />
          </div>
        )}
        <div className="ca-panel__foot">
          <button type="button" className="ca-panel__secondary" onClick={close}>{t('common.cancel')}</button>
          <button type="button" className="ca-panel__primary" disabled={!prompt.trim()} onClick={run}>{t('common.generate')}</button>
        </div>
      </div>
    </Modal>
  )
}

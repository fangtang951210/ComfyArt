import { titleTags, type PromptGraph } from './comfy'
import { t } from './i18n'

export type CustomAction = 'generate' | 'edit' | 'style' | 'inpaint' | 'expand' | 'upscale' | 'cutout' | 'erase' | 'angles' | 'layers' | 'video' | 'animate' | 'creativeUpscale' | 'refVideo' | 'motion' | 'lipsync' | 'extend' | 'videoUpscale' | 'videoCutout' | 'model3d' | 'views' | 'music' | 'speech' | 'clone' | 'sfx'
export type Marker = 'image' | 'image2' | 'base' | 'front' | 'left' | 'back' | 'right' | 'mask' | 'last' | 'video' | 'audio' | 'prompt' | 'lyrics' | 'size' | 'width' | 'height' | 'count' | 'seconds' | 'strength' | 'unet' | 'save'

export type CustomGroup = 'image' | 'edit' | 'tools' | 'video' | 'model' | 'audio'

interface ActionSpec { id: CustomAction; group: CustomGroup; required: Marker[]; optional: Marker[]; needsImages?: boolean; needsFrames?: boolean; note: string }

export const CUSTOM_ACTIONS: ActionSpec[] = [
  { id: 'generate', group: 'image', required: ['prompt', 'size'], optional: ['count', 'unet', 'image', 'image2', 'base', 'strength'], note: 'Text to image. Shows up as an extra model in the image generator. @image and @image2 receive the first two reference images; a workflow with @image needs a reference to run, and @image2 gets the first one when only one is given. @base receives the base image and @strength its strength from 0.1 to 1 (for example a denoise input). A base image given to a workflow with no @base is an error. Transparent output is added by ComfyArt after @save, so @save needs an images input. LoRAs picked under Advanced need @unet.' },
  { id: 'edit', group: 'edit', required: ['image', 'prompt'], optional: [], note: 'Instruction edit: quick edit, edit text, compose and mockup blending. @prompt receives the edit instruction.' },
  { id: 'style', group: 'edit', required: ['image', 'prompt'], optional: ['image2'], note: 'Style transfer. @image2 is the style reference; without one ComfyArt passes the source image again. A reference given to a workflow with no @image2 is an error.' },
  { id: 'inpaint', group: 'edit', required: ['image', 'prompt'], optional: [], needsImages: true, note: 'Edit a region. @image receives the cropped region; ComfyArt pastes the result back into the full image, so @save needs an images input.' },
  { id: 'expand', group: 'edit', required: ['image', 'mask', 'prompt'], optional: [], note: 'Outpaint. ComfyArt pads the image itself: @image receives the padded image and @mask the new area (white = fill).' },
  { id: 'angles', group: 'edit', required: ['image', 'prompt'], optional: [], note: '@prompt receives a camera description such as "<qma> front-right quarter view eye-level shot medium shot".' },
  { id: 'upscale', group: 'tools', required: ['image'], optional: [], needsImages: true, note: 'ComfyArt resizes the result to the factor the user picked, so @save needs an images input.' },
  { id: 'creativeUpscale', group: 'tools', required: ['image', 'prompt'], optional: ['strength'], needsImages: true, note: 'Upscale with added detail. @image receives the source at its own size, @prompt the detail description and @strength the amount of change from 0 to 1. ComfyArt resizes the result to the factor the user picked, so @save needs an images input.' },
  { id: 'cutout', group: 'tools', required: ['image'], optional: [], note: 'Background removal. The result should keep an alpha channel.' },
  { id: 'erase', group: 'tools', required: ['image', 'mask'], optional: [], note: 'Object removal, also used to fill the background behind edited elements, split layers and moved objects. For move object ComfyArt grows the mask and pastes the object at its new place, so @save needs an images input there. @mask is the area to remove (white = remove).' },
  { id: 'layers', group: 'tools', required: ['image'], optional: ['prompt', 'count'], note: '@count receives the number of layers. The result is several RGBA images.' },
  { id: 'video', group: 'video', required: ['prompt', 'size'], optional: ['image', 'last', 'seconds'], note: 'Replaces the built-in model in the video generator\'s first/last frame mode (the storyboard mode stays built in). A first or last frame given to a workflow without @image / @last is an error.' },
  { id: 'animate', group: 'video', required: ['image', 'prompt'], optional: ['size', 'seconds', 'last'], note: 'Animate an image into a short clip. With loop on, @last receives the source image again so the clip ends where it starts.' },
  { id: 'refVideo', group: 'video', required: ['prompt'], optional: ['image', 'image2', 'video', 'audio', 'size', 'seconds'], note: 'Reference to video. Takes up to two images, one video and one audio; @prompt receives the text as written. A marked input with no reference, or a reference with no marker, is an error, except that @image2 gets the first image when only one is given.' },
  { id: 'motion', group: 'video', required: ['image', 'video', 'prompt'], optional: ['size', 'seconds'], note: 'Motion control. @image receives the character and @video the motion video.' },
  { id: 'lipsync', group: 'video', required: ['image', 'audio', 'prompt'], optional: ['size', 'seconds'], note: 'Lip sync. @image receives the portrait and @audio the speech. @seconds receives the length of the audio.' },
  { id: 'extend', group: 'video', required: ['video', 'prompt'], optional: ['seconds'], note: 'Extend a video. @video receives the source and @seconds the length to add. The result is placed as a new video, so it should hold the original plus the new part.' },
  { id: 'videoUpscale', group: 'video', required: ['video'], optional: [], needsFrames: true, note: 'ComfyArt resizes the result to the size the user picked, so @save needs a video or images input.' },
  { id: 'videoCutout', group: 'video', required: ['video'], optional: [], note: 'Video background removal.' },
  { id: 'model3d', group: 'model', required: ['image'], optional: [], note: 'Image to 3D. Shows up as an extra model in the image toolbar\'s 3D menu. The result must be a GLB file, e.g. from SaveGLB.' },
  { id: 'views', group: 'model', required: ['front'], optional: ['left', 'back', 'right'], note: 'Multi-view to 3D. Replaces the built-in model. The selected images go to @front, @left, @back and @right in that order. The number of selected images must match the markers. The result must be a GLB file.' },
  { id: 'music', group: 'audio', required: ['prompt'], optional: ['lyrics', 'seconds'], note: 'Text to music. Shows up as an extra model in the audio dialog. @prompt receives the style. Empty lyrics are sent as [instrumental]; lyrics given to a workflow with no @lyrics are an error. Without @seconds the workflow keeps its own length. When several nodes need the same text or length (YuE2 ABC and music nodes, ACE-Step encoder and latent), link them to one String or Float node and mark that node.' },
  { id: 'speech', group: 'audio', required: ['prompt'], optional: [], note: 'Voiceover. Replaces the built-in model when no recording is cloned. @prompt receives the text to read. The workflow picks its own voice, so the voice setting is not passed.' },
  { id: 'clone', group: 'audio', required: ['audio', 'prompt'], optional: [], note: 'Voice clone. @audio receives the selected recording and @prompt the text to read.' },
  { id: 'sfx', group: 'audio', required: ['prompt'], optional: ['seconds'], note: 'Sound effect. Replaces the built-in model. @prompt receives the description. Without @seconds the workflow keeps its own length.' },
]

export const MARKERS: { id: Marker; fill: string }[] = [
  { id: 'image', fill: 'Load Image (LoadImage or LoadImageMask): the input image' },
  { id: 'image2', fill: 'Load Image: a second image' },
  { id: 'base', fill: 'Load Image: the base image of an image-to-image run' },
  { id: 'front', fill: 'Load Image: the front view of an object' },
  { id: 'left', fill: 'Load Image: the left view of an object' },
  { id: 'back', fill: 'Load Image: the back view of an object' },
  { id: 'right', fill: 'Load Image: the right view of an object' },
  { id: 'mask', fill: 'LoadImageMask (channel is set to alpha) or LoadImage (use its MASK output): white = area to change' },
  { id: 'last', fill: 'Load Image: the last frame of a video' },
  { id: 'video', fill: 'Load Video: the input video' },
  { id: 'audio', fill: 'Load Audio: the input recording' },
  { id: 'prompt', fill: 'a node holding the text as a widget, e.g. CLIPTextEncode (text), TextEncodeQwenImageEdit (prompt), String (Multiline) (value)' },
  { id: 'lyrics', fill: 'a node holding the lyrics as a widget, e.g. YuE2GenerateMusic or MiniMaxMusic3TextEncode (lyrics), String (Multiline) (value)' },
  { id: 'size', fill: 'a node with width and height widgets, e.g. EmptyLatentImage; its batch_size also gets the image count when there is no @count' },
  { id: 'width', fill: 'an Int node or any node with a width widget' },
  { id: 'height', fill: 'an Int node or any node with a height widget' },
  { id: 'count', fill: 'an Int node or a node with batch_size / amount: how many results' },
  { id: 'seconds', fill: 'an Int or Float node or a node with seconds / duration / max_duration: video or audio length in seconds (not frames)' },
  { id: 'strength', fill: 'a Float node or a node with denoise / strength: how much the base image changes, from 0.1 to 1' },
  { id: 'unet', fill: 'the node whose first output is the MODEL, e.g. Load Diffusion Model or Load Checkpoint: LoRAs picked under Advanced are chained after it' },
  { id: 'save', fill: 'the output node (Save Image, Save Video, Preview Image...). Needed only when the workflow has more than one end node' },
]

const LOADERS = ['LoadImage', 'LoadImageMask']
const IMAGE_MARKERS: Marker[] = ['image', 'image2', 'base', 'front', 'left', 'back', 'right', 'mask', 'last']
const TEXT_KEYS = ['text', 'prompt', 'value', 'string', 'tags', 'caption', 'style', 'target_text']
const LYRICS_KEYS = ['lyrics', 'value', 'text', 'string']
const NUMBER_KEYS: Partial<Record<Marker, string[]>> = {
  width: ['value', 'width'], height: ['value', 'height'], count: ['value', 'batch_size', 'amount'], seconds: ['value', 'seconds', 'duration', 'max_duration'], strength: ['value', 'denoise', 'strength'],
}
export const NO_LYRICS = '[instrumental]'

export type Markers = Partial<Record<Marker, string>>

export const specOf = (action: CustomAction) => CUSTOM_ACTIONS.find((a) => a.id === action)!
const label = (graph: PromptGraph, id: string) => `${id} (${graph[id].class_type})`

export function parseApiWorkflow(text: string): PromptGraph {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(t('customWorkflows.notJson'))
  }
  return asApiWorkflow(data)
}

export function asApiWorkflow(data: unknown): PromptGraph {
  if (!data || typeof data !== 'object' || Array.isArray(data) || 'nodes' in data) throw new Error(t('customWorkflows.notApiFormat'))
  const nodes = Object.values(data as Record<string, unknown>)
  if (!nodes.length || !nodes.every((n) => n && typeof n === 'object' && 'class_type' in n && 'inputs' in n)) throw new Error(t('customWorkflows.notApiFormat'))
  return data as PromptGraph
}

export function findMarkers(graph: PromptGraph): Markers {
  const found: Markers = {}
  for (const [id, node] of Object.entries(graph) as [string, PromptGraph[string]][]) {
    for (const tag of titleTags(node)) {
      const marker = MARKERS.find((m) => tag === `@${m.id}`)?.id
      if (marker && !found[marker]) found[marker] = id
    }
  }
  return found
}

function sinkOf(graph: PromptGraph): string | null {
  const used = new Set<string>()
  for (const node of Object.values(graph)) for (const v of Object.values(node.inputs)) if (Array.isArray(v) && typeof v[0] === 'string') used.add(v[0])
  const sinks = Object.keys(graph).filter((id) => !used.has(id))
  return sinks.length === 1 ? sinks[0] : null
}

export const outputOf = (graph: PromptGraph, markers: Markers) => markers.save ?? sinkOf(graph)

function textKey(node: PromptGraph[string], names = TEXT_KEYS): string | null {
  const keys = Object.keys(node.inputs).filter((k) => typeof node.inputs[k] === 'string')
  return names.find((k) => keys.includes(k)) ?? (keys.length === 1 ? keys[0] : null)
}

function numberKey(node: PromptGraph[string], marker: Marker): string | null {
  const keys = Object.keys(node.inputs).filter((k) => typeof node.inputs[k] === 'number')
  return (NUMBER_KEYS[marker] ?? []).find((k) => keys.includes(k)) ?? null
}

function fillProblem(graph: PromptGraph, id: string, marker: Marker): string | null {
  const node = graph[id]
  if (IMAGE_MARKERS.includes(marker)) return LOADERS.includes(node.class_type) ? null : t('customWorkflows.needsLoader', `@${marker}`, label(graph, id))
  if (marker === 'video') return node.class_type === 'LoadVideo' ? null : t('customWorkflows.needsVideoLoader', label(graph, id))
  if (marker === 'audio') return node.class_type === 'LoadAudio' ? null : t('customWorkflows.needsAudioLoader', label(graph, id))
  if (marker === 'prompt') return textKey(node) ? null : t('customWorkflows.noTextWidget', label(graph, id))
  if (marker === 'lyrics') return textKey(node, LYRICS_KEYS) ? null : t('customWorkflows.noTextWidget', label(graph, id))
  if (marker === 'size') return ['width', 'height'].every((k) => typeof node.inputs[k] === 'number') ? null : t('customWorkflows.noSizeWidgets', label(graph, id))
  if (marker === 'save' || marker === 'unet') return null
  return numberKey(node, marker) ? null : t('customWorkflows.noNumberWidget', `@${marker}`, label(graph, id))
}

export interface Check { markers: Markers; errors: string[]; warnings: string[] }

export function checkWorkflow(graph: PromptGraph, action: CustomAction): Check {
  const spec = specOf(action)
  const markers = findMarkers(graph)
  const errors: string[] = []
  const warnings: string[] = []
  const has = (m: Marker) => !!markers[m] || (m === 'size' && !!markers.width && !!markers.height)
  const missing = spec.required.filter((m) => !has(m))
  if (missing.length) errors.push(t('customWorkflows.missingMarkers', missing.map((m) => (m === 'size' ? '@size (or @width + @height)' : `@${m}`)).join(', ')))
  const titles = new Map<string, string[]>()
  for (const [id, node] of Object.entries(graph) as [string, PromptGraph[string]][]) {
    for (const tag of titleTags(node)) titles.set(tag, [...(titles.get(tag) ?? []), id])
  }
  const usable: Marker[] = [...spec.required, ...spec.optional, 'save', ...(spec.required.includes('size') || spec.optional.includes('size') ? ['width', 'height'] as Marker[] : [])]
  for (const [title, ids] of titles) {
    const marker = MARKERS.find((m) => `@${m.id}` === title)?.id
    if (ids.length > 1) errors.push(t('customWorkflows.duplicateMarker', title, ids.join(', ')))
    if (!marker) warnings.push(t('customWorkflows.unknownMarker', title, ids[0]))
    else if (!usable.includes(marker)) warnings.push(t('customWorkflows.unusedMarker', title, t(`customWorkflows.action.${action}`)))
  }
  for (const [marker, id] of Object.entries(markers) as [Marker, string][]) {
    if (!usable.includes(marker)) continue
    const problem = fillProblem(graph, id, marker)
    if (problem) errors.push(problem)
  }
  const out = outputOf(graph, markers)
  if (!out) errors.push(t('customWorkflows.noOutput'))
  else if (spec.needsImages && !Array.isArray(graph[out].inputs.images)) errors.push(t('customWorkflows.outputNeedsImages', label(graph, out)))
  else if (spec.needsFrames && !Array.isArray(graph[out].inputs.images) && !Array.isArray(graph[out].inputs.video)) errors.push(t('customWorkflows.outputNeedsFrames', label(graph, out)))
  return { markers, errors, warnings }
}

export interface CustomValues { image?: string; image2?: string; base?: string; front?: string; left?: string; back?: string; right?: string; strength?: number; mask?: string; last?: string; video?: string; audio?: string; prompt?: string; lyrics?: string; width?: number; height?: number; count?: number; seconds?: number }

export function fillWorkflow(graph: PromptGraph, markers: Markers, values: CustomValues) {
  for (const [marker, id] of Object.entries(markers) as [Marker, string][]) {
    const value = marker === 'size' || marker === 'save' || marker === 'unet' ? undefined : values[marker]
    if (value === undefined) continue
    const node = graph[id]
    if (IMAGE_MARKERS.includes(marker)) {
      node.inputs.image = value
      if (node.class_type === 'LoadImageMask') node.inputs.channel = 'alpha'
    } else if (marker === 'video') node.inputs.file = value
    else if (marker === 'audio') node.inputs.audio = value
    else if (marker === 'lyrics') node.inputs[textKey(node, LYRICS_KEYS)!] = value || NO_LYRICS
    else node.inputs[marker === 'prompt' ? textKey(node)! : numberKey(node, marker)!] = value
  }
  if (markers.size && values.width && values.height) {
    const size = graph[markers.size].inputs
    Object.assign(size, { width: values.width, height: values.height })
    if (values.count && typeof size.batch_size === 'number' && !markers.count) size.batch_size = values.count
  }
  for (const node of Object.values(graph)) {
    for (const k of ['seed', 'noise_seed']) if (typeof node.inputs[k] === 'number') node.inputs[k] = Math.floor(Math.random() * 2 ** 31)
  }
}

export function rulesText(): string {
  const markers = MARKERS.map((m) => `- @${m.id}: ${m.fill}`).join('\n')
  const actions = CUSTOM_ACTIONS.map((a) => `- ${a.id}: needs ${a.required.map((m) => `@${m}`).join(', ')}${a.optional.length ? `; optional ${a.optional.map((m) => `@${m}`).join(', ')}` : ''}. ${a.note}`).join('\n')
  return [
    'Connect a user\'s own ComfyUI workflow to a ComfyArt feature. ComfyArt finds the nodes to fill by their title (_meta.title in API format), so the job is to title the right nodes and install the workflow.',
    'Steps:\n1. The workflow must be API format (Workflow > Export (API) in ComfyUI): an object of node id -> {class_type, inputs, _meta}. A UI-format file (with "nodes" and "links") cannot be used; ask the user to export it as API.\n2. Pick the feature (action) and set _meta.title of the nodes listed for it below. Titles are case-insensitive. Each marker goes on exactly one node; a node that receives several values carries several markers separated by spaces, e.g. "@prompt @size". Other words in the title are ignored, so "Positive @prompt" works. Only change _meta.title and, when a value has no node to receive it, add the smallest node that can (for example a PrimitiveInt for @seconds feeding a frame-count input through a math node). Do not change the user\'s models or settings.\n3. Call custom_workflow with action check, the workflow and the feature; fix every error it reports.\n4. Call custom_workflow with action install, a short name, the workflow and the feature. It saves the file to comfyart/workflows/<feature>/ in the ComfyUI user folder and assigns it to that feature. There is no delete: to remove a workflow, the user deletes its file there.\n5. Tell the user which feature now uses it; assign with file "" switches back to built in.',
    `Markers (the node title is @ plus the name):\n${markers}`,
    `Features:\n${actions}`,
    'ComfyArt randomizes every seed and noise_seed input on each run and maps model file names to the subfolder they are in, so seeds and model paths need no marker. The workflows ComfyArt ships (custom_nodes/ComfyArt/workflows/*.api.json) carry the same titles and are good examples; other @ names in them (besides @unet) are internal and ignored for custom workflows. Features not listed above (storyboard) always use the built-in workflows.',
  ].join('\n\n')
}

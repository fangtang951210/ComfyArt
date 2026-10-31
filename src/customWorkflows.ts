import { atom } from 'tldraw'

import { listUserFiles, readUserJson, writeUserJson, writeUserText, type PromptGraph } from './comfy'
import { asApiWorkflow, checkWorkflow, CUSTOM_ACTIONS, fillWorkflow, outputOf, parseApiWorkflow, rulesText, specOf, type CustomAction, type CustomValues, type Markers } from './customMarkers'
import { t } from './i18n'

const DIR = 'comfyart/workflows'
const CONFIG = 'comfyart/workflow-config.json'

export const CUSTOM_GENERATE = 'custom:generate'
export const CUSTOM_MUSIC = 'custom:music'
export const CUSTOM_MODEL3D = 'custom:model3d'
export const workflowConfigAtom = atom<Partial<Record<CustomAction, string>>>('workflow config', {})

type Link = [string, number]

export async function loadWorkflowConfig() {
  const config = await readUserJson<Partial<Record<CustomAction, string>>>(CONFIG, {})
  const present = await Promise.all(Object.entries(config).map(async ([action, file]) => (await listCustomWorkflows(action as CustomAction)).includes(file!) && [action, file]))
  workflowConfigAtom.set(Object.fromEntries(present.filter((e) => !!e)))
}

export async function setCustomWorkflow(action: CustomAction, file: string | null) {
  const next = { ...workflowConfigAtom.get() }
  if (file) next[action] = file
  else delete next[action]
  workflowConfigAtom.set(next)
  await writeUserJson(CONFIG, next)
}

export const listCustomWorkflows = async (action: CustomAction) => (await listUserFiles(`${DIR}/${action}`)).filter((f) => f.endsWith('.json')).sort()

export const readCustomWorkflow = (action: CustomAction, file: string) => readUserJson<PromptGraph | null>(`${DIR}/${action}/${file}`, null)

export async function saveCustomWorkflow(action: CustomAction, name: string, graph: PromptGraph): Promise<string> {
  const file = name.replace(/[\\/:*?"<>|]/g, '_').replace(/(\.api)?\.json$/i, '') + '.json'
  await writeUserText(`${DIR}/${action}/${file}`, JSON.stringify(graph, null, 2))
  return file
}

export interface CustomBuilt { graph: PromptGraph; result: string }
type Adapt = (graph: PromptGraph, markers: Markers, result: string) => void

export async function customGraph(action: CustomAction, values: CustomValues, adapt?: Adapt): Promise<CustomBuilt | null> {
  const file = workflowConfigAtom.get()[action]
  if (!file) return null
  const graph = await readCustomWorkflow(action, file)
  if (!graph) return null
  const { markers, errors } = checkWorkflow(graph, action)
  if (errors.length) throw new Error(`${file}: ${errors.join(' ')}`)
  for (const [key, marker] of [['image2', 'image2'], ['last', 'last'], ['image', 'image'], ['base', 'base']] as const) {
    if (values[key] && !markers[marker]) throw new Error(t('customWorkflows.unusedInput', file, `@${marker}`))
  }
  if (markers.image && !values.image) throw new Error(t('customWorkflows.needsImage', file))
  const { required, optional } = specOf(action)
  for (const marker of ['video', 'audio', 'front', 'left', 'back', 'right'] as const) {
    if (values[marker] && !markers[marker]) throw new Error(t('customWorkflows.unusedInput', file, `@${marker}`))
    if (markers[marker] && !values[marker] && [...required, ...optional].includes(marker)) throw new Error(t('customWorkflows.needsInput', file, `@${marker}`))
  }
  if (values.lyrics && !markers.lyrics) throw new Error(t('customWorkflows.unusedLyrics', file))
  fillWorkflow(graph, markers, markers.image2 && !values.image2 ? { ...values, image2: values.image } : values)
  const result = outputOf(graph, markers)!
  adapt?.(graph, markers, result)
  return { graph, result }
}

export async function customStoryboard(scenes: { prompt: string; duration: number }[], width: number, height: number, firstFrame: string | null) {
  const file = workflowConfigAtom.get().video
  if (!file) return null
  const source = await readCustomWorkflow('video', file)
  if (!source) return null
  const { markers, errors } = checkWorkflow(source, 'video')
  if (errors.length) throw new Error(`${file}: ${errors.join(' ')}`)
  const result = outputOf(source, markers)!
  const output = source[result].inputs.video
  if (!Array.isArray(output)) throw new Error(t('customWorkflows.storyboardNeedsVideo', file))
  if (firstFrame && !markers.image) throw new Error(t('customWorkflows.unusedInput', file, '@image'))
  if (markers.image && !firstFrame) throw new Error(t('customWorkflows.needsImage', file))
  const local = (i: number, id: string) => `s${i}:${id}`
  const graph: PromptGraph = {}
  const concat: Record<string, unknown> = { codec: 'auto' }
  scenes.forEach((scene, i) => {
    const copy = JSON.parse(JSON.stringify(source)) as PromptGraph
    fillWorkflow(copy, markers, { prompt: scene.prompt, width, height, seconds: scene.duration, image: i === 0 ? firstFrame ?? undefined : undefined })
    const clip: Link = [local(i, String(output[0])), Number(output[1])]
    for (const [id, node] of Object.entries(copy)) {
      if (id === result || (i > 0 && id === markers.image)) continue
      const inputs = Object.fromEntries(Object.entries(node.inputs).map(([k, v]) => {
        if (!Array.isArray(v)) return [k, v]
        return [k, i > 0 && v[0] === markers.image && v[1] === 0 ? [`last${i}`, 0] : [local(i, String(v[0])), v[1]]]
      }))
      graph[local(i, id)] = { ...node, inputs }
    }
    graph[`keep${i}`] = { class_type: 'SaveVideo', inputs: { video: clip, filename_prefix: 'comfyart/storyboard/scene', format: 'auto', codec: 'auto' } }
    if (!markers.image) {
      concat[`videos.video${i}`] = clip
      return
    }
    graph[`frames${i}`] = { class_type: 'GetVideoComponents', inputs: { video: clip } }
    if (i === 0) {
      concat[`videos.video${i}`] = clip
      return
    }
    graph[`last${i}`] = { class_type: 'ImageFromBatch', inputs: { image: [`frames${i - 1}`, 0], batch_index: -1, length: 1 } }
    graph[`frame${i}`] = { class_type: 'ComfyMathExpression', inputs: { expression: '1 / a', 'values.a': [`frames${i}`, 2] } }
    graph[`cut${i}`] = { class_type: 'Video Slice', inputs: { video: clip, start_time: [`frame${i}`, 0], duration: 0, strict_duration: false } }
    concat[`videos.video${i}`] = [`cut${i}`, 0]
  })
  graph.concat = { class_type: 'ConcatenateVideo', inputs: concat }
  graph[result] = { ...source[result], inputs: { ...source[result].inputs, video: ['concat', 0] } }
  return { graph, result, partial: scenes.map((_, i) => `keep${i}`) }
}

function rewire(graph: PromptGraph, from: Link, to: Link) {
  for (const node of Object.values(graph)) {
    for (const [k, v] of Object.entries(node.inputs)) {
      if (Array.isArray(v) && v[0] === from[0] && v[1] === from[1]) node.inputs[k] = to
    }
  }
}

const maskSlot = (graph: PromptGraph, id: string) => (graph[id].class_type === 'LoadImageMask' ? 0 : 1)

export function padForOutpaint(image: string, pads: { l: number; t: number; r: number; b: number }): Adapt {
  return (graph, markers) => {
    graph.cw_src = { class_type: 'LoadImage', inputs: { image } }
    graph.cw_pad = { class_type: 'ImagePadForOutpaint', inputs: { image: ['cw_src', 0], left: pads.l, top: pads.t, right: pads.r, bottom: pads.b, feathering: 0 } }
    rewire(graph, [markers.image!, 0], ['cw_pad', 0])
    rewire(graph, [markers.mask!, maskSlot(graph, markers.mask!)], ['cw_pad', 1])
  }
}

export function pasteBack(image: string, mask: string, crop: { x: number; y: number; w: number; h: number }): Adapt {
  return (graph, markers, result) => {
    graph.cw_full = { class_type: 'LoadImage', inputs: { image } }
    graph.cw_crop = { class_type: 'ImageCrop', inputs: { image: ['cw_full', 0], width: crop.w, height: crop.h, x: crop.x, y: crop.y } }
    rewire(graph, [markers.image!, 0], ['cw_crop', 0])
    graph.cw_scale = { class_type: 'ImageScale', inputs: { image: graph[result].inputs.images, upscale_method: 'bicubic', width: crop.w, height: crop.h, crop: 'disabled' } }
    graph.cw_mask = { class_type: 'LoadImageMask', inputs: { image: mask, channel: 'alpha' } }
    graph.cw_comp = { class_type: 'ImageCompositeMasked', inputs: { destination: ['cw_full', 0], source: ['cw_scale', 0], x: crop.x, y: crop.y, resize_source: false, mask: ['cw_mask', 0] } }
    graph[result].inputs.images = ['cw_comp', 0]
  }
}

export function moveObject(from: { x: number; y: number; w: number; h: number }, to: { x: number; y: number }): Adapt {
  return (graph, markers, result) => {
    const filled = graph[result].inputs.images
    if (!Array.isArray(filled)) throw new Error(t('customWorkflows.outputNeedsImages', result))
    const mask: Link = [markers.mask!, maskSlot(graph, markers.mask!)]
    graph.cw_grow = { class_type: 'GrowMask', inputs: { mask, expand: 12, tapered_corners: true } }
    rewire(graph, mask, ['cw_grow', 0])
    graph.cw_grow.inputs.mask = mask
    graph.cw_object = { class_type: 'ImageCrop', inputs: { image: [markers.image!, 0], width: from.w, height: from.h, x: from.x, y: from.y } }
    graph.cw_cut = { class_type: 'CropMask', inputs: { mask, x: from.x, y: from.y, width: from.w, height: from.h } }
    graph.cw_paste = { class_type: 'ImageCompositeMasked', inputs: { destination: filled, source: ['cw_object', 0], x: Math.max(0, to.x), y: Math.max(0, to.y), resize_source: false, mask: ['cw_cut', 0] } }
    graph[result].inputs.images = ['cw_paste', 0]
  }
}

export function resizeTo(width: number, height: number): Adapt {
  return (graph, _markers, result) => {
    graph.cw_size = { class_type: 'ImageScale', inputs: { image: graph[result].inputs.images, upscale_method: 'lanczos', width, height, crop: 'disabled' } }
    graph[result].inputs.images = ['cw_size', 0]
  }
}

export function resizeVideoTo(width: number, height: number): Adapt {
  return (graph, markers, result) => {
    if (Array.isArray(graph[result].inputs.images)) return resizeTo(width, height)(graph, markers, result)
    Object.assign(graph, {
      cw_v1: { class_type: 'GetVideoComponents', inputs: { video: graph[result].inputs.video } },
      cw_v2: { class_type: 'ImageScale', inputs: { image: ['cw_v1', 0], upscale_method: 'lanczos', width, height, crop: 'disabled' } },
      cw_v3: { class_type: 'CreateVideo', inputs: { images: ['cw_v2', 0], audio: ['cw_v1', 1], fps: ['cw_v1', 2] } },
    })
    graph[result].inputs.video = ['cw_v3', 0]
  }
}

export const withAlpha: Adapt = (graph, _markers, result) => {
  const images = graph[result].inputs.images
  if (!Array.isArray(images)) throw new Error(t('customWorkflows.outputNeedsImages', result))
  Object.assign(graph, {
    cw_bg1: { class_type: 'LoadBackgroundRemovalModel', inputs: { bg_removal_name: 'birefnet.safetensors' } },
    cw_bg2: { class_type: 'RemoveBackground', inputs: { bg_removal_model: ['cw_bg1', 0], image: images } },
    cw_bg3: { class_type: 'InvertMask', inputs: { mask: ['cw_bg2', 0] } },
    cw_bg4: { class_type: 'JoinImageWithAlpha', inputs: { image: images, alpha: ['cw_bg3', 0] } },
  })
  graph[result].inputs.images = ['cw_bg4', 0]
}

type Args = Record<string, unknown>

function featureOf(args: Args): CustomAction {
  const feature = CUSTOM_ACTIONS.find((a) => a.id === args.feature)?.id
  if (!feature) throw new Error(`feature must be one of ${CUSTOM_ACTIONS.map((a) => a.id).join(', ')}`)
  return feature
}

async function workflowOf(feature: CustomAction, args: Args): Promise<PromptGraph> {
  if (args.workflow != null) return typeof args.workflow === 'string' ? parseApiWorkflow(args.workflow) : asApiWorkflow(args.workflow)
  const graph = args.file ? await readCustomWorkflow(feature, String(args.file)) : null
  if (!graph) throw new Error(args.file ? `no workflow ${args.file} for ${feature}; see action list` : 'give workflow (API-format JSON) or file')
  return graph
}

export async function customWorkflowCommand(args: Args): Promise<object> {
  if (args.action === 'rules') return { rules: rulesText() }
  if (args.action === 'list') {
    return {
      features: await Promise.all(CUSTOM_ACTIONS.map(async ({ id, required, optional }) => ({
        id, required: required.map((m) => `@${m}`), optional: optional.map((m) => `@${m}`), assigned: workflowConfigAtom.get()[id] ?? null, files: await listCustomWorkflows(id),
      }))),
    }
  }
  if (args.action === 'check') {
    const feature = featureOf(args)
    const { markers, errors, warnings } = checkWorkflow(await workflowOf(feature, args), feature)
    return { ok: !errors.length, errors, warnings, markers }
  }
  if (args.action === 'install') {
    if (!args.name) throw new Error('give a short name for the workflow file')
    const feature = featureOf(args)
    const graph = await workflowOf(feature, args)
    const { errors, warnings } = checkWorkflow(graph, feature)
    if (errors.length) return { installed: false, errors, warnings }
    const file = await saveCustomWorkflow(feature, String(args.name), graph)
    await setCustomWorkflow(feature, file)
    return { installed: true, file, assigned: feature, warnings }
  }
  if (args.action === 'assign') {
    const feature = featureOf(args)
    if (!args.file) {
      await setCustomWorkflow(feature, null)
      return { feature, file: null }
    }
    const { errors } = checkWorkflow(await workflowOf(feature, { file: args.file }), feature)
    if (errors.length) return { assigned: false, errors }
    await setCustomWorkflow(feature, String(args.file))
    return { feature, file: args.file }
  }
  throw new Error('action must be rules, list, check, install or assign')
}

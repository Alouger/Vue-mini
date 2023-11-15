import { extend } from '@vue/shared'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'
import { createRenderer } from 'packages/runtime-core/src/renderer'

const rendererOptions = extend({ patchProp }, nodeOps)

let renderer

function ensureRenderer() {
  // createRenderer返回的值其实就是baseCreateRender返回的值, baseCreateRender返回的值就包含了render函数
  return renderer || (renderer = createRenderer(rendererOptions))
}

export const render = (...args) => {
  ensureRenderer().render(...args)
}

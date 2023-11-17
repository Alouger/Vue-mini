import { ShapeFlags } from "packages/shared/src/shapeFlags"
import { createVNode } from "./vnode"

/**
  * 解析 render 函数的返回值
  */
export function renderComponentRoot(instance) {
  const { vnode, render } = instance
  let result

  try {
    // 解析到状态组件
    if (vnode.shapeFlag & ShapeFlags.STATEFUL_COMPONENT) {
      // 获取到 result 返回值
      result = normalizeVNode(render!())
    }
  } catch (error) {
    console.error(error)
  }

  return result
}

// 生成标准化的VNode
export function normalizeVNode(child) {
  // 如果当前child已经是一个VNode了, 直接return child
  if (typeof child === 'object') {
    return cloneIfMounted(child)
  } else {
    return createVNode(Text, null, String(child))
  }
}
/**
 * clone VNode
 */
export function cloneIfMounted(child) {
  return child
}
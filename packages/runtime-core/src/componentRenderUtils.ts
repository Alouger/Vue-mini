import { createVNode } from "./vnode"

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
import { isArray, isFunction, isObject, isString } from "@vue/shared"
import { normalizeClass } from "packages/shared/src/normalizeProps"
import { ShapeFlags } from "packages/shared/src/shapeFlags"

export const Fragment = Symbol('Fragment')
export const Text = Symbol('Text')
export const Comment = Symbol('Comment')

export interface VNode {
  // 标识当前是否是VNode节点
  __v_isVNode: true
  type: any
  props: any
  children: any
  shapeFlag: number
  key: any
}

export function isVNode(value: any): value is VNode {
  return value ? value.__v_isVNode === true : false
}

/**
* 生成一个 VNode 对象，并返回
* @param type vnode.type
* @param props 标签属性或自定义属性
* @param children 子节点
* @returns vnode 对象
*/
export function createVNode(type, props, children): VNode {
  // 解析props
  if (props) {
    // 处理 class
    let { class: klass, style } = props
    if (klass && !isString(klass)) {
      props.class = normalizeClass(klass)
    }
  }

  // 此处进行DOM类型的计算
  // 通过 bit 位处理 shapeFlag 类型
  // 如果是string类型就当做ELEMENT来看，不是的话就直接给个0
  const shapeFlag = isString(type) ? ShapeFlags.ELEMENT :
  isObject(type) ? ShapeFlags.STATEFUL_COMPONENT : 0

  return createBaseVNode(type, props, children, shapeFlag)
}

export { createVNode as createElementVNode }

/**
* 构建基础 vnode
*/
function createBaseVNode(type, props, children, shapeFlag) {
  // 先创建VNode对象
  const vnode = {
    __v_isVNode: true,
    type,
    props,
    shapeFlag,
    key: props?.key || null
  } as VNode

  // 解析/标准化当前VNode的children是什么类型
  normalizeChildren(vnode, children)

  return vnode
}

// normalizeChildren()函数用于对组件的子节点进行规范化处理，将子节点转换为标准的VNode数组。它支持处理字符串、数组和对象类型的子节点，并递归处理多层嵌套的子节点。
export function normalizeChildren(vnode: VNode, children: unknown) {
  // 根虎当前children的状态进行解析
  let type = 0

//   const { shapeFlag } = vnode
  if (children == null) {
    children = null
  } else if (isArray(children)) {
    type = ShapeFlags.ARRAY_CHILDREN
  } else if (typeof children === 'object') {

  } else if (isFunction(children)) {

  } else {
    // children是字符串的情况
    children = String(children)
    type = ShapeFlags.TEXT_CHILDREN
  }

  vnode.children = children
  // 按位进行或运算，转成32位的二进制然后按位进行或运算
  // 这行代码相当于 vnode.shapeFlag = vnode.shapeFlag | type
  // 将DOM的类型和子节点children的类型通过或运算合起来，这样就可以同时表示DOM类型和children的类型
  vnode.shapeFlag |= type
}

/**
 * 根据 key || type 判断是否为相同类型节点
 */
export function isSameVNodeType(n1: VNode, n2: VNode): boolean {
  return n1.type === n2.type && n1.key === n2.key
}

/**
 * 创建注释节点
 */
export function createCommentVNode(text) {
  return createVNode(Comment, null, text)
}
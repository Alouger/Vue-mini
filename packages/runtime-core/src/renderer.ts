import { ShapeFlags } from "packages/shared/src/shapeFlags"
import { Fragment, isSameVNodeType } from "./vnode"
import { EMPTY_OBJ } from "@vue/shared"

export interface RendererOptions {
  // patchProp是为指定的element的props打补丁
  // prevValue指旧的value，nextValue指新的value
  patchProp(el: Element, key: string, prevValue: any, nextValue: any): void
  // setElementText是为指定的Element设置text
  setElementText(node: Element, text: string): void
  // 插入指定的el到parent中，anchor表示插入的位置，即：锚点
  insert(el, parent: Element, anchor?): void
  // 创建Element
  createElement(type: string)
  /**
   * 卸载指定dom
   */
  remove(el): void
}

/**
 * 对外暴露的创建渲染器的方法
 */
// RendererOptions里面是一些兼容性的方法
export function createRenderer(options: RendererOptions) {
  return baseCreateRenderer(options)
}

/**
 * 生成 renderer 渲染器
 * @param options 兼容性操作配置对象
 * @returns
 */
function baseCreateRenderer(options: RendererOptions): any {
   /**
   * 解构 options，获取所有的兼容性方法。一系列用于操作DOM的辅助函数，如insert、remove、patch等。这些函数负责实际的DOM操作，用于将虚拟DOM转换为实际的DOM，并进行插入、删除、更新等操作
   */
  const {
    insert: hostInsert,
    patchProp: hostPatchProp,
    createElement: hostCreateElement,
    setElementText : hostSetElementText,
    remove: hostRemove
  } = options
  
  const processElement = (oldVNode, newVNode, container, anchor) => {
    // 根据旧节点是否存在来判断我们当前是要进行挂载操作还是更新操作
    if (oldVNode === null) {
      // 为空，进行挂载
      mountElement(newVNode, container,anchor)
    } else {
      // 不为空，进行更新
      patchElement(oldVNode, newVNode)
    }
  }
  /**
   * element 的挂载操作
   */
  const mountElement = (vnode, container, anchor) => {
    // 执行挂载本质上就是创建element，设置文本子节点，处理props插入
    const { type, props, shapeFlag } = vnode
    // 1. 创建element, 这里的el和vnode中的el进行了浅绑定。这里传入的type是虚拟节点vnode的type，假设vnode的type是div，那么这里hostCreateElement返回的也是div标签，所以最终el等于div标签，vnode.el也等于div标签
    // 源码里写的是 el = vnode.el = hostCreateElement(...), 相当于是让el和vnode.el进行浅拷贝，然后最终的值等于hostCreateElement()
    const el = (vnode.el = hostCreateElement(type))
    // 如果能按位匹配上TEXT_CHILDREN
    // dubug时shapeFlag = 9, 二进制为00000000 00000000 00000000 00001001
    // 而ShapeFlags.TEXT_CHILDREN = 8, 二进制为00000000 00000000 00000000 00001000
    // 两者进行与运算结果为00000000 00000000 00000000 00001000，十进制为8，不为0，所以if(8)判定为true
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 2. 设置文本
      // host开头的本质上都是我们传递过来的这个nodeOps里面这个浏览器相关的函数
      hostSetElementText(el, vnode.children as string)
    } else if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {

    }

    // 3. 设置props
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key])
      }
    }

    // 4. 插入
    hostInsert(el, container, anchor)
  }

  const patchElement = (oldVNode, newVNode) => {
    // 三者进行一个浅拷贝，都指向同一块内存空间
    const el = (newVNode.el = oldVNode.el)
    // 获取新旧props
    const oldProps = oldVNode.props || EMPTY_OBJ
    const newProps = newVNode.props || EMPTY_OBJ

    // 更新子节点
    patchChildren(oldVNode, newVNode, el, null)

    patchProps(el, newVNode, oldProps, newProps)
  }
   /**
    * 为子节点打补丁
    */
  const patchChildren = (oldVNode, newVNode, container, anchor) => {
    // 逻辑中断
    const c1 = oldVNode && oldVNode.children
    // 获取旧的shapeFlag
    const prevShapeFlag = oldVNode ? oldVNode.shapeFlag : 0
    const c2 = newVNode && newVNode.children
    // 新的newVNode中必然存在shapeFlag
    const { shapeFlag } = newVNode
    // 新子节点为 TEXT_CHILDREN
    if (shapeFlag & ShapeFlags.TEXT_CHILDREN) {
      // 新子节点为 TEXT_CHILDREN，旧子节点为 ARRAY_CHILDREN
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // TODO: 卸载旧子节点
      }
      // 新旧子节点不同
      if (c2 !== c1) {
        // 挂载新子节点的文本
        hostSetElementText(container, c2 as string)
      }
    } else {
      // 新节点不是TEXT_CHILDREN，旧子节点为 ARRAY_CHILDREN
      if (prevShapeFlag & ShapeFlags.ARRAY_CHILDREN) {
        // 新子节点也为 ARRAY_CHILDREN，旧子节点为 ARRAY_CHILDREN
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // TODO: 这里要进行 diff 运算
        }
        // 新子节点不为 ARRAY_CHILDREN，旧子节点为 ARRAY_CHILDREN，则直接卸载旧子节点
        else {
          // TODO: 卸载
        }
      } else {
        // 新节点不是TEXT_CHILDREN，旧子节点为 TEXT_CHILDREN
        if (prevShapeFlag & ShapeFlags.TEXT_CHILDREN) {
          // 删除旧的文本
          hostSetElementText(container, '')
        }
        // 新子节点为 ARRAY_CHILDREN，旧子节点不为 ARRAY_CHILDREN
        if (shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
          // TODO: 单独挂载新子节点操作
        }
      }
    }
  }
  /**
   * 为 props 打补丁
   */
  const patchProps = (el: Element, vnode, oldProps, newProps) => {
    // debugger
    // 新旧 props 不相同时才进行处理
    if (oldProps !== newProps) {
      // 遍历新的 props，依次触发 hostPatchProp ，赋值新属性
      for (const key in newProps) {
        const next = newProps[key]
        const prev = oldProps[key]
        if (next !== prev) {
          hostPatchProp(el, key, prev, next)
        }
      }
      // 存在旧的 props 时
      if (oldProps !== EMPTY_OBJ) {
        // 遍历旧的 props，依次触发 hostPatchProp ，删除不存在于新props 中的旧属性
        for (const key in oldProps) {
          if (!(key in newProps)) {
            hostPatchProp(el, key, oldProps[key], null)
          }
        }
      }
    }
  }

  const patch = (oldVNode, newVNode, container, anchor = null) => {
    if (oldVNode === newVNode) {
      return
    }
    // debugger
    /**
     * 判断是否为相同类型节点
     */
    if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
        unmount(oldVNode)
        oldVNode = null
    }

    const { type, shapeFlag } = newVNode

    switch (type) {
      case Text:
        break
      case Comment:
        break
      case Fragment:
        break
      default:
        // 如果按位进行与运算能匹配到ELEMENT
        // debug时传入的shapeFlag为9，二进制为00000000 00000000 00000000 00001001
        // 同时ShapeFlags.ELEMENT = 1, 二进制为00000000 00000000 00000000 00000001，
        // 进行与运算就是00000000 00000000 00000000 00000001，十进制就是1，那么if(1)就判定为true
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(oldVNode, newVNode, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {

        }
    }
  }

  const unmount = vnode => {
    hostRemove(vnode.el!)
  }

  // 源码中这里是有第三个参数，也就是isSVG，但这里我们不考虑这种情况
  const render = (vnode, container) => {
    // debugger
    if (vnode === null) {
      // 如果vnode为空，我们执行卸载操作
      // TODO: 卸载
      if (container._vnode) {
        unmount(container._vnode)
      }
    } else {
      // 如果不为空，我们就执行一个打补丁的操作（包括了挂载和更新）
      // 第一个参数是旧节点，如果没有的话就传null
      console.log(container);
      
      patch(container._vnode || null, vnode, container)
    }

    container._vnode = vnode
  }

  return {
    render
  }
}
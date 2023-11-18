import { ShapeFlags } from "packages/shared/src/shapeFlags"
import { Fragment, isSameVNodeType, normalizeChildren } from "./vnode"
import { EMPTY_OBJ, isString } from "@vue/shared"
import { normalizeVNode, renderComponentRoot } from "./componentRenderUtils"
import { createComponentInstance, setupComponent } from "./component"
import { ReactiveEffect } from "packages/reactivity/src/effect"
import { queuePreFlushCb } from "./scheduler"

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
  remove(el): void,
  /**
   * 创建 Text 节点
   */
  createText(text: string),
  /**
   * 设置 text
   */
  setText(node, text),
  /**
   * 设置 text
   */
  createComment(text: string)
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
    remove: hostRemove,
    createText: hostCreateText,
    setText: hostSetText,
    createComment: hostCreateComment
  } = options

  /**
   * 组件的打补丁操作
   */
  const processComponet = (oldVNode, newVNode, container, anchor) => {
    // debugger
    if (oldVNode == null) {
      // 挂载
      mountComponent(newVNode, container, anchor)
    }
  }

  /**
   * Fragment 的打补丁操作
   */
  const processFragment = (oldVNode, newVNode, container, anchor) => {
    if (oldVNode == null) {
      mountChildren(newVNode.children, container, anchor)
    } else {
      patchChildren(oldVNode, newVNode, container, anchor)
    }
  }

  /**
   * Comment 的打补丁操作
   */
  const processCommentNode = (oldVNode, newVNode, container, anchor) => {
    // 不存在旧的节点，则为 挂载 操作
    if (oldVNode == null) {
      // 生成节点
      newVNode.el = hostCreateComment(newVNode.children)
      // 挂载
      hostInsert(newVNode.el, container, anchor)
    } else {
      // 无更新
      // vue3中并不支持注释的动态更新
      newVNode.el = oldVNode.el
    }
  }

  /**
   * Text 的打补丁操作
   */
  const processText = (oldVNode, newVNode, container, anchor) => {
    // 不存在旧的节点，则为 挂载 操作
    if (oldVNode == null) {
      // 生成节点
      newVNode.el = hostCreateText(newVNode.children)
      // 挂载
      hostInsert(newVNode.el, container, anchor)
    } else {
      // 存在旧的节点，则为 更新 操作
      // 更新, 感叹号的作用是断言oldVNode是必然存在的
      const el = (newVNode.el = oldVNode.el!)
      if (newVNode.children !== oldVNode.children) {
        hostSetText(el, newVNode.children)
      }
    }
  }

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

  const mountComponent = (initialVNode, container, anchor) => {
    // 先生成组件的实例
    initialVNode.component = createComponentInstance(initialVNode)
    // 浅拷贝，绑定同一块内存空间
    const instance = initialVNode.component

    // 标准化组件实例数据
    setupComponent(instance)
    // 该函数负责真正渲染组件，设置组件渲染
    setupRenderEffect(instance, initialVNode, container, anchor)
  }
  /**
   * 设置组件渲染
   */
  const setupRenderEffect = (instance, initialVNode, container, anchor) => {
    // 组件挂载和更新的方法
    const componentUpdateFn = () => {
      // 当前处于 mounted 之前，即执行 挂载 逻辑
      if (!instance.isMounted) {
        // 获取 hook
        const {bm, m} = instance

        // beforeMount hook
        if (bm) {
          bm()
        }

        // debugger
        // subTree得到的就是案例component中render函数返回的h('div', 'hello component')，一个VNode。debugger到这里显示的是：
        // subTree: 
        //   children: "hello component"
        //   props: null
        //   shapeFlag: 9
        //   type: "div"
        //   __v_isVNode: true
        // 从 render 中获取需要渲染的内容
        const subTree = (instance.subTree = renderComponentRoot(instance))
        // 通过 patch 对 subTree，进行打补丁。即：渲染组件
        patch(null, subTree, container, anchor)

        // mounted hook
        if (m) {
          m()
        }

        /** 经过patch函数后subTree新增el，为：
         * subTree: 
             children: "hello component"
             el: div
             props: null
             shapeFlag: 9
             type: "div"
             __v_isVNode: true
         */
        // 把组件根节点的 el，作为组件的 el
        initialVNode.el = subTree.el

        // 在渲染完毕后，把标志位isMounted修改为true
        instance.isMounted = true
      } else {
        let { next, vnode } = instance
        if (!next) {
          next = vnode
        }
        // 获取下一次的 subTree
        const nextTree = renderComponentRoot(instance)
        // 保存上一次的subTree，以便进行更新操作
        const prevTree = instance.subTree
        instance.subTree = nextTree
        // 更新
        patch(prevTree, nextTree, container, anchor)
        // 更新 next
        next.el = nextTree.el
      }
    }
    // 创建包含 scheduler 的 effect 实例
    const effect = (instance.effect = new ReactiveEffect(componentUpdateFn, () => queuePreFlushCb(update)))
    // 生成 update 函数
    const update = (instance.update = () => effect.run())
    // 触发 update 函数，本质上触发的是 componentUpdateFn
    update()
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
      mountChildren(vnode.children, el, anchor)
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
   * 挂载子节点
   */
  const mountChildren = (children, container, anchor) => {
    if (isString(children)) {
      // 把字符串转成了数组
      children = children.split('')
    }
    // 对children的循环渲染
    for (let i = 0; i < children.length; i++) {
      const child = (children[i] = normalizeVNode(children[i]))
      // 渲染
      patch(null, child, container, anchor)
    }
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
          patchKeyedChildren(c1, c2, container, anchor)
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
   * diff
   */
  const patchKeyedChildren = (oldChildren, newChildren, container, parentAnchor) => {
    // 索引
    let i = 0
    // 新的子节点数组的长度
    const newChildrenLength = newChildren.length
    // 旧的子节点最大（最后一个）下标
    let oldChildrenEnd = oldChildren.length - 1
    // 新的子节点最大（最后一个）下标
    let newChildrenEnd = newChildrenLength - 1

    // 1. 自前向后diff 对比。经过该循环之后，从前开始的相同 vnode 将被处理
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[i]
      const newVNode = normalizeVNode(newChildren[i])
      // 如果 oldVNode 和 newVNode 被认为是同一个 vnode，则直接 patch 即可
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode,container, null)
      } else {
        // 如果不被认为是同一个 vnode，则直接跳出循环
        break
      }
       // 下标自增
      i++
    }

    // 2. 自后向前diff对比。经过该循环之后，从后开始的相同 vnode 将被处理
    while (i <= oldChildrenEnd && i <= newChildrenEnd) {
      const oldVNode = oldChildren[oldChildrenEnd]
      const newVNode = newChildren[newChildrenEnd]
      if (isSameVNodeType(oldVNode, newVNode)) {
        patch(oldVNode, newVNode, container, null)
      } else {
        break
      }
      oldChildrenEnd--
      newChildrenEnd--
    }

    // 3. 新节点多于旧节点
    if (i > oldChildrenEnd) {
      if (i <= newChildrenEnd) {
        const nextPos = newChildrenEnd + 1
        // 锚点anchor决定了我们新节点渲染的位置，表示我们新增的这个节点要被插入到锚点之前上去
        const anchor = nextPos < newChildrenLength ? newChildren[nextPos].el : parentAnchor
        while(i <= newChildrenEnd) {
          // 因为我们是新增节点，所有patch函数在形参列表第一个参数（代表旧节点）可以是null
          patch(null, normalizeVNode(newChildren[i]), container, anchor)
          i++
        }
      }
    }
    // 4. 旧节点多于新节点
    else if (i > newChildrenEnd) {
      while (i <= oldChildrenEnd) {
        unmount(oldChildren[i])
        i++
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
        processText(oldVNode, newVNode, container, anchor)
        break
      case Comment:
        processCommentNode(oldVNode, newVNode, container, anchor)
        break
      case Fragment:
        processFragment(oldVNode, newVNode, container, anchor)
        break
      default:
        // 如果按位进行与运算能匹配到ELEMENT
        // debug时传入的shapeFlag为9，二进制为00000000 00000000 00000000 00001001
        // 同时ShapeFlags.ELEMENT = 1, 二进制为00000000 00000000 00000000 00000001，
        // 进行与运算就是00000000 00000000 00000000 00000001，十进制就是1，那么if(1)就判定为true
        if (shapeFlag & ShapeFlags.ELEMENT) {
          processElement(oldVNode, newVNode, container, anchor)
        } else if (shapeFlag & ShapeFlags.COMPONENT) {
          processComponet(oldVNode, newVNode, container, anchor)
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
      // 新的 vnode 不存在，旧的 vnode 存在，说明当前属于 unmount 操作
      if (container._vnode) {
        unmount(container._vnode)
      }
    } else {
      // 如果不为空，我们就执行一个打补丁的操作（包括了挂载和更新）
      // 第一个参数是旧节点，如果没有的话就传null
      console.log(container);
      
      patch(container._vnode || null, vnode, container)
    }
    // 将新的 vnode 存储到 container._vnode 中，即后续渲染中旧的 vnode
    container._vnode = vnode
  }

  return {
    render
  }
}
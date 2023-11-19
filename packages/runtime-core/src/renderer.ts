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
    // 5. 乱序的 diff 比对
    else {
    // 旧子节点的开始索引
    const oldStartIndex = i
    // 新子节点的开始索引
    const newStartIndex = i
    
    // 5.1 build key: index map for newChildren
    // 遍历新节点，生成keyToNewIndexMap
    // 键值为新节点的key值，值为新节点的索引, 伪代码：keyToNewIndexMap<key, index> 
    const keyToNewIndexMap = new Map()
    for (i = newStartIndex; i <= newChildrenEnd; i++) {
      // 从 newChildren 中根据开始索引获取每一个 child
      const nextChild = normalizeVNode(newChildren[i])
      // child 必须存在 key（这也是为什么 v-for 必须要有 key 的原因）
      if (nextChild.key != null) {
        // 把 key 和 对应的索引，放到 keyToNewIndexMap 对象中
        keyToNewIndexMap.set(nextChild.key, i)
      }
    }
  
    // 5.2 创建将要patch的节点数组newIndexToOldIndexMap, 并尝试进行 patch（打补丁）或 unmount（删除）旧节点
    // 下标为新节点的索引，值为旧节点的索引+1
    let j
    // 记录已经 patch 的节点数
    let patched = 0
    // 计算新节点中还有多少节点需要被 patch
    const toBePatched = newChildrenEnd - newStartIndex + 1
    // 标记是否需要移动
    let moved = false
    // 记录这次对比的旧节点到新节点最长可复用的索引, 配合 moved 进行使用，它始终保存当前最大的 index 值
    let maxNewIndexSoFar = 0
    /**
     * 创建将要patch的节点数组
     * 新节点对应旧节点的数组
     * 数组下标为新节点的索引(即 当前newChildrenIndex - newStartIndex)，值为旧节点的索引+1
     */
    const newIndexToOldIndexMap = new Array(toBePatched)
    /**
     * 默认置为 0
     * 表示新增节点
     * 这也是为什么值是 旧节点索引+1 而不直接存索引的原因了
     * 后续判断是否存在可复用的旧节点再重新赋值
     */
    for (i = 0; i < toBePatched; i++) newIndexToOldIndexMap[i] = 0
    // 遍历 oldChildren（s1 = oldChildrenStart; e1 = oldChildrenEnd），
    // 获取旧节点（oldChildren），如果当前 已经处理的节点数量 > 待处理的节点数量，
    // 那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
    for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
      // 获取一下旧虚拟节点
      const prevChild = oldChildren[i]
      if (patched >= toBePatched) {
        // 已经patch的节点数量大于或等于需要被patch的节点数
        // 说明当前节点是需要被删除的
        // patched >= toBePatched代表新vnode已经循环完成，不需要再找复用的旧vnode
        // 说明剩下还没复用的旧vnode都已经废弃，直接unmount()移除，一般发生在旧vnode末尾存在废弃节点
        unmount(prevChild)
        continue
      }
      // 遍历 oldChildren（s1 = oldChildrenStart; e1 = oldChildrenEnd），获取旧节点（c1 = oldChildren），如果当前 已经处理的节点数量 > 待处理的节点数量，那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
      // 获取当前旧节点对应的新节点索引
      let newIndex
      // -------- 寻找能够复用的vnode的newIndex --------------
      // 旧节点的 key 存在时
      if (prevChild.key != null) {
        /**
         * 旧节点存在key值
         * 直接在 keyToNewIndexMap 查找
         * 获取新节点的索引（newIndex）
         */
        newIndex = keyToNewIndexMap.get(prevChild.key)
      }
      // 最终没有找到新节点的索引，则证明：当前旧节点没有对应的新节点
      if (newIndex === undefined) {
        /**
         * newIndex 为 undefined
         * 说明当前旧节点在新的虚拟 DOM 树中被删了
         * 直接卸载
         */
        unmount(prevChild)
      }
      else {
        // -------- 寻找能够复用的vnode的newIndex --------------
        /**
         * newIndex有值
         * 说明当前旧节点在新节点数组中还存在，可能只是挪了位置
         * 那么接下来就是要判断对于该新节点而言，是要 patch（打补丁）还是 move（移动）
         */
        /**
         * 记录一下 newIndexToOldIndexMap
         * 表明当前新旧节点需要 patch
         */
        // ========逻辑3：newIndexToOldIndexMap和move的构建为下一步骤做准备========
        // 因为 newIndex 包含已处理的节点，所以需要减去newChildrenStart, 表示：不计算已处理的节点
        newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1
        if (newIndex >= maxNewIndexSoFar) {
          // 持续递增, 新节点索引大于或等于最长可复用索引，重新赋值
          maxNewIndexSoFar = newIndex
        } else {
          /**
           * 反之
           * 说明新节点在最长可复用节点的左侧
           * 需要移动（左移）
           * newIndex < maxNewIndexSoFar说明目前的旧vnode的位置应该移动到它前面旧vnode的前面去，即目前的旧vnode是需要移动的
           */
          moved = true
        }
        // ========逻辑3：newIndexToOldIndexMap和move的构建为下一步骤做准备========
        // -------- 寻找了能够复用的vnode的newIndex，更新能复用的旧vnode --------------
        // 直接复用，patch（处理可能存在的孙子节点、更新一下属性等）
        patch(prevChild, newChildren[newIndex], container, null)
        patched++
      }
    }

    // 5.3：移动/新增处理
    // 由步骤5.2可以知道，该步骤会移除所有废弃的旧vnode，
    // 因此剩余的逻辑只有 移动可复用的vnode到正确的位置 + 插入之前没有过的新vnode
    /**
     * 仅当节点需要移动的时候，我们才需要生成最长递增子序列，否则只需要有一个空数组即可
     * 根据 newIndexToOldIndexMap 数组
     * 生成最长稳定序列
     * 最长稳定序列在这里存的就是不需要移动的节点索引
     */
    const increasingNewIndexSequence = moved
      ? getSequence(newIndexToOldIndexMap)
      : []
    
    // 最长稳定序列末尾节点索引
    // j >= 0 表示：初始值为 最长递增子序列的最后下标
    // j < 0 表示：《不存在》最长递增子序列。
    j = increasingNewIndexSequence.length - 1
    // 从后往前遍历需要 patch 的节点数
    // 从尾->头进行新vnode的遍历
    // 使用倒序遍历新的children数组是因为以便我们可以使用最后修补的节点作为锚点, 如果没有相同的后置元素，则添加到container子元素的末尾，如果有相同的后置元素，则以最前面一个后置元素作为anchor
    for (i = toBePatched - 1; i >= 0; i--) {
      // 新虚拟节点索引
      // 在步骤5.2的计算是const toBePatched = newChildrenEnd - newStartIndex + 1
      // 所以newChildrenEnd = newStartIndex + toBePatched - 1
      //                    = newStartIndex + i
      // nextIndex（需要更新的新节点下标） = newChildrenStart + i
      const nextIndex = newStartIndex + i
      // 新虚拟节点
      const nextChild = newChildren[nextIndex]
      // 将新节点的真实 DOM 作为后续插入的锚点（是否超过了最长长度）
      const anchor =
        nextIndex + 1 < newChildrenLength
          ? newChildren[nextIndex + 1].el
          : parentAnchor
      if (newIndexToOldIndexMap[i] === 0) {
        /**
         * newIndexToOldIndexMap是以newChildrenArray建立的初始化都为0的数组，
         * 然后在步骤5.2 逻辑3进行oldChildrenArray的遍历，找到可以复用的新vnode，
         * 进行newIndexToOldIndexMap[xxx]=旧vnode的index+1的赋值，
         * 因此newIndexToOldIndexMap[xxx]=0就代表这个新vnode是之前没有过的，
         * 直接进行patch(null, nextChild)，即mount()插入新的元素
         * 为 0 的话就是新增的节点
         * 直接挂载新节点
         */
        patch(null, nextChild, container, anchor)
      } else if (moved) {
        // j < 0 表示：不存在 最长递增子序列
        // i !== increasingNewIndexSequence[j] 表示：当前节点不在最后位置
        // 那么此时就需要 move （移动）
        if (j < 0 || i !== increasingNewIndexSequence[j]) {
          /**
           * 当前索引不在最长递增序列中
           * 移动当前索引对应的新节点
           * 移动到锚点节点之前
           */
          move(nextChild, container, anchor)
        } else {
          j--
        }
      }
    }
  }
  
    
  }
 
  /**
   * 移动节点到指定位置
   */
  const move = (vnode, container, anchor) => {
    const { el } = vnode
    hostInsert(el!, container, anchor)
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

/**
 * 获取最长递增子序列下标
 * 维基百科：https://en.wikipedia.org/wiki/Longest_increasing_subsequence
 * 百度百科：https://baike.baidu.com/item/%E6%9C%80%E9%95%BF%E9%80%92%E5%A2%9E%E5%AD%90%E5%BA%8F%E5%88%97/22828111
 */
function getSequence(arr) {
  // 获取一个数组浅拷贝。注意 p 的元素改变并不会影响 arr
  // p 是一个最终的回溯数组，它会在最终的 result 回溯中被使用
  // 它会在每次 result 发生变化时，记录 result 更新前最后一个索引的值
  const p = arr.slice()
  // 定义返回值（最长递增子序列下标），因为下标从 0 开始，所以它的初始值为 0
  const result = [0]
  let i, j, u, v, c
  // 当前数组的长度
  const len = arr.length
  // 对数组中所有的元素进行 for 循环处理，i = 下标
  for (i = 0; i < len; i++) {
    // 根据下标获取当前对应元素
    const arrI = arr[i]
    //
    if (arrI !== 0) {
      // 获取 result 中的最后一个元素，即：当前 result 中保存的最大值的下标
      j = result[result.length - 1]
      // arr[j] = 当前 result 中所保存的最大值
      // arrI = 当前值
      // 如果 arr[j] < arrI 。那么就证明，当前存在更大的序列，那么该下标就需要被放入到 result 的最后位置
      if (arr[j] < arrI) {
        p[i] = j
        // 把当前的下标 i 放入到 result 的最后位置
        result.push(i)
        continue
      }
      // 不满足 arr[j] < arrI 的条件，就证明目前 result 中的最后位置保存着更大的数值的下标。
      // 但是这个下标并不一定是一个递增的序列，比如： [1, 3] 和 [1, 2]
      // 所以我们还需要确定当前的序列是递增的。
      // 计算方式就是通过：二分查找来进行的

      // 初始下标
      u = 0
      // 最终下标
      v = result.length - 1
      // 只有初始下标 < 最终下标时才需要计算
      while (u < v) {
        // (u + v) 转化为 32 位 2 进制，右移 1 位 === 取中间位置（向下取整）例如：8 >> 1 = 4;  9 >> 1 = 4; 5 >> 1 = 2
        // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Right_shift
        // c 表示中间位。即：初始下标 + 最终下标 / 2 （向下取整）
        c = (u + v) >> 1
        // 从 result 中根据 c（中间位），取出中间位的下标。
        // 然后利用中间位的下标，从 arr 中取出对应的值。
        // 即：arr[result[c]] = result 中间位的值
        // 如果：result 中间位的值 < arrI，则 u（初始下标）= 中间位 + 1。即：从中间向右移动一位，作为初始下标。 （下次直接从中间开始，往后计算即可）
        if (arr[result[c]] < arrI) {
          u = c + 1
        } else {
          // 否则，则 v（最终下标） = 中间位。即：下次直接从 0 开始，计算到中间位置 即可。
          v = c
        }
      }
      // 最终，经过 while 的二分运算可以计算出：目标下标位 u
      // 利用 u 从 result 中获取下标，然后拿到 arr 中对应的值：arr[result[u]]
      // 如果：arr[result[u]] > arrI 的，则证明当前  result 中存在的下标 《不是》 递增序列，则需要进行替换
      if (arrI < arr[result[u]]) {
        if (u > 0) {
          p[i] = result[u - 1]
        }
        // 进行替换，替换为递增序列
        result[u] = i
      }
    }
  }
  // 重新定义 u。此时：u = result 的长度
  u = result.length
  // 重新定义 v。此时 v = result 的最后一个元素
  v = result[u - 1]
  // 自后向前处理 result，利用 p 中所保存的索引值，进行最后的一次回溯
  while (u-- > 0) {
    result[u] = v
    v = p[v]
  }
  return result
}

import { NodeTypes } from './ast'
import { isSingleElementRoot } from './hoistStatic'
import { TO_DISPLAY_STRING } from './runtimeHelpers'

/**
 * transform 上下文对象
 */
export interface TransformContext {
  /**
   * AST 根节点
   */
  root
  /**
   * 每次转化时记录的父节点, 这样在递归到子节点之后就能通过 context.parent 来访问到它的父节点
   */
  parent: ParentNode | null
  /**
   * 每次转化时记录的子节点索引
   */
  childIndex: number
  /**
   * 当前处理的节点
   */
  currentNode
  /**
   * 协助创建 JavaScript AST 属性 helpers，该属性是一个数组，值为 Symbol(方法名)，表示 render 函数中创建 节点 的方法
   * helpers它的最终目的就是方便我们在生成render函数时，从Vue上去获取对应的方法。
   */
  helpers: Map<symbol, number>
  // helper帮助我们处理helpers
  helper<T extends symbol>(name: T): T
  /**
   * 转化方法集合
   */
  nodeTransforms: any[]
}
/**
 * 创建 transform 上下文
 */
// 第二个参数我们只需要nodeTransforms，这里应该用了解构
export function createTransformContext(root, { nodeTransforms = [] }) {
  const context: TransformContext = {
    nodeTransforms,
    root,
    helpers: new Map(),
    currentNode: root,
    parent: null,
    childIndex: 0,
    helper(name) {
      const count = context.helpers.get(name) || 0
      context.helpers.set(name, count + 1)
      return name
    }
  }
  return context
}

/**
 * 根据 AST 生成 JavaScript AST
 * @param root AST
 * @param options 配置对象
 */
export function transform(root, options) {
  // 创建 transform 上下
  const context = createTransformContext(root, options)
  traverseNode(root, context)

  createRootCodegen(root)

  root.helpers = [...context.helpers.keys()]
  // 下面这些空数组源码里是有处理的，我们在此项目中不做处理了，如果申明这些数组的话可能会报错
  root.components = []
  root.directives = []
  root.imports = []
  root.hoists = []
  root.temps = []
  root.cached = []
}
/**
 * 遍历转化节点，转化的过程一定要是深度优先的（即：孙 -> 子 -> 父），因为当前节点的状态往往需要根据子节点的情况来确定。
 * 转化的过程分为两个阶段：
 * 1. 进入阶段：存储所有节点的转化函数到 exitFns 中
 * 2. 退出阶段：执行 exitFns 中缓存的转化函数，且一定是倒叙的。因为只有这样才能保证整个处理过程是深度优先的
 */
export function traverseNode(node, context: TransformContext) {
  // 通过上下文记录当前正在处理的 node 节点, 就是为了维护当前正在转换的AST节点，以便于在移除节点或替换节点时可以快速找到当前节点
  context.currentNode = node
  // 获取当前所有 node 节点的 transform 方法  apply transform plugins
  const { nodeTransforms } = context
  // 存储转换函数返回的另外一个函数，
  // 在 转换AST节点的退出阶段会执行存储在exitFns中的函数
  /**
   * 为什么还需要将转换函数执行后返回的函数添加到 exitFns 数组中呢？
   * 因为我们是深度优先遍历的过程，在转换模板AST节点的过程中，往往需要根据其子节点的情况来决定如何对当前节点进行转换。
   * 这就要求父节点的转换操作必须等待其所有子节点全部转换完毕后再执行。
   */
  const exitFns: any = []
  // 循环获取节点的 transform 方法，缓存到 exitFns 中
  for (let i = 0; i < nodeTransforms.length; i++) {
    // nodeTransforms[i](node, context)执行好后返回里面的闭包函数
    const onExit = nodeTransforms[i](node, context)
    if (onExit) {
      exitFns.push(onExit)
    }
  }
  // 我们所有的节点都有对应的子节点，我们不可能只处理父节点，不去处理子节点
  // 继续转化子节点
  switch (node.type) {
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      traverseChildren(node, context)
      break
    case NodeTypes.INTERPOLATION:
      context.helper(TO_DISPLAY_STRING)
      break
  }
  
  // ---------------- 进入阶段完成 ----------------
  // ---------------- 退出阶段开始 ----------------
  
  // 在退出时执行 transform
  // 在节点处理的最后阶段执行缓存到 exitFns 中的回调函数
  // 注意，这里我们要反序执行
  context.currentNode = node
  let i = exitFns.length
  while(i--) {
    // 依次执行我们存储的转化函数(倒序，因为只有这样才能保证整个处理过程是深度优先的)
    exitFns[i]()
  }
}

/**
 * 循环处理子节点
 */
export function traverseChildren(parent, context: TransformContext) {
  // 循环依次处理子节点
  parent.children.forEach((node, index) => {
    /**
     * traverseChildren 函数做的事情很简单，
     * 就是递归地调用 traverseNode 函数对子节点进行转换。上面代码的关键点在于，
     * 在递归地调用 traverseNode 函数进行子节点的转换之前，
     * 必须设置 context.parent 和 context.childIndex 的值，
     * 这样才能保证在接下来的递归转换中，context 对象所存储的信息是正确的。
     */
    context.parent = parent
    context.childIndex = index
    traverseNode(node, context)
  })
}

/**
 * 生成 root 节点下的 codegen
 */
function createRootCodegen(root) {
    const { children } = root
    
    // Vue2仅支持单个根节点，Vue3支持多个根节点
    // 仅支持一个根节点的处理
    if (children.length === 1) {
      // 获取单个根节点
      const child = children[0]
      if (isSingleElementRoot(root, child) && child.codegenNode) {
        const codegenNode = child.codegenNode
        root.codegenNode = codegenNode
      }
    }
  }
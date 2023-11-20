import { NodeTypes, createVNodeCall } from "../ast"
/**
 * 对 element 节点的转化方法
 */
export const transformElement = (node, context) => {
  // 闭包函数
  // 将转换代码编写在退出节点的回调函数中
  // 这样可以保证该标签节点的子节点全部被处理完毕
  return function postTransformElement() {
    // 从转换上下文中获取当前转换的的节点
    node = context.currentNode
    // 仅处理 ELEMENT 类型
    if (node.type !== NodeTypes.ELEMENT) {
      return
    }

    const { tag } = node
    let vnodeTag = `"${tag}"`
    let vnodeProps = []
    let vnodeChildren = node.children

    // 将当前标签节点对应的 JavaScript AST 添加到 codegenNode 属性下
    // transform里面的核心就是给node节点增加了codegenNode属性
    // 调用 createVNodeCall 返回对应的节点属性
    // 返回的值挂载在 codegen 属性上
    node.codegenNode = createVNodeCall(
        context,
        vnodeTag,
        vnodeProps,
        vnodeChildren
    )
  }
}
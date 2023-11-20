import { NodeTypes } from '../ast'
import { isText } from '../utils'

/**
 * 将相邻的文本节点和表达式合并为一个表达式。
 *
 * 例如:
 * <div>hello {{ msg }}</div>
 * 上述模板包含两个节点：
 * 1. hello：TEXT 文本节点
 * 2. {{ msg }}：INTERPOLATION 表达式节点
 * 这两个节点在生成 render 函数时，需要被合并： 'hello' + _toDisplayString(_ctx.msg)
 * 那么在合并时就要多出来这个 + 加号。
 * 例如：
 * children:[
 * 	{ TEXT 文本节点 },
 *  " + ",
 *  { INTERPOLATION 表达式节点 }
 * ]
 */
export const transformText = (node, context) => {
  if (
    node.type === NodeTypes.ROOT ||
    node.type === NodeTypes.ELEMENT ||
    node.type === NodeTypes.FOR ||
    node.type === NodeTypes.IF_BRANCH
  ) {
    // 将转换代码编写在退出节点的回调函数中
    // 这样可以保证该标签节点的子节点全部都被处理完毕
    return () => {
      // 先拿到所有的children
      const children = node.children
      // 当前容器
      let currentContainer
      // 循环处理所有的子节点
      for (let i = 0; i < children.length; i++) {
        const child = children[i]
        if (isText(child)) {
          // j = i + 1 表示下一个节点，j是i后面的第一个节点，也就是说j是i的下一个节点
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j]

            // 当前节点 child 和 下一个节点 next 都是 Text 节点
            if (isText(next)) {
              if (!currentContainer) {
                // 生成一个复合表达式节点, createCompoundExpression第一个参数[child]就是children
                currentContainer = children[i] = createCompoundExpression(
                  [child],
                  child.loc
                )
              }
              //合并, 在 当前节点 child 和 下一个节点 next 中间，插入 "+" 号，child是一个数组，也就是说children这个属性是一个数组
              currentContainer.children.push(' + ', next)
              // 删掉下一个子节点，因为已经处理好了
              children.splice(j, 1)
              j--
            } else {
              // 如果当前节点是text，下一个节点不是text，就不需要合并，把 currentContainer 置空即可
              currentContainer = undefined
              break
            }
          }
        }
      }
    }
  }
}

export function createCompoundExpression(children, loc) {
  return {
    type: NodeTypes.COMPOUND_EXPRESSION,
    loc,
    children
  }
}

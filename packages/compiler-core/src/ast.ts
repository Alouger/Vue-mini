import { CREATE_ELEMENT_VNODE } from "./runtimeHelpers"

/**
 * 节点类型（我们这里复制了所有的节点类型，但是我们实际上只用到了极少的部分）
 */
export const enum NodeTypes {
  ROOT,
  ELEMENT,
  TEXT,
  COMMENT,
  SIMPLE_EXPRESSION,
  INTERPOLATION,
  ATTRIBUTE,
  DIRECTIVE,
  // containers
  COMPOUND_EXPRESSION,
  IF,
  IF_BRANCH,
  FOR,
  TEXT_CALL,
  // codegen
  VNODE_CALL,  // 表示需要创建一个虚拟节点
  JS_CALL_EXPRESSION, // 使用 JS_CALL_EXPRESSION 类型的节点描述函数调用语句
  JS_OBJECT_EXPRESSION, // 使用 JS_OBJECT_EXPRESSION 类型的节点描述Object类型的参数
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION, // 使用 JS_ARRAY_EXPRESSION 类型的节点描述数组类型的参数
  JS_FUNCTION_EXPRESSION, // 代表该节点是函数声明
  JS_CONDITIONAL_EXPRESSION,
  JS_CACHE_EXPRESSION,

  // ssr codegen
  JS_BLOCK_STATEMENT,
  JS_TEMPLATE_LITERAL,
  JS_IF_STATEMENT,
  JS_ASSIGNMENT_EXPRESSION,
  JS_SEQUENCE_EXPRESSION,
  JS_RETURN_STATEMENT
}

/**
 * Element 标签类型
 */
export const enum ElementTypes {
  /**
   * element，例如：<div>
   */
  ELEMENT,
  /**
   * 组件
   */
  COMPONENT,
  /**
   * 插槽
   */
  SLOT,
  /**
   * template
   */
  TEMPLATE
}

// 辅助函数，用于创建一个 vnodeCall 类型的节点
export function createVNodeCall(context, tag, props?, children?) {
  if (context) {
    // helper在transform.ts中的createTransformContext函数里往helpers里放置对应的Symbol
    // helpers的key是我们最终生成render的一个执行函数，所以我们这里helper传入的参数就是生成render函数的执行函数
    // 源码里这些执行函数特别多，我们这里只考虑CREATE_ELEMENT_VNODE，CREATE_VNODE
		context.helper(CREATE_ELEMENT_VNODE)
	}

  // return出codegenNode的属性
	return {
    // VNODE_CALL 表示需要创建一个虚拟节点
		type: NodeTypes.VNODE_CALL,
		tag,
		props,
		children
	}
}

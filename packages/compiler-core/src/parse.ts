import { ElementTypes, NodeTypes } from './ast'

/**
 * 标签类型，包含：开始和结束
 */
const enum TagType {
  Start,
  End
}

/**
 * 解析器上下文
 */
export interface ParserContext {
  source: string
}
/**
 * 创建解析器上下文
 */
function createParserContext(content: string): ParserContext {
  // 合成 context 上下文对象
  return {
    source: content
  }
}

export function createRoot(children) {
  return {
    type: NodeTypes.ROOT,
    children,
    loc: {}
  }
}

/**
 * 基础的 parse 方法，生成 AST
 * @param content tempalte 模板
 * @returns
 */
export function baseParse(content: string) {
  // 创建 parser 对象，未解析器的上下文对象
  const context = createParserContext(content)
  const children = parseChildren(context, [])
  console.log(children);
  return createRoot(children)
}

/**
 * 解析子节点
 * @param context 上下文
 * @param mode 文本模型
 * @param ancestors 祖先节点
 * @returns
 */
function parseChildren(context: ParserContext, ancestors) {
  // 存放所有 node节点数据的数组
  const nodes = []

  /**
   * parseChildren 本质上是一个状态机，因此这里开启一个 while 循环使得状态机自动运行
   * 当标签未闭合时，解析对应阶段
   * 循环解析所有 node 节点，可以理解为对 token 的处理。
   * 例如：<div>hello world</div>，此时的处理顺序为：
   * 1. <div
   * 2. >
   * 3. hello world
   * 4. </
   * 5. div>
   */
  while (!isEnd(context, ancestors)) {
    /**
     * 模板源
     */
    const s = context.source
    // 定义 node 节点
    let node
    // 如果开头是模板插值语法
    if (startsWith(s, '{{')) {
      node = parseInterpolation(context)
    }
    // < 意味着一个标签的开始
    else if (s[0] === '<') {
      // 如果第一个字符是 "<"，并且第二个字符是 小写英文字符，则认为这是一个标签节点(<x)，于是调用 parseElement 完成标签的解
      // 以 < 开始，后面跟a-z 表示，这是一个标签的开始
      if (/[a-z]/i.test(s[1])) {
        // 此时要处理 Element
        node = parseElement(context, ancestors)
      }
    }

    // node 不存在意味着上面的两个 if 都没有进入，那么我们就认为此时的 token 为文本节点
    if (!node) {
      node = parseText(context)
    }

    pushNode(nodes, node)
  }

  return nodes
}

function parseInterpolation(context: ParserContext) {
  const [open, close] = ['{{', '}}']
  advanceBy(context, open.length)


  const closeIndex = context.source.indexOf(close, open.length)
  // parseTextData从由第二个参数指定的位置（length）获取给定长度的文本数据。
  const preTrimContent = parseTextData(context, closeIndex)
  // 获取插值表达式中间的值
  const content = preTrimContent.trim()

  advanceBy(context, close.length)

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      content
    }
  }
}

/**
 * 解析 Element 元素。例如：<div>
 * ancestors 参数模拟栈结构，存储解析过程中的父级节点
 */
function parseElement(context: ParserContext, ancestors) {
  // -- 先处理开始标签 --
  const element = parseTag(context, TagType.Start)
  // 在 parseTag 解析函数执行完毕后，会消费字符串的中的内容<tag>, 比如<div>
  console.log("parseElement context", context);
  console.log("parseElement element", element);
  
  //  -- 处理子节点 --
  // 将解析处理的标签节点压入父级节点栈
  ancestors.push(element)
  // 递归触发 parseChildren 解析子节点
  const children = parseChildren(context, ancestors)
  // parseChildren 函数会消费字符串的内容：hello world。处理后的模板内容将变为：</div>
  // 解析完当前标签节点后，需要弹出父节点栈中的栈顶元素，即与当前解析的同名的标签
  ancestors.pop()
  // 为子节点赋值
  element.children = children

  //  -- 最后处理结束标签 --
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End)
  }

  // 整个标签处理完成
  return element
}

/**
 * 解析标签
 */
function parseTag(context: any, type: TagType): any {
  // -- 处理标签开始部分 --

  // 通过正则获取标签名
  console.log(context);
  const match: any = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source)
  /**
   * 对于字符串 '<div>'，会匹配出字符串 '<div'，剩余 '>'
   * 对于字符串 '<div />'，会匹配出字符串 '<div'，剩余 '/>'
   * 对于字符串 '<div---->'，其中减号(-) 代表空白符，会匹配出字符串 '<div'，剩余 '---->'
   */
  console.log(match);
  
  // 标签名字
  const tag = match[1]

  // 游标右移，消费正则表达式匹配的全部内容，例如 <div 这段内容    
  // 对模板进行解析处理
  advanceBy(context, match[0].length)
  console.log(context);

  // 属性与指令处理
	advanceSpaces(context)
	let props = parseAttributes(context, type)
  // -- 处理标签结束部分 --

  // 判断是否为自关闭标签，例如 <img />
  let isSelfClosing = startsWith(context.source, '/>')
  // 《继续》对模板进行解析处理，是自动标签则处理两个字符 /> ，不是则处理一个字符 >
  advanceBy(context, isSelfClosing ? 2 : 1)
  console.log(context);
  // 标签类型
  let tagType = ElementTypes.ELEMENT

  return {
    type: NodeTypes.ELEMENT,
    tag,
    tagType,
    // 属性，目前我们没有做任何处理。但是需要添加上，否则，生成的 ats 放到 vue 源码中会抛出错误
    props
  }
}

/**
 * 前进非固定步数
 */
function advanceSpaces(context: ParserContext): void {
  console.log("advanceSpaces - context.source1:", context.source);
  
	const match = /^[\t\r\n\f ]+/.exec(context.source)

  console.log("advanceSpaces - match:", match);
	if (match) {
		advanceBy(context, match[0].length)
    console.log("advanceSpaces - advanceBy:", context.source);
	}
}

/**
 * 解析属性与指令
 */
function parseAttributes(context, type) {
	// 解析之后的 props 数组
	const props: any = []
	// 属性名称集合，set数据结构可去重
	const attributeNames = new Set<string>()

	// 循环解析，直到解析到标签结束（'>' || '/>'）为止
	while (
		context.source.length > 0 &&
		!startsWith(context.source, '>') &&
		!startsWith(context.source, '/>')
	) {
		// 具体某一条属性的处理
		const attr = parseAttribute(context, attributeNames)
		// 添加属性
		if (type === TagType.Start) {
			props.push(attr)
		}
		advanceSpaces(context)
	}
	return props
}

/**
 * 处理指定指令，返回指令节点
 */
function parseAttribute(context: ParserContext, nameSet: Set<string>) {
	// 获取属性名称。例如：v-if
	const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
  // /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec('v-on:click="doThis"')  属性名称为 v-on:click
  // /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(':src="imageSrc"') 属性名称为 :src
  // /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec('@click="doThis"') 属性名称为 @click
  // console.log("parseAttribute - match1: ", match);
  
	// v-if="isShow"经处理得到属性名称，name = v-if
  const name = match[0]
	// 添加当前的处理属性
	nameSet.add(name)
  // 消费属性名v-if, 剩下即为="isShow"
	advanceBy(context, name.length)

	// 获取属性值。
	let value: any = undefined

	// 解析模板，并拿到对应的属性值节点
  // /^[\t\r\n\f ]*=/匹配="isShow"开头的等号=
	if (/^[\t\r\n\f ]*=/.test(context.source)) {
    // 消费属性名称与等于号之间的空白符 
		advanceSpaces(context)
    // 消费等号=，剩下即为"isShow"
		advanceBy(context, 1)
		advanceSpaces(context)
    // 解析属性值，会判断属性值是否被引号(' 或 “) 引用
		value = parseAttributeValue(context)
	}

	// 针对 v- 的指令名称处理
	if (/^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
		// 匹配指令名称(v-xxx)
		const match =
			/(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
				name
			)!
    // console.log("parseAttribute - match2: ", match);
		// 指令名。v-if 则获取 if
		let dirName = match[1]
		// TODO：指令参数  v-bind:arg
		// let arg: any

		// TODO：指令修饰符  v-on:click.modifiers
		// const modifiers = match[3] ? match[3].slice(1).split('.') : []

		return {
			type: NodeTypes.DIRECTIVE,
			name: dirName,
			exp: value && {
				type: NodeTypes.SIMPLE_EXPRESSION,
				content: value.content,
				isStatic: false,
				loc: value.loc
			},
			arg: undefined,
			modifiers: undefined,
			loc: {}
		}
	}

  // 当前解析的不是指令的话，就进行这个return
	return {
		type: NodeTypes.ATTRIBUTE,
		name,
		value: value && {
			type: NodeTypes.TEXT,
			content: value.content,
			loc: value.loc
		},
		loc: {}
	}
}

/**
 * 获取属性（attr）的 value
 */
function parseAttributeValue(context: ParserContext) {
  // content就是我们得到的属性值
	let content = ''

	// 判断是单引号还是双引号
	const quote = context.source[0]
	const isQuoted = quote === `"` || quote === `'`
	// 引号处理
	if (isQuoted) {
    // 消费引号"，剩下即为isShow"
		advanceBy(context, 1)
		// 获取结束的 index
		const endIndex = context.source.indexOf(quote)
		// 获取指令的值。例如：v-if="isShow"，则值为 isShow
		if (endIndex === -1) {
			content = parseTextData(context, context.source.length)
		} else {
      // parseTextData函数里会消费等号isShow，剩下即为一个结尾引号"
			content = parseTextData(context, endIndex)
      // 消费结尾引号"，无剩下
			advanceBy(context, 1)
		}
	}

	return { content, isQuoted, loc: {} }
}


/**
 * 解析文本。
 */
function parseText(context: ParserContext) {
  /**
   * 定义普通文本结束的标记
   * 例如：hello world </div>，那么文本结束的标记就为 <
   * PS：这也意味着如果你渲染了一个 <div> hell<o </div> 的标签，那么你将得到一个错误
   */
  const endTokens = ['<', '{{']
  // 计算普通文本结束的位置, 默认将整个模板剩余内容都作为文本内容
  let endIndex = context.source.length

  // 计算精准的 endIndex，计算的逻辑为：从 context.source 中分别获取 '<', '{{' 的下标，取最小值为 endIndex
  for (let i = 0; i < endTokens.length; i++) {
    // 寻找字符 < 与定界符{{ 的索引位置
    const index = context.source.indexOf(endTokens[i], 1)
    // 取 index 和当前 endIndex 中较小的一个作为新的结尾索引
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }

  // 获取处理的文本内容
  const content = parseTextData(context, endIndex)

  return {
    type: NodeTypes.TEXT,
    content
  }
}

/**
 * 从指定位置（length）获取给定长度的文本数据。
 */
function parseTextData(context: ParserContext, length: number): string {
  console.log("parseTextData context", context);
  
  // 获取指定的文本数据
  const rawText = context.source.slice(0, length)
  // 《继续》对模板进行解析处理
  advanceBy(context, length)
  // 返回获取到的文本
  return rawText
}

/**
 * nodes.push(node)
 */
function pushNode(nodes, node): void {
  nodes.push(node)
}

/**
 * 判断是否为结束节点
 *  ancestors 参数模拟栈结构，存储解析过程中的父级节点
 */
/**
 * 当父级节点栈中存在与当前解析到的结束标签同名的节点时，isEnd 函会返回true。即意味着此时停止状态机，也就是退出while循环，结束对节点的解析。
 * 为什么？因为前面提过，编译器在解析 HTML 文档时，使用状态机的方式进行解析。
 * 状态机会根据当前的状态和输入的字符，决定下一步要执行的操作。
 * 在解析结束标签时，状态机需要判断当前结束标签的名称是否与父级节点栈中存在的节点名称相同。
 * 如果相同，则说明当前结束标签与某个父级节点对应，需要结束对该节点的解析。
 * @param context 
 * @param ancestors 
 * @returns 
 */
function isEnd(context: ParserContext, ancestors): boolean {
  const s = context.source

  // 解析是否为结束标签
  // 父级节点栈中存在与当前解析到的结束标签同名的节点，就停止状态机，即返回true，退出 while 循环
  if (startsWith(s, '</')) {
    // 从后向前循环
    for (let i = ancestors.length - 1; i >= 0; --i) {
      // 判断当前内容是否为结束标签的开始
      if (startsWithEndTagOpen(s, ancestors[i].tag)) {
        return true
      }
    }
  }
  return !s
}

/**
 * 是否以指定文本开头
 */
function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString)
}

/**
 * 判断当前是否为《标签结束的开始》。比如 </div> 就是 div 标签结束的开始
 * @param source 模板。例如：</div>
 * @param tag 标签。例如：div
 * @returns
 */
function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}

/**
 * 解析标签的过程，其实就是一个自动状态机不断读取的过程，我们需要构建 advanceBy 方法，来标记进入下一步
 * 前进一步。多次调用，每次调用都会处理一部分的模板内容
 * 以 <div>hello world</div> 为例
 * 1. <div
 * 2. >
 * 3. hello world
 * 4. </div
 * 5. >
 *
 * 第二个参数表示右移几个字符
 */
function advanceBy(context: ParserContext, numberOfCharacters: number): void {
  // template 模板源
  const { source } = context
  // 去除开始部分的无效数据
  context.source = source.slice(numberOfCharacters)
}

/**
 * 为 event 事件进行打补丁
 */
export function patchEvent(el: Element & {_vei?: Object}, rawName: string, prevValue, nextValue) {
  // vei = vue event invokers
  const invokers = el._vei || (el._vei = {})
  // 检测是否有缓存行为
  const existingInvoker = invokers[rawName]
  // 如果有新值并且有缓存存在，说明要有更新行为。直接更新 invoker 的 value 即可
  if (nextValue && existingInvoker) {
    // 通过这种方式更替invoker.value()的回调函数内容，而不是调用 addEventListener 和 removeEventListener 解决了频繁的删除、新增事件时非常消耗性能的问题
    existingInvoker.value = nextValue
  } else {
    // 转换成addEventListener和removeEventListener能接受的事件名
    const name = parseName(rawName)
    // 判断此时是新增行为还是删除行为
    if (nextValue) {
      // 新增行为, nextValue一定是存在的
      const invoker = (invokers[rawName] = createInvoker(nextValue))
      el.addEventListener(name, invoker, )
    } else if (existingInvoker) {
      // 删除行为
      el.removeEventListener(name, existingInvoker)
      // 删除缓存
      invokers[rawName] = undefined
    }
  }
}

/**
 * 直接返回剔除 on，其余转化为小写的事件名即可
 */
function parseName(name: string) {
  // 去掉开头的'on'两个字符，并且转为小写
  return name.slice(2).toLowerCase()
}

/**
 * 生成 invoker 函数
 */
function createInvoker(initialValue) {
  const invoker = (e: Event) => {
    invoker.value && invoker.value()
  }
  // value 为真实的事件行为
  invoker.value = initialValue
  return invoker
}
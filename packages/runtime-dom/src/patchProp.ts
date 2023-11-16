import { isOn } from "@vue/shared";
import { patchClass } from "./modules/class";
import { patchDOMProp } from "./modules/props";
import { patchAttr } from "./modules/attr";

export const patchProp = (el: Element, key, prevValue, nextValue) => {
  // 根据不同的prop做不同的处理
  if (key === 'class') {
    patchClass(el, nextValue)
  } else if (key === 'style') {

  } else if (isOn(key)) { // 事件是以on开头的

  } else if (shouldSetAsProp(el, key)) { // shouldSetAsProp 用来匹配DOM Properties
    // 通过 DOM Properties 指定
    patchDOMProp(el, key, nextValue)
  } else {
    // 其他属性
    patchAttr(el, key, nextValue)
  }
}

function shouldSetAsProp(el: Element, key: string) {
  // 源码中这里写了一大堆边缘情况，我们这里进行简化
  if (key === 'form') {
    // 为什么返回false? 因为对于form表单元素，它是只读的
    return false
  }

  if (key === 'list' && el.tagName === 'INPUT') {
    // 返回false是因为对于input和list，他们必须通过HTML Attribute的方式进行设定
    return false
  }

  if (key === 'type' && el.tagName === 'TEXTAREA') {
    // 返回false是因为对于type和TEXTAREA，他们必须通过HTML Attribute的方式进行设定
    return false
  }

  // 只要key是props的就返回true
  return key in el
}
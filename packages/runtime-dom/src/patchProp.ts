import { isOn } from "@vue/shared";
import { patchClass } from "./modules/class";

export const patchProp = (el: Element, key, prevValue, nextValue) => {
  // 根据不同的prop做不同的处理
  if (key === 'class') {
    patchClass(el, nextValue)
  } else if (key === 'style') {

  } else if (isOn(key)) { // 事件是以on开头的

  } else {

  }
}
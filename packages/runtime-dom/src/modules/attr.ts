export function patchAttr(el: Element, key, value) {
  // value有时存在有时不存在，所以要判断下
  if (value === null) {
    el.removeAttribute(key)
  } else {
    el.setAttribute(key, value)
  }
  
}
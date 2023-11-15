import { isArray, isObject, isString } from "."

export function normalizeClass(value: unknown): string {
  let res = ''

  if (isString(value)) {
    res = value
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const normalized = normalizeClass(value[i])
      if (normalized) {
        // class之间用空格间隔
        res += normalized + ' '
      }
    }
  } else if (isObject(value)) {
    for (const name in value as object) {
      // 对value进行类型强转，否则报错
      if ((value as object)[name]) {
        res += name + ' '
      }
    }
  }

  return res.trim()
}
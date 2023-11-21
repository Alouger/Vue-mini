export { toDisplayString } from './toDisplayString'

export const isArray = Array.isArray

export const isObject = (val: unknown) => {
  return val !== null && typeof val === 'object'
}

/**
 * 对比两个数据是否发生改变
 * @param value 
 * @param oldValue 
 */
export const hasChanged = (value: any, oldValue: any): boolean => {
  // Object.is()如果值相同，则返回TRUE，否则返回FALSE
  return !Object.is(value, oldValue)
}

export const isFunction = (val: unknown): val is Function => {
  return typeof val === 'function'
}

export const isString = (val: unknown): val is string => {
  return typeof val === 'string'
}

export const extend = Object.assign

export const EMPTY_OBJ: { readonly [key: string]: any} = {}

// 以on开头的
const onRE = /^on[^a-z]/
export const isOn = (key: string) => onRE.test(key)
import { track, trigger } from "./effect"

const get = createGetter()

function createGetter() {
  return function get(target: object, key: string | symbol, receiver: object) {
    const res = Reflect.get(target, key, receiver)
    // 进行依赖收集
    track(target, key)
    return res
  }
}

const set = createSetter()

function createSetter() {
  return function set(target: object, key: string | symbol, value: unknown, receiver: object) {
    const result = Reflect.set(target, key, value, receiver)

    // 依赖触发
    trigger(target, key, value)

    return result
  }
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set
}

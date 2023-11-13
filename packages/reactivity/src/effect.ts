type KeyToDepMap = Map<any, ReactiveEffect>
/**
 * 收集所有依赖的 WeakMap 实例：
 * 1. `key`：响应性对象
 * 2. `value`：`Map` 对象
 * 		1. `key`：响应性对象的指定属性
 * 		2. `value`：指定对象的指定属性的 执行函数
 */
const targetMap = new WeakMap<any, KeyToDepMap>()

export function effect<T = any>(fn: () => T) {
  const _effect = new ReactiveEffect(fn)
  // 拿到effect实例后执行run函数
  // 之所以在这里直接执行run函数，是为了完成第一次fn函数的执行
  // 当一个普通的函数 fn() 被 effect() 包裹之后，就会变成一个响应式的 effect 函数，而 fn() 也会被立即执行一次。
  // 由于在 fn() 里面有引用到 Proxy 对象的属性，所以这一步会触发对象的 getter，从而启动依赖收集。
  _effect.run()
}

export let activeEffect: ReactiveEffect | undefined

export class ReactiveEffect<T = any> {
  constructor (public fn: () => T) {

  }

  // 本质上是执行我们想要的回调函数fn
  run() {
    // 在执行回调函数之前，要先让activeEffect完成赋值
    // activeEffect表示当前被激活的effect
    activeEffect = this
    return this.fn()
  }
}

/**
 * 用于收集依赖的方法
 * @param target WeakMap 的 key
 * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
 */
export function track(target: object, key: unknown) {
  console.log('track: 收集依赖');
  // 如果activeEffect不存在，直接返回
  if (!activeEffect) return
  // 尝试从 targetMap 中，根据 target 获取 map
  let depsMap = targetMap.get(target)
  // 如果没有找到depMap，就新建一个
  if (!depsMap) {
    depsMap = new Map()
    targetMap.set(target, depsMap)
  }

  // 这里的key一般是object里的属性
  // 为指定map，指定key，设置回调函数
  depsMap.set(key, activeEffect)
  // 临时打印
  console.log(targetMap)
}

/**
 * 触发依赖
 * @param target WeakMap 的 key
 * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
 * @param newValue 
 */
export function trigger(target: object, key: unknown, newValue: unknown) {
  // 依据 target 获取存储的 map 实例
  const depsMap = targetMap.get(target)
  // 如果 map 不存在，则直接 return
  if (!depsMap) {
    return
  }
  // 根据key，从depsMap中取出value，该value是一个ReactiveEffect类型的数据
  const effect = depsMap.get(key) as ReactiveEffect
  // 如果effect不存在，则直接return
  if (!effect) {
    return
  }
  // 执行effect中保存的fn函数
  effect.fn()
}
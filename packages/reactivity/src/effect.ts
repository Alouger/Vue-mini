import { isArray } from "@vue/shared"
import { Dep, createDep } from "./dep"
import { ComputedRefImpl } from "./computed"

export type EffectScheduler = (...args: any[]) => any

type KeyToDepMap = Map<any, Dep>
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
  computed?: ComputedRefImpl<T>
  constructor (public fn: () => T, public scheduler: EffectScheduler | null = null) {

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

  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = createDep()))
  }

  trackEffects(dep)
  // 这里的key一般是object里的属性
  // 为指定map，指定key，设置回调函数
  // depsMap.set(key, activeEffect)
}

/**
 * 利用dep依次跟踪指定key的所有effect
 * @param dep 
 */
export function trackEffects(dep: Dep) {
  dep.add(activeEffect!)
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
  // 根据key，从depsMap中取出value，该value是一个Dep或undefined类型的数据
  const dep: Dep | undefined = depsMap.get(key)
  // 如果dep不存在，则直接return
  if (!dep) {
    return
  }

  // 触发 dep
  triggerEffects(dep)
  // 执行effect中保存的fn函数
//   effect.fn()
}

/**
 * 依次触发dep中保存的依赖
 * @param dep 
 */
export function triggerEffects(dep: Dep) {
  // 把 dep 构建为一个数组
  const effects = isArray(dep) ? dep : [...dep]  
  // 依次触发依赖
  for (const effect of effects) {
    if (effect.computed) {
      triggerEffect(effect)
    }
  }

  for (const effect of effects) {
    if (!effect.computed) {
      triggerEffect(effect)
    }
  }
}

/**
 * 触发指定依赖
 * @param effect 
 */
export function triggerEffect(effect: ReactiveEffect) {
  console.log("effect", effect);
  console.log("effect.scheduler", effect.scheduler);
  
  if (effect.scheduler) {
    effect.scheduler()
  } else {
    effect.run()
  }
}
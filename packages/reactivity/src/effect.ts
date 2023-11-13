export function effect<T = any>(fn: () => T) {
  const _effect = new ReactiveEffect(fn)
  // 拿到effect实例后执行run函数
  // 之所以在这里直接执行run函数，是为了完成第一次fn函数的执行
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
 * 收集依赖
 * @param target 
 * @param key 
 */
export function track(target: object, key: unknown) {
  console.log('track: 收集依赖');
  
}

/**
 * 触发依赖
 * @param target 
 * @param key 
 * @param newValue 
 */
export function trigger(target: object, key: unknown, newValue: unknown) {
  console.log('trigger: 触发依赖');
}
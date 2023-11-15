import { queuePreFlushCb } from "@vue/runtime-core"
import { EMPTY_OBJ, hasChanged, isObject } from "@vue/shared"
import { ReactiveEffect } from "packages/reactivity/src/effect"
import { isReactive } from "packages/reactivity/src/reactive"

/**
 * watch 配置项属性
 */
export interface WatchOptions<Immediate = boolean> {
    immediate?: Immediate
    deep?: boolean
  }
  
  /**
   * 指定的 watch 函数
   * @param source 监听的响应性数据
   * @param cb 回调函数
   * @param options 配置对象
   * @returns
   */
  export function watch(source, cb: Function, options?: WatchOptions) {
    return doWatch(source as any, cb, options)
  }
  
  // 大致原理:收集source中响应式元素包装成getter,在new ReactiveEffect中传递调用run方法执行getter就会收集到依赖,然后当触发依赖更新的时候就会调用scheduler,在根据flush参数,选择同步执行scheduler还是加入调度器
  function doWatch(
    source,
    cb: Function,
    { immediate, deep }: WatchOptions = EMPTY_OBJ
  ) {
    // 所有的监听数据源都会被包装成getter,这是因为底层都是调用reactivity库的watchEffect,而第一个参数必须是函数,当调用这个函数访问到的变量都会收集依赖。所以如果当前元素为reactive元素的时候需要遍历这个元素的所有值以便所有的变量都能收集到对应的依赖。
    // 触发 getter 的指定函数
    let getter: () => any
  
    // 判断 source 的数据类型
    if (isReactive(source)) {
      // 指定 getter
      getter = () => source
      // 深度
      deep = true
    } else { 
      getter = () => {}
    }
  
    // 存在回调函数和deep
    if (cb && deep) {
      // TODO
      const baseGetter = getter // 浅拷贝，baseGetter和getter都指向相同的内存空间
      // getter = () => baseGetter()
      // traverse就是在循环source里面所有的getter行为，完成对应的依赖收集
      getter = () => traverse(baseGetter())
    }
  
    // 旧值
    let oldValue = {}
    // job 执行方法，job执行一次，说明watch触发一次
    // 这个job代表的是要传递给Vue调度器的任务,所以这是在创建一个调度器任务。
    // 同时还需要注意这个job是监听的变量发生了改变后才会调用
    const job = () => {
      // 如果存在cb,那么会先调用getter函数获取最新的value,然后再调用cb
      if (cb) {
        // watch(source, cb)
        // effect.run(), 本质上是fn函数的执行，具体而言就是() => traverse(baseGetter())的执行，注意此时activeEffect会被改成这个ReactiveEffect对象
        const newValue = effect.run()
        if (deep || hasChanged(newValue, oldValue)) {
          cb(newValue, oldValue)
          oldValue = newValue
        }
      }
    }
  
    // 调度器
    let scheduler = () => queuePreFlushCb(job)
  
    // 最终getter和scheduler都得到了。他们会作为reactiveEffect类的两个参数。第一个为监听的getter函数,在这里面访问的值都会收集到依赖,当这些监听的值发生改变的时候就会调用schgeduler。
    const effect = new ReactiveEffect(getter, scheduler)
  
    if (cb) {
      if (immediate) {
        job()
      } else {
        oldValue = effect.run()
      }
    } else {
      effect.run()
    }
  
    return () => {
      effect.stop()
    }
  }

  export function traverse(value: unknown) {
    // 对于当前value的类型只可能是两种类型：对象或非对象
    if (!isObject(value)) {
      return value
    }

    // 通过上面的if判断，这里value说明已经是object类型了，我们再用as进行类型强转一下
    for (const key in value as object) {
      traverse((value as object)[key])
    }

    return value
  }
  
  
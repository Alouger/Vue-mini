import { isFunction } from "@vue/shared"
import { ReactiveEffect } from "./effect"
import { Dep } from "./dep"
import { trackRefValue, triggerRefValue } from "./ref"

export class ComputedRefImpl<T> {
  public dep?: Dep = undefined
  private _value!: T
  public readonly effect: ReactiveEffect<T>
  public readonly __v_isRef = true
  public _dirty = true
  constructor(getter) {
    // this.effect.run()中run()执行的就是这里的getter，就是computed函数包裹的回调函数
    this.effect = new ReactiveEffect(getter, () => {
      // 脏变量_dirty用来控制什么时候执行触发依赖，只有_dirty为false的时候才会触发依赖
      if (!this._dirty) {
        this._dirty = true
        console.log(this);
        
        triggerRefValue(this)
      }
    })
    this.effect.computed = this
  }

  get value() {
    trackRefValue(this)
    if (this._dirty) {
      this._dirty = false
      // run()执行的就是这里的getter，就是computed函数包裹的回调函数
      this._value = this.effect.run()
    }
    return this._value
  }
}

// getterOrOptions表示可以是一个函数也可以是一个选项
export function computed(getterOrOptions) {
  let getter

  // 判断是否是一个函数
  const onlyGetter = isFunction(getterOrOptions)

  if (onlyGetter) {
    getter = getterOrOptions
  }

  const cRef = new ComputedRefImpl(getter)

  return cRef
}


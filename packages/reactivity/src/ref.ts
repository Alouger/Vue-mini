import { hasChanged } from "@vue/shared"
import { Dep, createDep } from "./dep"
import { activeEffect, trackEffects, triggerEffect, triggerEffects } from "./effect"
import { toReactive } from "./reactive"

export interface Ref<T = any> {
  value: T
}

export function ref(value?: unknown) {
  return createRef(value, false)
}

/**
 * 创建 RefImpl 实例
 * @param rawValue 原始数据
 * @param shallow boolean 形数据，表示《浅层的响应性（即：只有 .value 是响应性的）》
 * @returns
 */
function createRef(rawValue: unknown, shallow: boolean) {
  if (isRef(rawValue)) {
    return rawValue
  }
  return new RefImpl(rawValue, shallow)
}

class RefImpl<T> {
  // 存value，这个value就是.后面的value，比如person.value
  private _value: T
  // 存初始值
  private _rawValue: T
  // 存依赖
  public dep?: Dep = undefined
  // 是否为 ref 类型数据的标记
  public readonly __v_isRef = true
  constructor(value: T, public readonly __v_isShallow: boolean) {
    this._rawValue = value
    this._value = __v_isShallow ? value : toReactive(value)
  }

  /**
	 * get 语法将对象属性绑定到查询该属性时将被调用的函数。
	 * 即：xxx.value 时触发该函数
	 */
  get value() {
    trackRefValue(this)
    return this._value
  }

  set value(newVal) {
    /**
		 * newVal 为新数据
		 * this._rawValue 为旧数据（原始数据）
		 * 对比两个数据是否发生了变化
		 */
    if (hasChanged(newVal, this._rawValue)) {
      // 改变原始值
      this._rawValue = newVal
      // 更新 .value 的值
      this._value = toReactive(newVal)
      triggerRefValue(this)
    }
  }
}

/**
 * 收集依赖
 * @param ref 
 */
export function trackRefValue(ref) {
  console.log("activeEffect", activeEffect);
  
  if (activeEffect) {
    trackEffects(ref.dep || (ref.dep = createDep()))
  }
}

/**
 * 为 ref 的 value 进行触发依赖工作
 */
export function triggerRefValue(ref) {
  console.log("ref", ref);
  
  if (ref.dep) {
    triggerEffects(ref.dep)
  }
}

/**
 * 是否为ref
 * @param r 
 * @returns 
 */
export function isRef(r: any): r is Ref {
  // !!双感叹号的作用是转为布尔值
  return !!(r && r.__v_isRef === true)
}
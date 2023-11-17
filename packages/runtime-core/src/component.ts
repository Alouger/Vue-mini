import { reactive } from "@vue/reactivity"
import { isObject } from "@vue/shared"
import { onBeforeMount, onMounted } from "./apiLifecycle"

let uid = 0

/**
 * 生命周期钩子
 */
export const enum LifecycleHooks {
  BEFORE_CREATE = 'bc',
  CREATED = 'c',
  BEFORE_MOUNT = 'bm',
  MOUNTED = 'm'
}

/**
 * 创建组件实例
 */
export function createComponentInstance(vnode) {
  const type = vnode.type
  // 生成组件实例实际上就是个对象
  const instance = {
    uid: uid++, // 唯一标记
    // instance的vnode指向这个传进函数的vnode，vnode的component指向instance
    vnode, // 虚拟节点
    type, // 组件类型
    // subTree实际上就是组件里面真实要渲染的渲染数
    subTree: null, // render 函数的返回值
    effect: null, // ReactiveEffect 实例
    update: null, // update 函数，触发 effect.run
    render: null, // 组件内的 render 函数
    isMounted: false, // 是否挂载
    bc: null, // beforeCreate
    c: null, // created
    bm: null, // beforeMount
    m: null // mounted
  }

  return instance
}
/**
 * 规范化组件实例数据
 */
export function setupComponent(instance) {
  // 为 render 赋值
  const setupResult = setupStatefulComponent(instance)
  return setupResult
}

function setupStatefulComponent(instance) {
  finishComponentSetup(instance)
}

export function finishComponentSetup(instance) { 
  // instance.type实际上就是component里面的render函数内容
  const Component = instance.type
  instance.render = Component.render

  applyOptions(instance)
}

function applyOptions(instance: any) {
  const { 
    data: dataOptions,
    beforeCreate,
    created,
    beforeMount,
    mounted 
  } = instance.type

  // hooks
  if (beforeCreate) {
    callHook(beforeCreate)
  }

  // 存在 data 选项时
  if (dataOptions) {
    // 触发 dataOptions 函数，拿到 data 对象
    const data = dataOptions()
    // 如果拿到的 data 是一个对象
    if (isObject(data)) {
      // 则把 data 包装成 reactiv 的响应性数据，赋值给 instance
      instance.data = reactive(data)
    }
  }

  // hooks
  if (created) {
    callHook(created)
  }

  function registerLifecycleHook(register: Function, hook?: Function) {
    register(hook, instance)
  }
  // 注册 hooks
  registerLifecycleHook(onBeforeMount, beforeMount)
  registerLifecycleHook(onMounted, mounted)
}

function callHook(hook: Function) {
  hook()
}
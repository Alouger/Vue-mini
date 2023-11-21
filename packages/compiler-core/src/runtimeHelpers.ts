export const CREATE_ELEMENT_VNODE = Symbol('createElementVNode')
// createVNode在vnode.ts中，用于生成一个 VNode 对象，并返回
export const CREATE_VNODE = Symbol('createVNode')
export const TO_DISPLAY_STRING = Symbol('toDisplayString')

/**
 * const {xxx} = Vue
 * 即：从 Vue 中可以被导出的方法，我们这里统一使用  createVNode
 */
export const helperNameMap = {
    // 让每一个Symbol对应一个函数
   [CREATE_ELEMENT_VNODE]: 'createElementVNode',
   [CREATE_VNODE]: 'createVNode',
   [TO_DISPLAY_STRING]: 'toDisplayString'
}
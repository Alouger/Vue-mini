// 对应promise的pending状态，是一个 标记，表示 promise 进入 pending 状态
let isFlushPending = false

const resolvedPromise = Promise.resolve() as Promise<any>

// 当前的执行任务
let currentFlushPromise: Promise<void> | null = null

// 待执行的任务队列
const pendingPreFlushCbs: Function[] = []

// 队列预处理函数
export function queuePreFlushCb(cb: Function) {
  queueCb(cb, pendingPreFlushCbs)
}

// 队列处理函数
function queueCb(cb: Function, pendingQueue: Function[]) {
  // 将所有的回调函数，放入队列中
  pendingQueue.push(cb)
  // 负责依次执行队列中的函数
  queueFlush()
}

// 依次处理队列中执行函数
function queueFlush() {
  // 只有pending为false才执行, 这个执行是一个异步任务
  if (!isFlushPending) {
    isFlushPending = true
    // 把当前的整个任务队列的执行扔到微任务里面，避免通过主线任务执行，扔到微任务中的目的就是为了控制执行规则
    // 通过 Promise.resolve().then() 这样一种 异步微任务的方式 执行了 flushJobs 函数， flushJobs 是一个 异步函数，它会等到 同步任务执行完成之后 被触发
    currentFlushPromise = resolvedPromise.then(flushJobs)
  }
}

// 扔进then方法的回调函数，这个是真正去处理队列的函数
function flushJobs() {
  // 开始处理队列了，就要把pending变成false
  isFlushPending = false
  flushPreFlushCbs()
}

// 循环去进行队列的处理，依次处理队列中的任务
export function flushPreFlushCbs() {
  if (pendingPreFlushCbs.length) {
    // 用Set去重，这里类似于一个深拷贝
    let activePreFlushCbs = [...new Set(pendingPreFlushCbs)]
    // 清空旧数据, 把pendingPreFlushCbs置空，则下一次就不会进入这个if语句框里了
    pendingPreFlushCbs.length = 0
    // 循环处理
    for (let i = 0; i< activePreFlushCbs.length; i++) {
      activePreFlushCbs[i]()
    }
  }
}
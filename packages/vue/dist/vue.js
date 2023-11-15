var Vue = (function (exports) {
    'use strict';

    var isArray = Array.isArray;
    var isObject = function (val) {
        return val !== null && typeof val === 'object';
    };
    /**
     * 对比两个数据是否发生改变
     * @param value
     * @param oldValue
     */
    var hasChanged = function (value, oldValue) {
        // Object.is()如果值相同，则返回TRUE，否则返回FALSE
        return !Object.is(value, oldValue);
    };
    var isFunction = function (val) {
        return typeof val === 'function';
    };
    var extend = Object.assign;
    var EMPTY_OBJ = {};

    /******************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */

    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __read(o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    }

    function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    }

    /**
     * 依据 effects 生成 dep 实例
     */
    var createDep = function (effects) {
        var dep = new Set(effects);
        return dep;
    };

    /**
     * 收集所有依赖的 WeakMap 实例：
     * 1. `key`：响应性对象
     * 2. `value`：`Map` 对象
     * 		1. `key`：响应性对象的指定属性
     * 		2. `value`：指定对象的指定属性的 执行函数
     */
    var targetMap = new WeakMap();
    function effect(fn, options) {
        var _effect = new ReactiveEffect(fn);
        if (options) {
            // 合并_effect和options，当options中包含调度器的话，通过extend函数，_effect也会包含调度器
            extend(_effect, options);
        }
        if (!options || !options.lazy) {
            // 拿到effect实例后执行run函数
            // 之所以在这里直接执行run函数，是为了完成第一次fn函数的执行
            // 当一个普通的函数 fn() 被 effect() 包裹之后，就会变成一个响应式的 effect 函数，而 fn() 也会被立即执行一次。
            // 由于在 fn() 里面有引用到 Proxy 对象的属性，所以这一步会触发对象的 getter，从而启动依赖收集。
            _effect.run();
        }
    }
    var activeEffect;
    var ReactiveEffect = /** @class */ (function () {
        function ReactiveEffect(fn, scheduler) {
            if (scheduler === void 0) { scheduler = null; }
            this.fn = fn;
            this.scheduler = scheduler;
        }
        // 本质上是执行我们想要的回调函数fn
        ReactiveEffect.prototype.run = function () {
            // 在执行回调函数之前，要先让activeEffect完成赋值
            // activeEffect表示当前被激活的effect
            activeEffect = this;
            return this.fn();
        };
        ReactiveEffect.prototype.stop = function () { };
        return ReactiveEffect;
    }());
    /**
     * 用于收集依赖的方法
     * @param target WeakMap 的 key
     * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
     */
    function track(target, key) {
        console.log('track: 收集依赖');
        // 如果activeEffect不存在，直接返回
        if (!activeEffect)
            return;
        // 尝试从 targetMap 中，根据 target 获取 map
        var depsMap = targetMap.get(target);
        // 如果没有找到depMap，就新建一个
        if (!depsMap) {
            depsMap = new Map();
            targetMap.set(target, depsMap);
        }
        var dep = depsMap.get(key);
        if (!dep) {
            depsMap.set(key, (dep = createDep()));
        }
        trackEffects(dep);
        // 这里的key一般是object里的属性
        // 为指定map，指定key，设置回调函数
        // depsMap.set(key, activeEffect)
    }
    /**
     * 利用dep依次跟踪指定key的所有effect
     * @param dep
     */
    function trackEffects(dep) {
        dep.add(activeEffect);
    }
    /**
     * 触发依赖
     * @param target WeakMap 的 key
     * @param key 代理对象的 key，当依赖被触发时，需要根据该 key 获取
     * @param newValue
     */
    function trigger(target, key, newValue) {
        // 依据 target 获取存储的 map 实例
        var depsMap = targetMap.get(target);
        // 如果 map 不存在，则直接 return
        if (!depsMap) {
            return;
        }
        // 根据key，从depsMap中取出value，该value是一个Dep或undefined类型的数据
        var dep = depsMap.get(key);
        // 如果dep不存在，则直接return
        if (!dep) {
            return;
        }
        // 触发 dep
        triggerEffects(dep);
        // 执行effect中保存的fn函数
        //   effect.fn()
    }
    /**
     * 依次触发dep中保存的依赖
     * @param dep
     */
    function triggerEffects(dep) {
        var e_1, _a, e_2, _b;
        // 把 dep 构建为一个数组
        var effects = isArray(dep) ? dep : __spreadArray([], __read(dep), false);
        try {
            // 依次触发依赖
            for (var effects_1 = __values(effects), effects_1_1 = effects_1.next(); !effects_1_1.done; effects_1_1 = effects_1.next()) {
                var effect_1 = effects_1_1.value;
                if (effect_1.computed) {
                    triggerEffect(effect_1);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (effects_1_1 && !effects_1_1.done && (_a = effects_1.return)) _a.call(effects_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        try {
            for (var effects_2 = __values(effects), effects_2_1 = effects_2.next(); !effects_2_1.done; effects_2_1 = effects_2.next()) {
                var effect_2 = effects_2_1.value;
                if (!effect_2.computed) {
                    triggerEffect(effect_2);
                }
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (effects_2_1 && !effects_2_1.done && (_b = effects_2.return)) _b.call(effects_2);
            }
            finally { if (e_2) throw e_2.error; }
        }
    }
    /**
     * 触发指定依赖
     * @param effect
     */
    function triggerEffect(effect) {
        console.log("effect", effect);
        console.log("effect.scheduler", effect.scheduler);
        if (effect.scheduler) {
            effect.scheduler();
        }
        else {
            effect.run();
        }
    }

    var get = createGetter();
    function createGetter() {
        return function get(target, key, receiver) {
            var res = Reflect.get(target, key, receiver);
            // 进行依赖收集
            track(target, key);
            return res;
        };
    }
    var set = createSetter();
    function createSetter() {
        return function set(target, key, value, receiver) {
            var result = Reflect.set(target, key, value, receiver);
            // 依赖触发
            trigger(target, key);
            return result;
        };
    }
    var mutableHandlers = {
        get: get,
        set: set
    };

    /**
     * 响应性 Map 缓存对象
     * key：target
     * val：proxy
     */
    var reactiveMap = new WeakMap();
    /**
     * 为复杂数据类型，创建响应性对象
     * @param target 被代理对象
     * @returns 代理对象
     */
    function reactive(target) {
        return createReactiveObject(target, mutableHandlers, reactiveMap);
    }
    // 在createReactiveObject中，做的事情就是为target添加一个proxy代理
    /**
     * 创建响应性对象
     * @param target 被代理对象
     * @param baseHandlers handler
     */
    function createReactiveObject(target, baseHandlers, proxyMap) {
        // 先看以前有没有生成过这个target的proxy，有的话直接读取即可（直接返回已有的），没有的话再来创建proxy
        var existingProxy = proxyMap.get(target);
        if (existingProxy) {
            return existingProxy;
        }
        // 未被代理则生成 proxy 实例
        var proxy = new Proxy(target, baseHandlers);
        // 新增Reactive标识
        proxy["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */] = true;
        // 缓存代理对象
        proxyMap.set(target, proxy);
        return proxy;
    }
    var toReactive = function (value) {
        return isObject(value) ? reactive(value) : value;
    };
    function isReactive(value) {
        return !!(value && value["__v_isReactive" /* ReactiveFlags.IS_REACTIVE */]);
    }

    function ref(value) {
        return createRef(value, false);
    }
    /**
     * 创建 RefImpl 实例
     * @param rawValue 原始数据
     * @param shallow boolean 形数据，表示《浅层的响应性（即：只有 .value 是响应性的）》
     * @returns
     */
    function createRef(rawValue, shallow) {
        if (isRef(rawValue)) {
            return rawValue;
        }
        return new RefImpl(rawValue, shallow);
    }
    var RefImpl = /** @class */ (function () {
        function RefImpl(value, __v_isShallow) {
            this.__v_isShallow = __v_isShallow;
            // 存依赖
            this.dep = undefined;
            // 是否为 ref 类型数据的标记
            this.__v_isRef = true;
            this._rawValue = value;
            this._value = __v_isShallow ? value : toReactive(value);
        }
        Object.defineProperty(RefImpl.prototype, "value", {
            /**
               * get 语法将对象属性绑定到查询该属性时将被调用的函数。
               * 即：xxx.value 时触发该函数
               */
            get: function () {
                trackRefValue(this);
                return this._value;
            },
            set: function (newVal) {
                /**
                     * newVal 为新数据
                     * this._rawValue 为旧数据（原始数据）
                     * 对比两个数据是否发生了变化
                     */
                if (hasChanged(newVal, this._rawValue)) {
                    // 改变原始值
                    this._rawValue = newVal;
                    // 更新 .value 的值
                    this._value = toReactive(newVal);
                    triggerRefValue(this);
                }
            },
            enumerable: false,
            configurable: true
        });
        return RefImpl;
    }());
    /**
     * 收集依赖
     * @param ref
     */
    function trackRefValue(ref) {
        console.log("activeEffect", activeEffect);
        if (activeEffect) {
            trackEffects(ref.dep || (ref.dep = createDep()));
        }
    }
    /**
     * 为 ref 的 value 进行触发依赖工作
     */
    function triggerRefValue(ref) {
        console.log("ref", ref);
        if (ref.dep) {
            triggerEffects(ref.dep);
        }
    }
    /**
     * 是否为ref
     * @param r
     * @returns
     */
    function isRef(r) {
        // !!双感叹号的作用是转为布尔值
        return !!(r && r.__v_isRef === true);
    }

    var ComputedRefImpl = /** @class */ (function () {
        function ComputedRefImpl(getter) {
            var _this = this;
            this.dep = undefined;
            this.__v_isRef = true;
            this._dirty = true;
            // this.effect.run()中run()执行的就是这里的getter，就是computed函数包裹的回调函数
            this.effect = new ReactiveEffect(getter, function () {
                // 脏变量_dirty用来控制什么时候执行触发依赖，只有_dirty为false的时候才会触发依赖
                if (!_this._dirty) {
                    _this._dirty = true;
                    console.log(_this);
                    triggerRefValue(_this);
                }
            });
            this.effect.computed = this;
        }
        Object.defineProperty(ComputedRefImpl.prototype, "value", {
            get: function () {
                trackRefValue(this);
                if (this._dirty) {
                    this._dirty = false;
                    // run()执行的就是这里的getter，就是computed函数包裹的回调函数
                    this._value = this.effect.run();
                }
                return this._value;
            },
            enumerable: false,
            configurable: true
        });
        return ComputedRefImpl;
    }());
    // getterOrOptions表示可以是一个函数也可以是一个选项
    function computed(getterOrOptions) {
        var getter;
        // 判断是否是一个函数
        var onlyGetter = isFunction(getterOrOptions);
        if (onlyGetter) {
            getter = getterOrOptions;
        }
        var cRef = new ComputedRefImpl(getter);
        return cRef;
    }

    // 对应promise的pending状态，是一个 标记，表示 promise 进入 pending 状态
    var isFlushPending = false;
    var resolvedPromise = Promise.resolve();
    // 待执行的任务队列
    var pendingPreFlushCbs = [];
    // 队列预处理函数
    function queuePreFlushCb(cb) {
        queueCb(cb, pendingPreFlushCbs);
    }
    // 队列处理函数
    function queueCb(cb, pendingQueue) {
        // 将所有的回调函数，放入队列中
        pendingQueue.push(cb);
        // 负责依次执行队列中的函数
        queueFlush();
    }
    // 依次处理队列中执行函数
    function queueFlush() {
        // 只有pending为false才执行, 这个执行是一个异步任务
        if (!isFlushPending) {
            isFlushPending = true;
            // 把当前的整个任务队列的执行扔到微任务里面，避免通过主线任务执行，扔到微任务中的目的就是为了控制执行规则
            // 通过 Promise.resolve().then() 这样一种 异步微任务的方式 执行了 flushJobs 函数， flushJobs 是一个 异步函数，它会等到 同步任务执行完成之后 被触发
            resolvedPromise.then(flushJobs);
        }
    }
    // 扔进then方法的回调函数，这个是真正去处理队列的函数
    function flushJobs() {
        // 开始处理队列了，就要把pending变成false
        isFlushPending = false;
        flushPreFlushCbs();
    }
    // 循环去进行队列的处理，依次处理队列中的任务
    function flushPreFlushCbs() {
        if (pendingPreFlushCbs.length) {
            // 用Set去重，这里类似于一个深拷贝
            var activePreFlushCbs = __spreadArray([], __read(new Set(pendingPreFlushCbs)), false);
            // 清空旧数据, 把pendingPreFlushCbs置空，则下一次就不会进入这个if语句框里了
            pendingPreFlushCbs.length = 0;
            // 循环处理
            for (var i = 0; i < activePreFlushCbs.length; i++) {
                activePreFlushCbs[i]();
            }
        }
    }

    /**
     * 指定的 watch 函数
     * @param source 监听的响应性数据
     * @param cb 回调函数
     * @param options 配置对象
     * @returns
     */
    function watch(source, cb, options) {
        return doWatch(source, cb, options);
    }
    // 大致原理:收集source中响应式元素包装成getter,在new ReactiveEffect中传递调用run方法执行getter就会收集到依赖,然后当触发依赖更新的时候就会调用scheduler,在根据flush参数,选择同步执行scheduler还是加入调度器
    function doWatch(source, cb, _a) {
        var _b = _a === void 0 ? EMPTY_OBJ : _a, immediate = _b.immediate, deep = _b.deep;
        // 所有的监听数据源都会被包装成getter,这是因为底层都是调用reactivity库的watchEffect,而第一个参数必须是函数,当调用这个函数访问到的变量都会收集依赖。所以如果当前元素为reactive元素的时候需要遍历这个元素的所有值以便所有的变量都能收集到对应的依赖。
        // 触发 getter 的指定函数
        var getter;
        // 判断 source 的数据类型
        if (isReactive(source)) {
            // 指定 getter
            getter = function () { return source; };
            // 深度
            deep = true;
        }
        else {
            getter = function () { };
        }
        // 存在回调函数和deep
        if (cb && deep) {
            // TODO
            var baseGetter_1 = getter; // 浅拷贝，baseGetter和getter都指向相同的内存空间
            // getter = () => baseGetter()
            // traverse就是在循环source里面所有的getter行为，完成对应的依赖收集
            getter = function () { return traverse(baseGetter_1()); };
        }
        // 旧值
        var oldValue = {};
        // job 执行方法，job执行一次，说明watch触发一次
        // 这个job代表的是要传递给Vue调度器的任务,所以这是在创建一个调度器任务。
        // 同时还需要注意这个job是监听的变量发生了改变后才会调用
        var job = function () {
            // 如果存在cb,那么会先调用getter函数获取最新的value,然后再调用cb
            if (cb) {
                // watch(source, cb)
                // effect.run(), 本质上是fn函数的执行，具体而言就是() => traverse(baseGetter())的执行，注意此时activeEffect会被改成这个ReactiveEffect对象
                var newValue = effect.run();
                if (deep || hasChanged(newValue, oldValue)) {
                    cb(newValue, oldValue);
                    oldValue = newValue;
                }
            }
        };
        // 调度器
        var scheduler = function () { return queuePreFlushCb(job); };
        // 最终getter和scheduler都得到了。他们会作为reactiveEffect类的两个参数。第一个为监听的getter函数,在这里面访问的值都会收集到依赖,当这些监听的值发生改变的时候就会调用schgeduler。
        var effect = new ReactiveEffect(getter, scheduler);
        if (cb) {
            if (immediate) {
                job();
            }
            else {
                oldValue = effect.run();
            }
        }
        else {
            effect.run();
        }
        return function () {
            effect.stop();
        };
    }
    function traverse(value) {
        // 对于当前value的类型只可能是两种类型：对象或非对象
        if (!isObject(value)) {
            return value;
        }
        // 通过上面的if判断，这里value说明已经是object类型了，我们再用as进行类型强转一下
        for (var key in value) {
            traverse(value[key]);
        }
        return value;
    }

    exports.computed = computed;
    exports.effect = effect;
    exports.queuePreFlushCb = queuePreFlushCb;
    exports.reactive = reactive;
    exports.ref = ref;
    exports.watch = watch;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map

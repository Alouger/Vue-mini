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
    var isString = function (val) {
        return typeof val === 'string';
    };
    var extend = Object.assign;
    var EMPTY_OBJ = {};
    // 以on开头的
    var onRE = /^on[^a-z]/;
    var isOn = function (key) { return onRE.test(key); };

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

    function normalizeClass(value) {
        var res = '';
        if (isString(value)) {
            res = value;
        }
        else if (isArray(value)) {
            for (var i = 0; i < value.length; i++) {
                var normalized = normalizeClass(value[i]);
                if (normalized) {
                    // class之间用空格间隔
                    res += normalized + ' ';
                }
            }
        }
        else if (isObject(value)) {
            for (var name_1 in value) {
                // 对value进行类型强转，否则报错
                if (value[name_1]) {
                    res += name_1 + ' ';
                }
            }
        }
        return res.trim();
    }

    var Fragment = Symbol('Fragment');
    var Text$1 = Symbol('Text');
    var Comment$1 = Symbol('Comment');
    function isVNode(value) {
        return value ? value.__v_isVNode === true : false;
    }
    /**
    * 生成一个 VNode 对象，并返回
    * @param type vnode.type
    * @param props 标签属性或自定义属性
    * @param children 子节点
    * @returns vnode 对象
    */
    function createVNode(type, props, children) {
        // 解析props
        if (props) {
            // 处理 class
            var klass = props.class; props.style;
            if (klass && !isString(klass)) {
                props.class = normalizeClass(klass);
            }
        }
        // 此处进行DOM类型的计算
        // 通过 bit 位处理 shapeFlag 类型
        // 如果是string类型就当做ELEMENT来看，不是的话就直接给个0
        var shapeFlag = isString(type) ? 1 /* ShapeFlags.ELEMENT */ :
            isObject(type) ? 4 /* ShapeFlags.STATEFUL_COMPONENT */ : 0;
        return createBaseVNode(type, props, children, shapeFlag);
    }
    /**
    * 构建基础 vnode
    */
    function createBaseVNode(type, props, children, shapeFlag) {
        // 先创建VNode对象
        var vnode = {
            __v_isVNode: true,
            type: type,
            props: props,
            shapeFlag: shapeFlag,
            key: (props === null || props === void 0 ? void 0 : props.key) || null
        };
        // 解析/标准化当前VNode的children是什么类型
        normalizeChildren(vnode, children);
        return vnode;
    }
    // normalizeChildren()函数用于对组件的子节点进行规范化处理，将子节点转换为标准的VNode数组。它支持处理字符串、数组和对象类型的子节点，并递归处理多层嵌套的子节点。
    function normalizeChildren(vnode, children) {
        // 根虎当前children的状态进行解析
        var type = 0;
        //   const { shapeFlag } = vnode
        if (children == null) {
            children = null;
        }
        else if (isArray(children)) {
            type = 16 /* ShapeFlags.ARRAY_CHILDREN */;
        }
        else if (typeof children === 'object') ;
        else if (isFunction(children)) ;
        else {
            // children是字符串的情况
            children = String(children);
            type = 8 /* ShapeFlags.TEXT_CHILDREN */;
        }
        vnode.children = children;
        // 按位进行或运算，转成32位的二进制然后按位进行或运算
        // 这行代码相当于 vnode.shapeFlag = vnode.shapeFlag | type
        // 将DOM的类型和子节点children的类型通过或运算合起来，这样就可以同时表示DOM类型和children的类型
        vnode.shapeFlag |= type;
    }
    /**
     * 根据 key || type 判断是否为相同类型节点
     */
    function isSameVNodeType(n1, n2) {
        return n1.type === n2.type && n1.key === n2.key;
    }

    function h(type, propsOrChildren, children) {
        // 获取参数的长度
        var l = arguments.length;
        // 如果用户只传递了两个参数，那么证明第二个参数可能是 props , 也可能是 children
        if (l === 2) {
            // 如果 第二个参数是对象，但不是数组。则第二个参数只有两种可能性：1. VNode 2.普通的 props
            if (isObject(propsOrChildren) && !isArray(propsOrChildren)) {
                // 如果是 VNode，则 第二个参数代表了 children
                if (isVNode(propsOrChildren)) {
                    // 认为是children
                    return createVNode(type, null, [propsOrChildren]);
                }
                // 如果不是 VNode， 则第二个参数代表了 props
                return createVNode(type, propsOrChildren, []);
            }
            // 如果第二个参数不是单纯的 object，则 第二个参数代表了 props
            else {
                // 如果propsOrChildren是数组，则认为是children
                return createVNode(type, null, propsOrChildren);
            } // 如果用户传递了三个或以上的参数，那么证明第二个参数一定代表了 props
        }
        else {
            if (l > 3) {
                // 改变this指向
                children = Array.prototype.slice.call(arguments, 2);
                // 如果传递的参数只有三个，则 children 是单纯的 children
            }
            else if (l === 3 && isVNode(children)) {
                children = [children];
            }
            // 触发 createVNode 方法，创建 VNode 实例
            return createVNode(type, propsOrChildren, children);
        }
    }

    var doc = document;
    var nodeOps = {
        /**
         * 插入指定元素到指定位置
         */
        insert: function (child, parent, anchor) {
            parent.insertBefore(child, anchor || null);
        },
        /**
         * 创建指定 Element
         */
        createElement: function (tag) {
            var el = doc.createElement(tag);
            return el;
        },
        /**
         * 为指定的 element 设置 textContent
         */
        setElementText: function (el, text) {
            el.textContent = text;
        },
        /**
         * 删除指定元素
         */
        remove: function (child) {
            var parent = child.parentNode;
            if (parent) {
                parent.removeChild(child);
            }
        },
        /**
         * 创建 Text 节点
         */
        createText: function (text) { return doc.createTextNode(text); },
        /**
         * 设置 text
         */
        setText: function (node, text) {
            node.nodeValue = text;
        },
        /**
         * 创建 Comment 节点
         */
        createComment: function (text) { return doc.createComment(text); }
    };

    /**
     * 为 class 打补丁
     */
    function patchClass(el, value) {
        if (value === null) {
            el.removeAttribute('class');
        }
        else {
            el.className = value;
        }
    }

    function patchDOMProp(el, key, value) {
        try {
            el[key] = value;
        }
        catch (e) { }
    }

    function patchAttr(el, key, value) {
        // value有时存在有时不存在，所以要判断下
        if (value === null) {
            el.removeAttribute(key);
        }
        else {
            el.setAttribute(key, value);
        }
    }

    /**
     * 为 style 属性进行打补丁
     */
    function patchStyle(el, prev, next) {
        // 获取 style 对象
        var style = el.style;
        // 判断新的样式是否为纯字符串
        var isCssString = isString(next);
        if (next && !isCssString) {
            // 新样式的挂载
            for (var key in next) {
                setStyle(style, key, next[key]);
            }
            // 清理旧样式
            if (prev && !isString(prev)) {
                for (var key in prev) {
                    // 如果在新样式中没有这个旧样式，则进行清理
                    if (next[key] == null) {
                        setStyle(style, key, '');
                    }
                }
            }
        }
    }
    /**
     * 赋值样式
     */
    function setStyle(style, name, val) {
        style[name] = val;
    }

    /**
     * 为 event 事件进行打补丁
     */
    function patchEvent(el, rawName, prevValue, nextValue) {
        // vei = vue event invokers
        var invokers = el._vei || (el._vei = {});
        // 检测是否有缓存行为
        var existingInvoker = invokers[rawName];
        // 如果有新值并且有缓存存在，说明要有更新行为。直接更新 invoker 的 value 即可
        if (nextValue && existingInvoker) {
            // 通过这种方式更替invoker.value()的回调函数内容，而不是调用 addEventListener 和 removeEventListener 解决了频繁的删除、新增事件时非常消耗性能的问题
            existingInvoker.value = nextValue;
        }
        else {
            // 转换成addEventListener和removeEventListener能接受的事件名
            var name_1 = parseName(rawName);
            // 判断此时是新增行为还是删除行为
            if (nextValue) {
                // 新增行为, nextValue一定是存在的
                var invoker = (invokers[rawName] = createInvoker(nextValue));
                el.addEventListener(name_1, invoker);
            }
            else if (existingInvoker) {
                // 删除行为
                el.removeEventListener(name_1, existingInvoker);
                // 删除缓存
                invokers[rawName] = undefined;
            }
        }
    }
    /**
     * 直接返回剔除 on，其余转化为小写的事件名即可
     */
    function parseName(name) {
        // 去掉开头的'on'两个字符，并且转为小写
        return name.slice(2).toLowerCase();
    }
    /**
     * 生成 invoker 函数
     */
    function createInvoker(initialValue) {
        var invoker = function (e) {
            invoker.value && invoker.value();
        };
        // value 为真实的事件行为
        invoker.value = initialValue;
        return invoker;
    }

    var patchProp = function (el, key, prevValue, nextValue) {
        // 根据不同的prop做不同的处理
        if (key === 'class') {
            patchClass(el, nextValue);
        }
        else if (key === 'style') {
            patchStyle(el, prevValue, nextValue);
        }
        else if (isOn(key)) { // 事件是以on开头的
            patchEvent(el, key, prevValue, nextValue);
        }
        else if (shouldSetAsProp(el, key)) { // shouldSetAsProp 用来匹配DOM Properties
            // 通过 DOM Properties 指定
            patchDOMProp(el, key, nextValue);
        }
        else {
            // 其他属性
            patchAttr(el, key, nextValue);
        }
    };
    function shouldSetAsProp(el, key) {
        // 源码中这里写了一大堆边缘情况，我们这里进行简化
        if (key === 'form') {
            // 为什么返回false? 因为对于form表单元素，它是只读的
            return false;
        }
        if (key === 'list' && el.tagName === 'INPUT') {
            // 返回false是因为对于input和list，他们必须通过HTML Attribute的方式进行设定
            return false;
        }
        if (key === 'type' && el.tagName === 'TEXTAREA') {
            // 返回false是因为对于type和TEXTAREA，他们必须通过HTML Attribute的方式进行设定
            return false;
        }
        // 只要key是props的就返回true
        return key in el;
    }

    /**
      * 解析 render 函数的返回值
      */
    function renderComponentRoot(instance) {
        var vnode = instance.vnode, render = instance.render, data = instance.data;
        var result;
        try {
            // 解析到状态组件
            if (vnode.shapeFlag & 4 /* ShapeFlags.STATEFUL_COMPONENT */) {
                // 获取到 result 返回值
                // call()改变this指向, render函数里的this就会指向data
                // 如果 render 中使用了 this，则需要修改 this 指向
                result = normalizeVNode(render.call(data));
            }
        }
        catch (error) {
            console.error(error);
        }
        return result;
    }
    // 生成标准化的VNode
    function normalizeVNode(child) {
        // 如果当前child已经是一个VNode了, 直接return child
        if (typeof child === 'object') {
            return cloneIfMounted(child);
        }
        else {
            return createVNode(Text, null, String(child));
        }
    }
    /**
     * clone VNode
     */
    function cloneIfMounted(child) {
        return child;
    }

    /**
     * 注册 hook
     */
    function injectHook(type, hook, target) {
        // 将 hook 注册到 组件实例中
        if (target) {
            // target里的生命周期等于hook
            target[type] = hook;
            return hook;
        }
    }
    /**
     * 创建一个指定的 hook
     * @param lifecycle 指定的 hook enum
     * @returns 注册 hook 的方法
     */
    var createHook = function (lifecycle) {
        return function (hook, target) { return injectHook(lifecycle, hook, target); };
    };
    var onBeforeMount = createHook("bm" /* LifecycleHooks.BEFORE_MOUNT */);
    var onMounted = createHook("m" /* LifecycleHooks.MOUNTED */);

    var uid = 0;
    /**
     * 创建组件实例
     */
    function createComponentInstance(vnode) {
        var type = vnode.type;
        // 生成组件实例实际上就是个对象
        var instance = {
            uid: uid++,
            // instance的vnode指向这个传进函数的vnode，vnode的component指向instance
            vnode: vnode,
            type: type,
            // subTree实际上就是组件里面真实要渲染的渲染数
            subTree: null,
            effect: null,
            update: null,
            render: null,
            isMounted: false,
            bc: null,
            c: null,
            bm: null,
            m: null // mounted
        };
        return instance;
    }
    /**
     * 规范化组件实例数据
     */
    function setupComponent(instance) {
        // 为 render 赋值
        var setupResult = setupStatefulComponent(instance);
        return setupResult;
    }
    function setupStatefulComponent(instance) {
        var Component = instance.type;
        var setup = Component.setup;
        // 存在 setup ，则直接获取 setup 函数的返回值即可
        if (setup) {
            // setupResult在案例中就是setup函数return的匿名渲染函数() => h('div', obj.name)
            var setupResult = setup();
            handleSetupResult(instance, setupResult);
        }
        else {
            // 如果不存在setup，说明是options API, 获取组件实例
            finishComponentSetup(instance);
        }
    }
    function handleSetupResult(instance, setupResult) {
        // 存在 setupResult，并且它是一个函数，则 setupResult 就是需要渲染的 render
        if (isFunction(setupResult)) {
            instance.render = setupResult;
        }
        finishComponentSetup(instance);
    }
    function finishComponentSetup(instance) {
        // instance.type实际上就是component里面的render函数内容
        var Component = instance.type;
        // 组件不存在 render 时，才需要重新赋值
        if (!instance.render) {
            instance.render = Component.render;
        }
        // 改变 options 中的 this 指向
        applyOptions(instance);
    }
    function applyOptions(instance) {
        var _a = instance.type, dataOptions = _a.data, beforeCreate = _a.beforeCreate, created = _a.created, beforeMount = _a.beforeMount, mounted = _a.mounted;
        // hooks
        if (beforeCreate) {
            callHook(beforeCreate, instance.data);
        }
        // 存在 data 选项时
        if (dataOptions) {
            // 触发 dataOptions 函数，拿到 data 对象
            var data = dataOptions();
            // 如果拿到的 data 是一个对象
            if (isObject(data)) {
                // 则把 data 包装成 reactiv 的响应性数据，赋值给 instance
                instance.data = reactive(data);
            }
        }
        // hooks
        if (created) {
            // debugger
            callHook(created, instance.data);
        }
        function registerLifecycleHook(register, hook) {
            register(hook === null || hook === void 0 ? void 0 : hook.bind(instance.data), instance);
        }
        // 注册 hooks
        registerLifecycleHook(onBeforeMount, beforeMount);
        registerLifecycleHook(onMounted, mounted);
    }
    function callHook(hook, proxy) {
        // 注意这里bind后面还有一个括号
        hook.bind(proxy)();
    }

    /**
     * 对外暴露的创建渲染器的方法
     */
    // RendererOptions里面是一些兼容性的方法
    function createRenderer(options) {
        return baseCreateRenderer(options);
    }
    /**
     * 生成 renderer 渲染器
     * @param options 兼容性操作配置对象
     * @returns
     */
    function baseCreateRenderer(options) {
        /**
        * 解构 options，获取所有的兼容性方法。一系列用于操作DOM的辅助函数，如insert、remove、patch等。这些函数负责实际的DOM操作，用于将虚拟DOM转换为实际的DOM，并进行插入、删除、更新等操作
        */
        var hostInsert = options.insert, hostPatchProp = options.patchProp, hostCreateElement = options.createElement, hostSetElementText = options.setElementText, hostRemove = options.remove, hostCreateText = options.createText, hostSetText = options.setText, hostCreateComment = options.createComment;
        /**
         * 组件的打补丁操作
         */
        var processComponet = function (oldVNode, newVNode, container, anchor) {
            // debugger
            if (oldVNode == null) {
                // 挂载
                mountComponent(newVNode, container, anchor);
            }
        };
        /**
         * Fragment 的打补丁操作
         */
        var processFragment = function (oldVNode, newVNode, container, anchor) {
            if (oldVNode == null) {
                mountChildren(newVNode.children, container, anchor);
            }
            else {
                patchChildren(oldVNode, newVNode, container, anchor);
            }
        };
        /**
         * Comment 的打补丁操作
         */
        var processCommentNode = function (oldVNode, newVNode, container, anchor) {
            // 不存在旧的节点，则为 挂载 操作
            if (oldVNode == null) {
                // 生成节点
                newVNode.el = hostCreateComment(newVNode.children);
                // 挂载
                hostInsert(newVNode.el, container, anchor);
            }
            else {
                // 无更新
                // vue3中并不支持注释的动态更新
                newVNode.el = oldVNode.el;
            }
        };
        /**
         * Text 的打补丁操作
         */
        var processText = function (oldVNode, newVNode, container, anchor) {
            // 不存在旧的节点，则为 挂载 操作
            if (oldVNode == null) {
                // 生成节点
                newVNode.el = hostCreateText(newVNode.children);
                // 挂载
                hostInsert(newVNode.el, container, anchor);
            }
            else {
                // 存在旧的节点，则为 更新 操作
                // 更新, 感叹号的作用是断言oldVNode是必然存在的
                var el = (newVNode.el = oldVNode.el);
                if (newVNode.children !== oldVNode.children) {
                    hostSetText(el, newVNode.children);
                }
            }
        };
        var processElement = function (oldVNode, newVNode, container, anchor) {
            // 根据旧节点是否存在来判断我们当前是要进行挂载操作还是更新操作
            if (oldVNode === null) {
                // 为空，进行挂载
                mountElement(newVNode, container, anchor);
            }
            else {
                // 不为空，进行更新
                patchElement(oldVNode, newVNode);
            }
        };
        var mountComponent = function (initialVNode, container, anchor) {
            // 先生成组件的实例
            initialVNode.component = createComponentInstance(initialVNode);
            // 浅拷贝，绑定同一块内存空间
            var instance = initialVNode.component;
            // 标准化组件实例数据
            setupComponent(instance);
            // 该函数负责真正渲染组件，设置组件渲染
            setupRenderEffect(instance, initialVNode, container, anchor);
        };
        /**
         * 设置组件渲染
         */
        var setupRenderEffect = function (instance, initialVNode, container, anchor) {
            // 组件挂载和更新的方法
            var componentUpdateFn = function () {
                // 当前处于 mounted 之前，即执行 挂载 逻辑
                if (!instance.isMounted) {
                    // 获取 hook
                    var bm = instance.bm, m = instance.m;
                    // beforeMount hook
                    if (bm) {
                        bm();
                    }
                    // debugger
                    // subTree得到的就是案例component中render函数返回的h('div', 'hello component')，一个VNode。debugger到这里显示的是：
                    // subTree: 
                    //   children: "hello component"
                    //   props: null
                    //   shapeFlag: 9
                    //   type: "div"
                    //   __v_isVNode: true
                    // 从 render 中获取需要渲染的内容
                    var subTree = (instance.subTree = renderComponentRoot(instance));
                    // 通过 patch 对 subTree，进行打补丁。即：渲染组件
                    patch(null, subTree, container, anchor);
                    // mounted hook
                    if (m) {
                        m();
                    }
                    /** 经过patch函数后subTree新增el，为：
                     * subTree:
                         children: "hello component"
                         el: div
                         props: null
                         shapeFlag: 9
                         type: "div"
                         __v_isVNode: true
                     */
                    // 把组件根节点的 el，作为组件的 el
                    initialVNode.el = subTree.el;
                    // 在渲染完毕后，把标志位isMounted修改为true
                    instance.isMounted = true;
                }
                else {
                    var next = instance.next, vnode = instance.vnode;
                    if (!next) {
                        next = vnode;
                    }
                    // 获取下一次的 subTree
                    var nextTree = renderComponentRoot(instance);
                    // 保存上一次的subTree，以便进行更新操作
                    var prevTree = instance.subTree;
                    instance.subTree = nextTree;
                    // 更新
                    patch(prevTree, nextTree, container, anchor);
                    // 更新 next
                    next.el = nextTree.el;
                }
            };
            // 创建包含 scheduler 的 effect 实例
            var effect = (instance.effect = new ReactiveEffect(componentUpdateFn, function () { return queuePreFlushCb(update); }));
            // 生成 update 函数
            var update = (instance.update = function () { return effect.run(); });
            // 触发 update 函数，本质上触发的是 componentUpdateFn
            update();
        };
        /**
         * element 的挂载操作
         */
        var mountElement = function (vnode, container, anchor) {
            // 执行挂载本质上就是创建element，设置文本子节点，处理props插入
            var type = vnode.type, props = vnode.props, shapeFlag = vnode.shapeFlag;
            // 1. 创建element, 这里的el和vnode中的el进行了浅绑定。这里传入的type是虚拟节点vnode的type，假设vnode的type是div，那么这里hostCreateElement返回的也是div标签，所以最终el等于div标签，vnode.el也等于div标签
            // 源码里写的是 el = vnode.el = hostCreateElement(...), 相当于是让el和vnode.el进行浅拷贝，然后最终的值等于hostCreateElement()
            var el = (vnode.el = hostCreateElement(type));
            // 如果能按位匹配上TEXT_CHILDREN
            // dubug时shapeFlag = 9, 二进制为00000000 00000000 00000000 00001001
            // 而ShapeFlags.TEXT_CHILDREN = 8, 二进制为00000000 00000000 00000000 00001000
            // 两者进行与运算结果为00000000 00000000 00000000 00001000，十进制为8，不为0，所以if(8)判定为true
            if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                // 2. 设置文本
                // host开头的本质上都是我们传递过来的这个nodeOps里面这个浏览器相关的函数
                hostSetElementText(el, vnode.children);
            }
            else if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                mountChildren(vnode.children, el, anchor);
            }
            // 3. 设置props
            if (props) {
                for (var key in props) {
                    hostPatchProp(el, key, null, props[key]);
                }
            }
            // 4. 插入
            hostInsert(el, container, anchor);
        };
        var patchElement = function (oldVNode, newVNode) {
            // 三者进行一个浅拷贝，都指向同一块内存空间
            var el = (newVNode.el = oldVNode.el);
            // 获取新旧props
            var oldProps = oldVNode.props || EMPTY_OBJ;
            var newProps = newVNode.props || EMPTY_OBJ;
            // 更新子节点
            patchChildren(oldVNode, newVNode, el, null);
            patchProps(el, newVNode, oldProps, newProps);
        };
        /**
         * 挂载子节点
         */
        var mountChildren = function (children, container, anchor) {
            if (isString(children)) {
                // 把字符串转成了数组
                children = children.split('');
            }
            // 对children的循环渲染
            for (var i = 0; i < children.length; i++) {
                var child = (children[i] = normalizeVNode(children[i]));
                // 渲染
                patch(null, child, container, anchor);
            }
        };
        /**
         * 为子节点打补丁
         */
        var patchChildren = function (oldVNode, newVNode, container, anchor) {
            // 逻辑中断
            var c1 = oldVNode && oldVNode.children;
            // 获取旧的shapeFlag
            var prevShapeFlag = oldVNode ? oldVNode.shapeFlag : 0;
            var c2 = newVNode && newVNode.children;
            // 新的newVNode中必然存在shapeFlag
            var shapeFlag = newVNode.shapeFlag;
            // 新子节点为 TEXT_CHILDREN
            if (shapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                // 新旧子节点不同
                if (c2 !== c1) {
                    // 挂载新子节点的文本
                    hostSetElementText(container, c2);
                }
            }
            else {
                // 新节点不是TEXT_CHILDREN，旧子节点为 ARRAY_CHILDREN
                if (prevShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                    // 新子节点也为 ARRAY_CHILDREN，旧子节点为 ARRAY_CHILDREN
                    if (shapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) {
                        // TODO: 这里要进行 diff 运算
                        patchKeyedChildren(c1, c2, container, anchor);
                    }
                }
                else {
                    // 新节点不是TEXT_CHILDREN，旧子节点为 TEXT_CHILDREN
                    if (prevShapeFlag & 8 /* ShapeFlags.TEXT_CHILDREN */) {
                        // 删除旧的文本
                        hostSetElementText(container, '');
                    }
                }
            }
        };
        /**
         * diff
         */
        var patchKeyedChildren = function (oldChildren, newChildren, container, parentAnchor) {
            // 索引
            var i = 0;
            // 新的子节点数组的长度
            var newChildrenLength = newChildren.length;
            // 旧的子节点最大（最后一个）下标
            var oldChildrenEnd = oldChildren.length - 1;
            // 新的子节点最大（最后一个）下标
            var newChildrenEnd = newChildrenLength - 1;
            // 1. 自前向后diff 对比。经过该循环之后，从前开始的相同 vnode 将被处理
            while (i <= oldChildrenEnd && i <= newChildrenEnd) {
                var oldVNode = oldChildren[i];
                var newVNode = normalizeVNode(newChildren[i]);
                // 如果 oldVNode 和 newVNode 被认为是同一个 vnode，则直接 patch 即可
                if (isSameVNodeType(oldVNode, newVNode)) {
                    patch(oldVNode, newVNode, container, null);
                }
                else {
                    // 如果不被认为是同一个 vnode，则直接跳出循环
                    break;
                }
                // 下标自增
                i++;
            }
            // 2. 自后向前diff对比。经过该循环之后，从后开始的相同 vnode 将被处理
            while (i <= oldChildrenEnd && i <= newChildrenEnd) {
                var oldVNode = oldChildren[oldChildrenEnd];
                var newVNode = newChildren[newChildrenEnd];
                if (isSameVNodeType(oldVNode, newVNode)) {
                    patch(oldVNode, newVNode, container, null);
                }
                else {
                    break;
                }
                oldChildrenEnd--;
                newChildrenEnd--;
            }
            // 3. 新节点多于旧节点
            if (i > oldChildrenEnd) {
                if (i <= newChildrenEnd) {
                    var nextPos = newChildrenEnd + 1;
                    // 锚点anchor决定了我们新节点渲染的位置，表示我们新增的这个节点要被插入到锚点之前上去
                    var anchor = nextPos < newChildrenLength ? newChildren[nextPos].el : parentAnchor;
                    while (i <= newChildrenEnd) {
                        // 因为我们是新增节点，所有patch函数在形参列表第一个参数（代表旧节点）可以是null
                        patch(null, normalizeVNode(newChildren[i]), container, anchor);
                        i++;
                    }
                }
            }
            // 4. 旧节点多于新节点
            else if (i > newChildrenEnd) {
                while (i <= oldChildrenEnd) {
                    unmount(oldChildren[i]);
                    i++;
                }
            }
            // 5. 乱序的 diff 比对
            else {
                // 旧子节点的开始索引
                var oldStartIndex = i;
                // 新子节点的开始索引
                var newStartIndex = i;
                // 5.1 build key: index map for newChildren
                // 遍历新节点，生成keyToNewIndexMap
                // 键值为新节点的key值，值为新节点的索引, 伪代码：keyToNewIndexMap<key, index> 
                var keyToNewIndexMap = new Map();
                for (i = newStartIndex; i <= newChildrenEnd; i++) {
                    // 从 newChildren 中根据开始索引获取每一个 child
                    var nextChild = normalizeVNode(newChildren[i]);
                    // child 必须存在 key（这也是为什么 v-for 必须要有 key 的原因）
                    if (nextChild.key != null) {
                        // 把 key 和 对应的索引，放到 keyToNewIndexMap 对象中
                        keyToNewIndexMap.set(nextChild.key, i);
                    }
                }
                // 5.2 创建将要patch的节点数组newIndexToOldIndexMap, 并尝试进行 patch（打补丁）或 unmount（删除）旧节点
                // 下标为新节点的索引，值为旧节点的索引+1
                var j 
                // 记录已经 patch 的节点数
                = void 0;
                // 记录已经 patch 的节点数
                var patched = 0;
                // 计算新节点中还有多少节点需要被 patch
                var toBePatched = newChildrenEnd - newStartIndex + 1;
                // 标记是否需要移动
                var moved = false;
                // 记录这次对比的旧节点到新节点最长可复用的索引, 配合 moved 进行使用，它始终保存当前最大的 index 值
                var maxNewIndexSoFar = 0;
                /**
                 * 创建将要patch的节点数组
                 * 新节点对应旧节点的数组
                 * 数组下标为新节点的索引(即 当前newChildrenIndex - newStartIndex)，值为旧节点的索引+1
                 */
                var newIndexToOldIndexMap = new Array(toBePatched);
                /**
                 * 默认置为 0
                 * 表示新增节点
                 * 这也是为什么值是 旧节点索引+1 而不直接存索引的原因了
                 * 后续判断是否存在可复用的旧节点再重新赋值
                 */
                for (i = 0; i < toBePatched; i++)
                    newIndexToOldIndexMap[i] = 0;
                // 遍历 oldChildren（s1 = oldChildrenStart; e1 = oldChildrenEnd），
                // 获取旧节点（oldChildren），如果当前 已经处理的节点数量 > 待处理的节点数量，
                // 那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
                for (i = oldStartIndex; i <= oldChildrenEnd; i++) {
                    // 获取一下旧虚拟节点
                    var prevChild = oldChildren[i];
                    if (patched >= toBePatched) {
                        // 已经patch的节点数量大于或等于需要被patch的节点数
                        // 说明当前节点是需要被删除的
                        // patched >= toBePatched代表新vnode已经循环完成，不需要再找复用的旧vnode
                        // 说明剩下还没复用的旧vnode都已经废弃，直接unmount()移除，一般发生在旧vnode末尾存在废弃节点
                        unmount(prevChild);
                        continue;
                    }
                    // 遍历 oldChildren（s1 = oldChildrenStart; e1 = oldChildrenEnd），获取旧节点（c1 = oldChildren），如果当前 已经处理的节点数量 > 待处理的节点数量，那么就证明：《所有的节点都已经更新完成，剩余的旧节点全部删除即可》
                    // 获取当前旧节点对应的新节点索引
                    var newIndex 
                    // -------- 寻找能够复用的vnode的newIndex --------------
                    // 旧节点的 key 存在时
                    = void 0;
                    // -------- 寻找能够复用的vnode的newIndex --------------
                    // 旧节点的 key 存在时
                    if (prevChild.key != null) {
                        /**
                         * 旧节点存在key值
                         * 直接在 keyToNewIndexMap 查找
                         * 获取新节点的索引（newIndex）
                         */
                        newIndex = keyToNewIndexMap.get(prevChild.key);
                    }
                    // 最终没有找到新节点的索引，则证明：当前旧节点没有对应的新节点
                    if (newIndex === undefined) {
                        /**
                         * newIndex 为 undefined
                         * 说明当前旧节点在新的虚拟 DOM 树中被删了
                         * 直接卸载
                         */
                        unmount(prevChild);
                    }
                    else {
                        // -------- 寻找能够复用的vnode的newIndex --------------
                        /**
                         * newIndex有值
                         * 说明当前旧节点在新节点数组中还存在，可能只是挪了位置
                         * 那么接下来就是要判断对于该新节点而言，是要 patch（打补丁）还是 move（移动）
                         */
                        /**
                         * 记录一下 newIndexToOldIndexMap
                         * 表明当前新旧节点需要 patch
                         */
                        // ========逻辑3：newIndexToOldIndexMap和move的构建为下一步骤做准备========
                        // 因为 newIndex 包含已处理的节点，所以需要减去newChildrenStart, 表示：不计算已处理的节点
                        newIndexToOldIndexMap[newIndex - newStartIndex] = i + 1;
                        if (newIndex >= maxNewIndexSoFar) {
                            // 持续递增, 新节点索引大于或等于最长可复用索引，重新赋值
                            maxNewIndexSoFar = newIndex;
                        }
                        else {
                            /**
                             * 反之
                             * 说明新节点在最长可复用节点的左侧
                             * 需要移动（左移）
                             * newIndex < maxNewIndexSoFar说明目前的旧vnode的位置应该移动到它前面旧vnode的前面去，即目前的旧vnode是需要移动的
                             */
                            moved = true;
                        }
                        // ========逻辑3：newIndexToOldIndexMap和move的构建为下一步骤做准备========
                        // -------- 寻找了能够复用的vnode的newIndex，更新能复用的旧vnode --------------
                        // 直接复用，patch（处理可能存在的孙子节点、更新一下属性等）
                        patch(prevChild, newChildren[newIndex], container, null);
                        patched++;
                    }
                }
                // 5.3：移动/新增处理
                // 由步骤5.2可以知道，该步骤会移除所有废弃的旧vnode，
                // 因此剩余的逻辑只有 移动可复用的vnode到正确的位置 + 插入之前没有过的新vnode
                /**
                 * 仅当节点需要移动的时候，我们才需要生成最长递增子序列，否则只需要有一个空数组即可
                 * 根据 newIndexToOldIndexMap 数组
                 * 生成最长稳定序列
                 * 最长稳定序列在这里存的就是不需要移动的节点索引
                 */
                var increasingNewIndexSequence = moved
                    ? getSequence(newIndexToOldIndexMap)
                    : [];
                // 最长稳定序列末尾节点索引
                // j >= 0 表示：初始值为 最长递增子序列的最后下标
                // j < 0 表示：《不存在》最长递增子序列。
                j = increasingNewIndexSequence.length - 1;
                // 从后往前遍历需要 patch 的节点数
                // 从尾->头进行新vnode的遍历
                // 使用倒序遍历新的children数组是因为以便我们可以使用最后修补的节点作为锚点, 如果没有相同的后置元素，则添加到container子元素的末尾，如果有相同的后置元素，则以最前面一个后置元素作为anchor
                for (i = toBePatched - 1; i >= 0; i--) {
                    // 新虚拟节点索引
                    // 在步骤5.2的计算是const toBePatched = newChildrenEnd - newStartIndex + 1
                    // 所以newChildrenEnd = newStartIndex + toBePatched - 1
                    //                    = newStartIndex + i
                    // nextIndex（需要更新的新节点下标） = newChildrenStart + i
                    var nextIndex = newStartIndex + i;
                    // 新虚拟节点
                    var nextChild = newChildren[nextIndex];
                    // 将新节点的真实 DOM 作为后续插入的锚点（是否超过了最长长度）
                    var anchor = nextIndex + 1 < newChildrenLength
                        ? newChildren[nextIndex + 1].el
                        : parentAnchor;
                    if (newIndexToOldIndexMap[i] === 0) {
                        /**
                         * newIndexToOldIndexMap是以newChildrenArray建立的初始化都为0的数组，
                         * 然后在步骤5.2 逻辑3进行oldChildrenArray的遍历，找到可以复用的新vnode，
                         * 进行newIndexToOldIndexMap[xxx]=旧vnode的index+1的赋值，
                         * 因此newIndexToOldIndexMap[xxx]=0就代表这个新vnode是之前没有过的，
                         * 直接进行patch(null, nextChild)，即mount()插入新的元素
                         * 为 0 的话就是新增的节点
                         * 直接挂载新节点
                         */
                        patch(null, nextChild, container, anchor);
                    }
                    else if (moved) {
                        // j < 0 表示：不存在 最长递增子序列
                        // i !== increasingNewIndexSequence[j] 表示：当前节点不在最后位置
                        // 那么此时就需要 move （移动）
                        if (j < 0 || i !== increasingNewIndexSequence[j]) {
                            /**
                             * 当前索引不在最长递增序列中
                             * 移动当前索引对应的新节点
                             * 移动到锚点节点之前
                             */
                            move(nextChild, container, anchor);
                        }
                        else {
                            j--;
                        }
                    }
                }
            }
        };
        /**
         * 移动节点到指定位置
         */
        var move = function (vnode, container, anchor) {
            var el = vnode.el;
            hostInsert(el, container, anchor);
        };
        /**
         * 为 props 打补丁
         */
        var patchProps = function (el, vnode, oldProps, newProps) {
            // debugger
            // 新旧 props 不相同时才进行处理
            if (oldProps !== newProps) {
                // 遍历新的 props，依次触发 hostPatchProp ，赋值新属性
                for (var key in newProps) {
                    var next = newProps[key];
                    var prev = oldProps[key];
                    if (next !== prev) {
                        hostPatchProp(el, key, prev, next);
                    }
                }
                // 存在旧的 props 时
                if (oldProps !== EMPTY_OBJ) {
                    // 遍历旧的 props，依次触发 hostPatchProp ，删除不存在于新props 中的旧属性
                    for (var key in oldProps) {
                        if (!(key in newProps)) {
                            hostPatchProp(el, key, oldProps[key], null);
                        }
                    }
                }
            }
        };
        var patch = function (oldVNode, newVNode, container, anchor) {
            if (anchor === void 0) { anchor = null; }
            if (oldVNode === newVNode) {
                return;
            }
            // debugger
            /**
             * 判断是否为相同类型节点
             */
            if (oldVNode && !isSameVNodeType(oldVNode, newVNode)) {
                unmount(oldVNode);
                oldVNode = null;
            }
            var type = newVNode.type, shapeFlag = newVNode.shapeFlag;
            switch (type) {
                case Text:
                    processText(oldVNode, newVNode, container, anchor);
                    break;
                case Comment:
                    processCommentNode(oldVNode, newVNode, container, anchor);
                    break;
                case Fragment:
                    processFragment(oldVNode, newVNode, container, anchor);
                    break;
                default:
                    // 如果按位进行与运算能匹配到ELEMENT
                    // debug时传入的shapeFlag为9，二进制为00000000 00000000 00000000 00001001
                    // 同时ShapeFlags.ELEMENT = 1, 二进制为00000000 00000000 00000000 00000001，
                    // 进行与运算就是00000000 00000000 00000000 00000001，十进制就是1，那么if(1)就判定为true
                    if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                        processElement(oldVNode, newVNode, container, anchor);
                    }
                    else if (shapeFlag & 6 /* ShapeFlags.COMPONENT */) {
                        processComponet(oldVNode, newVNode, container, anchor);
                    }
            }
        };
        var unmount = function (vnode) {
            hostRemove(vnode.el);
        };
        // 源码中这里是有第三个参数，也就是isSVG，但这里我们不考虑这种情况
        var render = function (vnode, container) {
            // debugger
            if (vnode === null) {
                // 如果vnode为空，我们执行卸载操作
                // TODO: 卸载
                // 新的 vnode 不存在，旧的 vnode 存在，说明当前属于 unmount 操作
                if (container._vnode) {
                    unmount(container._vnode);
                }
            }
            else {
                // 如果不为空，我们就执行一个打补丁的操作（包括了挂载和更新）
                // 第一个参数是旧节点，如果没有的话就传null
                console.log(container);
                patch(container._vnode || null, vnode, container);
            }
            // 将新的 vnode 存储到 container._vnode 中，即后续渲染中旧的 vnode
            container._vnode = vnode;
        };
        return {
            render: render
        };
    }
    /**
     * 获取最长递增子序列下标
     * 维基百科：https://en.wikipedia.org/wiki/Longest_increasing_subsequence
     * 百度百科：https://baike.baidu.com/item/%E6%9C%80%E9%95%BF%E9%80%92%E5%A2%9E%E5%AD%90%E5%BA%8F%E5%88%97/22828111
     */
    function getSequence(arr) {
        // 获取一个数组浅拷贝。注意 p 的元素改变并不会影响 arr
        // p 是一个最终的回溯数组，它会在最终的 result 回溯中被使用
        // 它会在每次 result 发生变化时，记录 result 更新前最后一个索引的值
        var p = arr.slice();
        // 定义返回值（最长递增子序列下标），因为下标从 0 开始，所以它的初始值为 0
        var result = [0];
        var i, j, u, v, c;
        // 当前数组的长度
        var len = arr.length;
        // 对数组中所有的元素进行 for 循环处理，i = 下标
        for (i = 0; i < len; i++) {
            // 根据下标获取当前对应元素
            var arrI = arr[i];
            //
            if (arrI !== 0) {
                // 获取 result 中的最后一个元素，即：当前 result 中保存的最大值的下标
                j = result[result.length - 1];
                // arr[j] = 当前 result 中所保存的最大值
                // arrI = 当前值
                // 如果 arr[j] < arrI 。那么就证明，当前存在更大的序列，那么该下标就需要被放入到 result 的最后位置
                if (arr[j] < arrI) {
                    p[i] = j;
                    // 把当前的下标 i 放入到 result 的最后位置
                    result.push(i);
                    continue;
                }
                // 不满足 arr[j] < arrI 的条件，就证明目前 result 中的最后位置保存着更大的数值的下标。
                // 但是这个下标并不一定是一个递增的序列，比如： [1, 3] 和 [1, 2]
                // 所以我们还需要确定当前的序列是递增的。
                // 计算方式就是通过：二分查找来进行的
                // 初始下标
                u = 0;
                // 最终下标
                v = result.length - 1;
                // 只有初始下标 < 最终下标时才需要计算
                while (u < v) {
                    // (u + v) 转化为 32 位 2 进制，右移 1 位 === 取中间位置（向下取整）例如：8 >> 1 = 4;  9 >> 1 = 4; 5 >> 1 = 2
                    // https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Operators/Right_shift
                    // c 表示中间位。即：初始下标 + 最终下标 / 2 （向下取整）
                    c = (u + v) >> 1;
                    // 从 result 中根据 c（中间位），取出中间位的下标。
                    // 然后利用中间位的下标，从 arr 中取出对应的值。
                    // 即：arr[result[c]] = result 中间位的值
                    // 如果：result 中间位的值 < arrI，则 u（初始下标）= 中间位 + 1。即：从中间向右移动一位，作为初始下标。 （下次直接从中间开始，往后计算即可）
                    if (arr[result[c]] < arrI) {
                        u = c + 1;
                    }
                    else {
                        // 否则，则 v（最终下标） = 中间位。即：下次直接从 0 开始，计算到中间位置 即可。
                        v = c;
                    }
                }
                // 最终，经过 while 的二分运算可以计算出：目标下标位 u
                // 利用 u 从 result 中获取下标，然后拿到 arr 中对应的值：arr[result[u]]
                // 如果：arr[result[u]] > arrI 的，则证明当前  result 中存在的下标 《不是》 递增序列，则需要进行替换
                if (arrI < arr[result[u]]) {
                    if (u > 0) {
                        p[i] = result[u - 1];
                    }
                    // 进行替换，替换为递增序列
                    result[u] = i;
                }
            }
        }
        // 重新定义 u。此时：u = result 的长度
        u = result.length;
        // 重新定义 v。此时 v = result 的最后一个元素
        v = result[u - 1];
        // 自后向前处理 result，利用 p 中所保存的索引值，进行最后的一次回溯
        while (u-- > 0) {
            result[u] = v;
            v = p[v];
        }
        return result;
    }

    var rendererOptions = extend({ patchProp: patchProp }, nodeOps);
    var renderer;
    function ensureRenderer() {
        // createRenderer返回的值其实就是baseCreateRender返回的值, baseCreateRender返回的值就包含了render函数
        return renderer || (renderer = createRenderer(rendererOptions));
    }
    var render = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = ensureRenderer()).render.apply(_a, __spreadArray([], __read(args), false));
    };

    /**
     * 创建解析器上下文
     */
    function createParserContext(content) {
        // 合成 context 上下文对象
        return {
            source: content
        };
    }
    function createRoot(children) {
        return {
            type: 0 /* NodeTypes.ROOT */,
            children: children,
            loc: {}
        };
    }
    /**
     * 基础的 parse 方法，生成 AST
     * @param content tempalte 模板
     * @returns
     */
    function baseParse(content) {
        // 创建 parser 对象，未解析器的上下文对象
        var context = createParserContext(content);
        var children = parseChildren(context, []);
        console.log(children);
        return createRoot(children);
    }
    /**
     * 解析子节点
     * @param context 上下文
     * @param mode 文本模型
     * @param ancestors 祖先节点
     * @returns
     */
    function parseChildren(context, ancestors) {
        // 存放所有 node节点数据的数组
        var nodes = [];
        /**
         * parseChildren 本质上是一个状态机，因此这里开启一个 while 循环使得状态机自动运行
         * 当标签未闭合时，解析对应阶段
         * 循环解析所有 node 节点，可以理解为对 token 的处理。
         * 例如：<div>hello world</div>，此时的处理顺序为：
         * 1. <div
         * 2. >
         * 3. hello world
         * 4. </
         * 5. div>
         */
        while (!isEnd(context, ancestors)) {
            /**
             * 模板源
             */
            var s = context.source;
            // 定义 node 节点
            var node 
            // 如果开头是模板插值语法
            = void 0;
            // 如果开头是模板插值语法
            if (startsWith(s, '{{')) ;
            // < 意味着一个标签的开始
            else if (s[0] === '<') {
                // 如果第一个字符是 "<"，并且第二个字符是 小写英文字符，则认为这是一个标签节点(<x)，于是调用 parseElement 完成标签的解
                // 以 < 开始，后面跟a-z 表示，这是一个标签的开始
                if (/[a-z]/i.test(s[1])) {
                    // 此时要处理 Element
                    node = parseElement(context, ancestors);
                }
            }
            // node 不存在意味着上面的两个 if 都没有进入，那么我们就认为此时的 token 为文本节点
            if (!node) {
                node = parseText(context);
            }
            pushNode(nodes, node);
        }
        return nodes;
    }
    /**
     * 解析 Element 元素。例如：<div>
     * ancestors 参数模拟栈结构，存储解析过程中的父级节点
     */
    function parseElement(context, ancestors) {
        // -- 先处理开始标签 --
        var element = parseTag(context);
        // 在 parseTag 解析函数执行完毕后，会消费字符串的中的内容<tag>, 比如<div>
        console.log("parseElement context", context);
        console.log("parseElement element", element);
        //  -- 处理子节点 --
        // 将解析处理的标签节点压入父级节点栈
        ancestors.push(element);
        // 递归触发 parseChildren 解析子节点
        var children = parseChildren(context, ancestors);
        // parseChildren 函数会消费字符串的内容：hello world。处理后的模板内容将变为：</div>
        // 解析完当前标签节点后，需要弹出父节点栈中的栈顶元素，即与当前解析的同名的标签
        ancestors.pop();
        // 为子节点赋值
        element.children = children;
        //  -- 最后处理结束标签 --
        if (startsWithEndTagOpen(context.source, element.tag)) {
            parseTag(context);
        }
        // 整个标签处理完成
        return element;
    }
    /**
     * 解析标签
     */
    function parseTag(context, type) {
        // -- 处理标签开始部分 --
        // 通过正则获取标签名
        console.log(context);
        var match = /^<\/?([a-z][^\r\n\t\f />]*)/i.exec(context.source);
        /**
         * 对于字符串 '<div>'，会匹配出字符串 '<div'，剩余 '>'
         * 对于字符串 '<div />'，会匹配出字符串 '<div'，剩余 '/>'
         * 对于字符串 '<div---->'，其中减号(-) 代表空白符，会匹配出字符串 '<div'，剩余 '---->'
         */
        console.log(match);
        // 标签名字
        var tag = match[1];
        // 游标右移，消费正则表达式匹配的全部内容，例如 <div 这段内容    
        // 对模板进行解析处理
        advanceBy(context, match[0].length);
        console.log(context);
        // -- 处理标签结束部分 --
        // 判断是否为自关闭标签，例如 <img />
        var isSelfClosing = startsWith(context.source, '/>');
        // 《继续》对模板进行解析处理，是自动标签则处理两个字符 /> ，不是则处理一个字符 >
        advanceBy(context, isSelfClosing ? 2 : 1);
        console.log(context);
        // 标签类型
        var tagType = 0 /* ElementTypes.ELEMENT */;
        return {
            type: 1 /* NodeTypes.ELEMENT */,
            tag: tag,
            tagType: tagType,
            // 属性，目前我们没有做任何处理。但是需要添加上，否则，生成的 ats 放到 vue 源码中会抛出错误
            props: []
        };
    }
    /**
     * 解析文本。
     */
    function parseText(context) {
        /**
         * 定义普通文本结束的标记
         * 例如：hello world </div>，那么文本结束的标记就为 <
         * PS：这也意味着如果你渲染了一个 <div> hell<o </div> 的标签，那么你将得到一个错误
         */
        var endTokens = ['<', '{{'];
        // 计算普通文本结束的位置, 默认将整个模板剩余内容都作为文本内容
        var endIndex = context.source.length;
        // 计算精准的 endIndex，计算的逻辑为：从 context.source 中分别获取 '<', '{{' 的下标，取最小值为 endIndex
        for (var i = 0; i < endTokens.length; i++) {
            // 寻找字符 < 与定界符{{ 的索引位置
            var index = context.source.indexOf(endTokens[i], 1);
            // 取 index 和当前 endIndex 中较小的一个作为新的结尾索引
            if (index !== -1 && endIndex > index) {
                endIndex = index;
            }
        }
        // 获取处理的文本内容
        var content = parseTextData(context, endIndex);
        return {
            type: 2 /* NodeTypes.TEXT */,
            content: content
        };
    }
    /**
     * 从指定位置（length）获取给定长度的文本数据。
     */
    function parseTextData(context, length) {
        console.log("parseTextData context", context);
        // 获取指定的文本数据
        var rawText = context.source.slice(0, length);
        // 《继续》对模板进行解析处理
        advanceBy(context, length);
        // 返回获取到的文本
        return rawText;
    }
    /**
     * nodes.push(node)
     */
    function pushNode(nodes, node) {
        nodes.push(node);
    }
    /**
     * 判断是否为结束节点
     *  ancestors 参数模拟栈结构，存储解析过程中的父级节点
     */
    /**
     * 当父级节点栈中存在与当前解析到的结束标签同名的节点时，isEnd 函会返回true。即意味着此时停止状态机，也就是退出while循环，结束对节点的解析。
     * 为什么？因为前面提过，编译器在解析 HTML 文档时，使用状态机的方式进行解析。
     * 状态机会根据当前的状态和输入的字符，决定下一步要执行的操作。
     * 在解析结束标签时，状态机需要判断当前结束标签的名称是否与父级节点栈中存在的节点名称相同。
     * 如果相同，则说明当前结束标签与某个父级节点对应，需要结束对该节点的解析。
     * @param context
     * @param ancestors
     * @returns
     */
    function isEnd(context, ancestors) {
        var s = context.source;
        // 解析是否为结束标签
        // 父级节点栈中存在与当前解析到的结束标签同名的节点，就停止状态机，即返回true，退出 while 循环
        if (startsWith(s, '</')) {
            // 从后向前循环
            for (var i = ancestors.length - 1; i >= 0; --i) {
                // 判断当前内容是否为结束标签的开始
                if (startsWithEndTagOpen(s, ancestors[i].tag)) {
                    return true;
                }
            }
        }
        return !s;
    }
    /**
     * 是否以指定文本开头
     */
    function startsWith(source, searchString) {
        return source.startsWith(searchString);
    }
    /**
     * 判断当前是否为《标签结束的开始》。比如 </div> 就是 div 标签结束的开始
     * @param source 模板。例如：</div>
     * @param tag 标签。例如：div
     * @returns
     */
    function startsWithEndTagOpen(source, tag) {
        return (startsWith(source, '</') &&
            source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
            /[\t\r\n\f />]/.test(source[2 + tag.length] || '>'));
    }
    /**
     * 解析标签的过程，其实就是一个自动状态机不断读取的过程，我们需要构建 advanceBy 方法，来标记进入下一步
     * 前进一步。多次调用，每次调用都会处理一部分的模板内容
     * 以 <div>hello world</div> 为例
     * 1. <div
     * 2. >
     * 3. hello world
     * 4. </div
     * 5. >
     *
     * 第二个参数表示右移几个字符
     */
    function advanceBy(context, numberOfCharacters) {
        // template 模板源
        var source = context.source;
        // 去除开始部分的无效数据
        context.source = source.slice(numberOfCharacters);
    }

    /**
     * 单个元素的根节点
     */
    function isSingleElementRoot(root, child) {
        var children = root.children;
        return children.length === 1 && child.type === 1 /* NodeTypes.ELEMENT */;
    }

    /**
     * 创建 transform 上下文
     */
    // 第二个参数我们只需要nodeTransforms，这里应该用了解构
    function createTransformContext(root, _a) {
        var _b = _a.nodeTransforms, nodeTransforms = _b === void 0 ? [] : _b;
        var context = {
            nodeTransforms: nodeTransforms,
            root: root,
            helpers: new Map(),
            currentNode: root,
            parent: null,
            childIndex: 0,
            helper: function (name) {
                var count = context.helpers.get(name) || 0;
                context.helpers.set(name, count + 1);
                return name;
            }
        };
        return context;
    }
    /**
     * 根据 AST 生成 JavaScript AST
     * @param root AST
     * @param options 配置对象
     */
    function transform(root, options) {
        // 创建 transform 上下
        var context = createTransformContext(root, options);
        traverseNode(root, context);
        createRootCodegen(root);
        root.helpers = __spreadArray([], __read(context.helpers.keys()), false);
        // 下面这些空数组源码里是有处理的，我们在此项目中不做处理了，如果申明这些数组的话可能会报错
        root.components = [];
        root.directives = [];
        root.imports = [];
        root.hoists = [];
        root.temps = [];
        root.cached = [];
    }
    /**
     * 遍历转化节点，转化的过程一定要是深度优先的（即：孙 -> 子 -> 父），因为当前节点的状态往往需要根据子节点的情况来确定。
     * 转化的过程分为两个阶段：
     * 1. 进入阶段：存储所有节点的转化函数到 exitFns 中
     * 2. 退出阶段：执行 exitFns 中缓存的转化函数，且一定是倒叙的。因为只有这样才能保证整个处理过程是深度优先的
     */
    function traverseNode(node, context) {
        // 通过上下文记录当前正在处理的 node 节点
        context.currentNode = node;
        // 获取当前所有 node 节点的 transform 方法
        var nodeTransforms = context.nodeTransforms;
        // 存储转化函数的数组
        var exitFns = [];
        // 循环获取节点的 transform 方法，缓存到 exitFns 中
        for (var i_1 = 0; i_1 < nodeTransforms.length; i_1++) {
            // nodeTransforms[i](node, context)执行好后返回里面的闭包函数
            var onExit = nodeTransforms[i_1](node, context);
            if (onExit) {
                exitFns.push(onExit);
            }
        }
        // 我们所有的节点都有对应的子节点，我们不可能只处理父节点，不去处理子节点
        // 继续转化子节点
        switch (node.type) {
            case 1 /* NodeTypes.ELEMENT */:
            case 0 /* NodeTypes.ROOT */:
                traverseChildren(node, context);
                break;
        }
        // ---------------- 进入阶段完成 ----------------
        // ---------------- 退出阶段开始 ----------------
        // 在退出时执行 transform
        context.currentNode = node;
        var i = exitFns.length;
        while (i--) {
            // 依次执行我们存储的转化函数(倒序，因为只有这样才能保证整个处理过程是深度优先的)
            exitFns[i]();
        }
    }
    /**
     * 循环处理子节点
     */
    function traverseChildren(parent, context) {
        // 循环依次处理子节点
        parent.children.forEach(function (node, index) {
            context.parent = parent;
            context.childIndex = index;
            traverseNode(node, context);
        });
    }
    /**
     * 生成 root 节点下的 codegen
     */
    function createRootCodegen(root) {
        var children = root.children;
        // Vue2仅支持单个根节点，Vue3支持多个根节点
        // 仅支持一个根节点的处理
        if (children.length === 1) {
            // 获取单个根节点
            var child = children[0];
            if (isSingleElementRoot(root, child) && child.codegenNode) {
                var codegenNode = child.codegenNode;
                root.codegenNode = codegenNode;
            }
        }
    }

    var _a;
    var CREATE_ELEMENT_VNODE = Symbol('createElementVNode');
    // createVNode在vnode.ts中，用于生成一个 VNode 对象，并返回
    var CREATE_VNODE = Symbol('createVNode');
    /**
     * const {xxx} = Vue
     * 即：从 Vue 中可以被导出的方法，我们这里统一使用  createVNode
     */
    (_a = {},
        // 让每一个Symbol对应一个函数
        _a[CREATE_ELEMENT_VNODE] = 'createElementVNode',
        _a[CREATE_VNODE] = 'createVNode',
        _a);

    function createVNodeCall(context, tag, props, children) {
        if (context) {
            // helper在transform.ts中的createTransformContext函数里往helpers里放置对应的Symbol
            // helpers的key是我们最终生成render的一个执行函数，所以我们这里helper传入的参数就是生成render函数的执行函数
            // 源码里这些执行函数特别多，我们这里只考虑CREATE_ELEMENT_VNODE，CREATE_VNODE
            context.helper(CREATE_ELEMENT_VNODE);
        }
        // return出codegenNode的属性
        return {
            type: 13 /* NodeTypes.VNODE_CALL */,
            tag: tag,
            props: props,
            children: children
        };
    }

    /**
     * 对 element 节点的转化方法
     */
    var transformElement = function (node, context) {
        // 闭包函数
        return function postTransformElement() {
            node = context.currentNode;
            // 仅处理 ELEMENT 类型
            if (node.type !== 1 /* NodeTypes.ELEMENT */) {
                return;
            }
            var tag = node.tag;
            var vnodeTag = "\"".concat(tag, "\"");
            var vnodeProps = [];
            var vnodeChildren = node.children;
            // transform里面的核心就是给node节点增加了codegenNode属性
            node.codegenNode = createVNodeCall(context, vnodeTag, vnodeProps, vnodeChildren);
        };
    };

    function isText(node) {
        return node.type === 5 /* NodeTypes.INTERPOLATION */ || node.type === 2 /* NodeTypes.TEXT */;
    }

    /**
     * 将相邻的文本节点和表达式合并为一个表达式。
     *
     * 例如:
     * <div>hello {{ msg }}</div>
     * 上述模板包含两个节点：
     * 1. hello：TEXT 文本节点
     * 2. {{ msg }}：INTERPOLATION 表达式节点
     * 这两个节点在生成 render 函数时，需要被合并： 'hello' + _toDisplayString(_ctx.msg)
     * 那么在合并时就要多出来这个 + 加号。
     * 例如：
     * children:[
     * 	{ TEXT 文本节点 },
     *  " + ",
     *  { INTERPOLATION 表达式节点 }
     * ]
     */
    var transformText = function (node, context) {
        if (node.type === 0 /* NodeTypes.ROOT */ ||
            node.type === 1 /* NodeTypes.ELEMENT */ ||
            node.type === 11 /* NodeTypes.FOR */ ||
            node.type === 10 /* NodeTypes.IF_BRANCH */) {
            return function () {
                // 先拿到所有的children
                var children = node.children;
                // 当前容器
                var currentContainer;
                // 循环处理所有的子节点
                for (var i = 0; i < children.length; i++) {
                    var child = children[i];
                    if (isText(child)) {
                        // j = i + 1 表示下一个节点，j是i后面的第一个节点，也就是说j是i的下一个节点
                        for (var j = i + 1; j < children.length; j++) {
                            var next = children[j];
                            // 当前节点 child 和 下一个节点 next 都是 Text 节点
                            if (isText(next)) {
                                if (!currentContainer) {
                                    // 生成一个复合表达式节点, createCompoundExpression第一个参数[child]就是children
                                    currentContainer = children[i] = createCompoundExpression([child], child.loc);
                                }
                                //合并, 在 当前节点 child 和 下一个节点 next 中间，插入 "+" 号，child是一个数组，也就是说children这个属性是一个数组
                                currentContainer.children.push(' + ', next);
                                // 删掉下一个子节点，因为已经处理好了
                                children.splice(j, 1);
                                j--;
                            }
                            else {
                                // 如果当前节点是text，下一个节点不是text，就不需要合并，把 currentContainer 置空即可
                                currentContainer = undefined;
                                break;
                            }
                        }
                    }
                }
            };
        }
    };
    function createCompoundExpression(children, loc) {
        return {
            type: 8 /* NodeTypes.COMPOUND_EXPRESSION */,
            loc: loc,
            children: children
        };
    }

    function baseCompile(template, options) {
        if (options === void 0) { options = {}; }
        var ast = baseParse(template);
        transform(ast, extend(options, {
            nodeTransforms: [transformElement, transformText]
        }));
        console.log(ast);
        console.log(JSON.stringify(ast));
        return {};
    }

    function compile(template, options) {
        return baseCompile(template, options);
    }

    exports.Comment = Comment$1;
    exports.Fragment = Fragment;
    exports.Text = Text$1;
    exports.compile = compile;
    exports.computed = computed;
    exports.effect = effect;
    exports.h = h;
    exports.queuePreFlushCb = queuePreFlushCb;
    exports.reactive = reactive;
    exports.ref = ref;
    exports.render = render;
    exports.watch = watch;

    Object.defineProperty(exports, '__esModule', { value: true });

    return exports;

})({});
//# sourceMappingURL=vue.js.map

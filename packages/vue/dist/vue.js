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
            shapeFlag: shapeFlag
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
        }
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

    function patchStyle(el, prev, next) {
        var style = el.style;
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
    function setStyle(style, name, val) {
        style[name] = val;
    }

    var patchProp = function (el, key, prevValue, nextValue) {
        // 根据不同的prop做不同的处理
        if (key === 'class') {
            patchClass(el, nextValue);
        }
        else if (key === 'style') {
            patchStyle(el, prevValue, nextValue);
        }
        else if (isOn(key)) ;
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
        var hostInsert = options.insert, hostPatchProp = options.patchProp, hostCreateElement = options.createElement, hostSetElementText = options.setElementText, hostRemove = options.remove;
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
            patchChildren(oldVNode, newVNode, el);
            patchProps(el, newVNode, oldProps, newProps);
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
                if (prevShapeFlag & 16 /* ShapeFlags.ARRAY_CHILDREN */) ;
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
                    break;
                case Comment:
                    break;
                case Fragment:
                    break;
                default:
                    // 如果按位进行与运算能匹配到ELEMENT
                    // debug时传入的shapeFlag为9，二进制为00000000 00000000 00000000 00001001
                    // 同时ShapeFlags.ELEMENT = 1, 二进制为00000000 00000000 00000000 00000001，
                    // 进行与运算就是00000000 00000000 00000000 00000001，十进制就是1，那么if(1)就判定为true
                    if (shapeFlag & 1 /* ShapeFlags.ELEMENT */) {
                        processElement(oldVNode, newVNode, container, anchor);
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
            container._vnode = vnode;
        };
        return {
            render: render
        };
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

    exports.Comment = Comment$1;
    exports.Fragment = Fragment;
    exports.Text = Text$1;
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

// Underscore.js
// (c) 2010 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is freely distributable under the terms of the MIT license.
// Portions of Underscore are inspired by or borrowed from Prototype.js,
// Oliver Steele's Functional, and John Resig's Micro-Templating.
// For all details and documentation:
// http://documentcloud.github.com/underscore

/**
 * underscore主要功能在于：
 * 1. 提供一些常用的 Array、Object、function 方法的 polyfill，使各个浏览器下都能安全工作、保持一致
 * 2. 提供常用的数据处理的工具类方法
 * 
 * 设计思路上主要有这些特点：
 * 1. 统一的传参和调用方式
 * 2. 尽量处理成能想到的合乎情理的情况
 * 3. 主要用到的方式是迭代
 * 4. 初始的时候，是暴露对象，然后把方法挂在在对象上实现的
 * 5. 为了实现链式调用和 oop，做了这样的处理：
 *   a. _ 赋值成一个函数，函数返回一个构造函数的新实例
 *   b. 本身所有的定义的方法被赋值在构造函数的原型上
 *   c. 参数的组织形式通过一个函数重新组织过，这样就可以 oop 和 非 oop 都能合理的传递参数（这个地方巧妙的运用了 apply fuc 相关的技巧，处理的很简单）
 * 6. 无，总的还是非常不错的，oop 这个是挺值得学习和思考的设计过程
 */


(function() {
  // ------------------------- Baseline setup ---------------------------------

  // Establish the root object, "window" in the browser, or "global" on the server.
  // 考虑多环境的情况，这里用this来指代 global
  var root = this;

  // Save the previous value of the "_" variable.
  // 把全局上之前被声明的 _ 符号赋值出来，下文有个 noConflict 方法会来处理这种冲突
  var previousUnderscore = root._;

  // Establish the object that gets thrown to break out of a loop iteration.
  /** 
   * 这个初始化的值是：'__break__'
   * 下文有个 breakLoop 方法，他就是简单的一句话 throw breaker => 就是 throw ('__break__')
   * 这样在 each 里会 catch 到这个 throw 
   * 然后看内容 是否是 字符串 '__break__'来决定是退出什么都不做，还是抛出错误
   * 这里我很疑惑，breaker 初始化的时候不直接赋值成字符串 '__break__'，还要用StopIteration判断一下
   * 后来发现，这个是一个过时标签，用来做一些打断的事情，曾经在 firefox 57版本中支持过，然后所有浏览器都不支持了
   * https://developer.mozilla.org/en-US/docs/Archive/Web/StopIteration
   */ 
  var breaker = typeof StopIteration !== 'undefined' ? StopIteration : '__break__';

  // Quick regexp-escaping function, because JS doesn't have RegExp.escape().
  /**
   * 这里是说，一个普通的字符串里的一些特殊的符号要加上 \ ，这样可以被正则更好的处理
   * underscore中没有暴露这个方法，这个方法是在 下文的 template 方法中被使用过
   * 不必在过关注这个，感觉用处也不大
   */
  var escapeRegExp = function(s) { return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1'); };

  // Save bytes in the minified (but not gzipped) version:
  // 直接把全局变量存成本地变量，这么做访问速度可能快一点，上下文也更加工整
  var ArrayProto = Array.prototype, ObjProto = Object.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var slice                 = ArrayProto.slice,
      unshift               = ArrayProto.unshift,
      toString              = ObjProto.toString,
      hasOwnProperty        = ObjProto.hasOwnProperty,
      propertyIsEnumerable  = ObjProto.propertyIsEnumerable;

  // All ECMA5 native implementations we hope to use are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys;

  // Create a safe reference to the Underscore object for use below.
  // 返回一个方法，主要是为了实现 oop style 的书写格式。下文会详细表述
  var _ = function(obj) { return new wrapper(obj); };

  // Export the Underscore object for CommonJS.
  // CommonJs环境会暴露 exports 变量，按照约定格式输出成 CommonJs 模块
  if (typeof exports !== 'undefined') exports._ = _;

  // Export underscore to global scope.
  // 全局环境也注册一份，这里是注册成上文中的 func 对象
  root._ = _;

  // Current version.
  // 版本号
  _.VERSION = '1.0.0';

  // ------------------------ Collection Functions: ---------------------------

  // The cornerstone, an each implementation.
  // Handles objects implementing forEach, arrays, and raw objects.
  // Delegates to JavaScript 1.6's native forEach if available.
  /**
   * 核心方法
   * 迭代 object 和 array，然后做 iterator 函数规定做的事情，可以指定上下文对象
   */
  var each = _.forEach = function(obj, iterator, context) {
    try {
      /**
       * 要迭代对象有forEach，而且forEach和原型上的是一样的，就用对象自己的
       * 下文有很多类似的处理，不多赘述
       */
      if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
      } else if (_.isNumber(obj.length)) { // 这里用 length 是 number 来判断是数组
        /**
         * 是数组而且没有原生forEach方法就迭代进去
         * 然后运用迭代器方法和传入的上下文对象
         * 这里在迭代器里传入的形参都是模仿原生的效果，下文不赘述了
         */
        for (var i = 0, l = obj.length; i < l; i++) iterator.call(context, obj[i], i, obj);
      } else {
        /**
         * 其他情况(对象)，就迭代进去
         * 并且做和 数组 的 forEach 类似的用法
         * 这里一个细节是， for in 迭代对于处理是非常柔和的，只迭代可枚举对象。
         * 所以就算给到的是 function、'string'，也不会报错。只要没人为添加属性（做这种奇怪的事），就默认不迭代
         */ 
        for (var key in obj) {
           /**
            * 这里有个细节，for in 是迭代可枚举的，这里做的处理是，即是可枚举的自身属性去迭代
            * 整个underscore 都是这个思路：可枚举的自身属性
            */ 
          if (hasOwnProperty.call(obj, key)) iterator.call(context, obj[key], key, obj);
        }
      }
    } catch(e) {
      /**
       * 这里是通用的打断退出逻辑，如果抛出的错误不是 '__break__'字符串，就直接抛出错误
       * 否则进了 catch 迭代就不再继续了
       */ 
      if (e != breaker) throw e;
    }
    return obj; // 返回传入对象（当然如果引用被修改了这个返回值也是会改变的，不多赘述）
  };

  // Return the results of applying the iterator to each element.
  // Delegates to JavaScript 1.6's native map if available.
  _.map = function(obj, iterator, context) {
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    var results = [];
    // 这里用了上文申明的本地变量each，效率更好一点
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  // Reduce builds up a single result from a list of values, aka inject, or foldl.
  // Delegates to JavaScript 1.8's native reduce if available.
  /**
   * 备忘一下 原生reduce
   * [1, 2, 3].reduce()
   * arr.reduce((memo, item, index, list) => {
   *   alert(item);
   * }, 'i am memo'); // 传了memo的情况下回迭代3次，不传就是2次
   */
  // 这里关注一下传参形式，memo是必传的，所以这个函数的迭代次数肯定是符合预期的
  _.reduce = function(obj, memo, iterator, context) {
    // 注意，原生的 reduce 没有提供指定上下文的功能，这里通过bind提供了这个功能
    if (nativeReduce && obj.reduce === nativeReduce) return obj.reduce(_.bind(iterator, context), memo);
    each(obj, function(value, index, list) {
      memo = iterator.call(context, memo, value, index, list);
    });
    return memo;
  };

  // The right-associative version of reduce, also known as foldr. Uses
  // Delegates to JavaScript 1.8's native reduceRight if available.
  _.reduceRight = function(obj, memo, iterator, context) {
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) return obj.reduceRight(_.bind(iterator, context), memo);
    var reversed = _.clone(_.toArray(obj)).reverse();
    return _.reduce(reversed, memo, iterator, context);
  };

  // Return the first value which passes a truth test.
  // 相当于数组里的find，找到第一个迭代器返回 true 时候的 item
  _.detect = function(obj, iterator, context) {
    var result;
    // 为什么没有用 arr 的 find 来拦一下，可能是这个写法效率比 find 更好。
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        _.breakLoop();
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to JavaScript 1.6's native filter if available.
  // 类似于数组的 filter，这个用原生的 filter 拦了一下
  _.filter = function(obj, iterator, context) {
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    var results = [];
    each(obj, function(value, index, list) {
      iterator.call(context, value, index, list) && results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  // filter 取反，找到所有迭代器结果为假的集合，这个方法有必要嘛。理论上在 filter 里取反就可以了
  _.reject = function(obj, iterator, context) {
    var results = [];
    each(obj, function(value, index, list) {
      !iterator.call(context, value, index, list) && results.push(value);
    });
    return results;
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to JavaScript 1.6's native every if available.
  // 是否到迭代器检验都返回 true
  _.every = function(obj, iterator, context) {
    iterator = iterator || _.identity;
    // 有原生every就使用原生的，这里暗含是数组的情况了，原生的 every 是 array 的方法
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    var result = true;
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) _.breakLoop();
    });
    return result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to JavaScript 1.6's native some if available.
  // 是否有至少一项匹配迭代器的返回结果
  _.some = function(obj, iterator, context) {
    iterator = iterator || _.identity;
    // 同 every ，用原生 some，原生 some 用的也挺少的
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    var result = false;
    each(obj, function(value, index, list) {
      if (result = iterator.call(context, value, index, list)) _.breakLoop();
    });
    return result;
  };

  // Determine if a given value is included in the array or object using '==='.
  // 用 === 检测传入的参数是否在目标参数里
  _.include = function(obj, target) {
    // 用数组的 indexOf 拦一下
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    var found = false;
    each(obj, function(value) {
      if (found = value === target) _.breakLoop();
    });
    return found;
  };

  // Invoke a method with arguments on every item in a collection.
  /**
   * 对队列的每一项都调用第二个实参指定的方法（大部分情况下传的都是数组队列，去调用）
   * 返回由执行的返回值组成的数组
   * 多传的参数是调用的方法的实参
   */ 
  _.invoke = function(obj, method) {
    var args = _.rest(arguments, 2); // 拿多余的实参，这个 rest 是从某个下表开始取剩余数组的意思
    return _.map(obj, function(value) { // 直接用map返回一个array
      // 这个 value 是每个 要调用的值，apply指代this，同时用数组的方式调用实参
      return (method ? value[method] : value).apply(value, args);
    });
  };

  // Convenience version of a common use case of map: fetching a property.
  /**
   * 这个是对队列的具体的每一项上进行一个快速的取值，并且返回数组
   * var stooges = [{name: 'moe', age: 40}, {name: 'larry', age: 50}, {name: 'curly', age: 60}];
   * _.pluck(stooges, 'name'); => ["moe", "larry", "curly"]
   */ 
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; }); // 就是这么直接迭代器然后map返回传入的key对应的值
  };

  // Return the maximum item or (item-based computation).
  /** 
   * 比较队列中的最大值，默认使用js多态的比较方法
   * 如果传了迭代器，就会用迭代器对每一项操作后的返回结果进行比值
   * 最终，这个函数是返回列表中最大的那一项（由于使用了默认多态的比较，一定会有一个最大值来兜底）
   */
  _.max = function(obj, iterator, context) {
    /**
     * 如果没迭代器，而且队列是一个数组，则直接用 Math 的 max 方法，
     * 这里用 apply 是因为原来的 max 只能传参形式带入进行比较
     */
    if (!iterator && _.isArray(obj)) return Math.max.apply(Math, obj);
    var result = {computed : -Infinity}; // 声明一个比值对象，computed的初始值是负无穷
    each(obj, function(value, index, list) { 
      // 有迭代器则赋值迭代器的返回结果，反则就是现在的对象
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      /**
       * 这个值和比值对象的computed比较，大于的话就重新赋值比值对象
       * 这里弄了一个value和一个computed的原因是：
       * 其实computed值关心比较的事情，比较有可能是要通过传入的迭代器进行的
       * 而value是关心最终返回值的问题，返回值是列表里的项，和用来比较的值是不一样的
       * 造成computed和value差别的核心原因就是，这个函数有使用迭代器来重新定义比较方式的设计
       */  
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value; // 最终返回的是列表里的项目
  };

  // Return the minimum element (or element-based computation).
  // 同 max
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.min.apply(Math, obj);
    var result = {computed : Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Sort the object's values by a criterion produced by an iterator.
  // 对队列中的每一项，使用迭代器规定的方法执行过后，进行一个排序（所以，迭代器是必传的）
  _.sortBy = function(obj, iterator, context) {
    // 最终是把 map 把 队列的值，和经过迭代器处理过的值存成数组，然后 pluck 出来 value
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        criteria : iterator.call(context, value, index, list)
      };
    })
    
    // 数组 map 完之后，直接 sort 一把，返回用 criteria 这个迭代器返回值排序的数组
    .sort(function(left, right) {
      /**
       * 原生 sort 是一种迭代
       * 不传参数的时候就是按照，升序排序:
       * [2, 5, 1].sort() => [1, 2, 5]
       * ['a', 'x', 'b'].sort() => ["a", "b", "x"]
       * 
       * 当使用一个函数的时候，回去迭代，传入两边两个待比较的值 left right
       * [1, 2, 3].sort((left, right) => {console.log(left, right)})
       * => 会迭代两次，1 2; 2 3
       * 
       * 这个具体的比较过程描述起来略显复杂
       * 总之迭代器返回值 大于0 ，则说明左边的大
       * 迭代器返回值 不大于0，则说明右边的大
       * [1, 2, 3].sort(() => 0.1 ); => [3, 2, 1]
       */
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value'); // 最终 pluck 出来的是 value 组成的数组，这个数组是通过迭代器返回结果排序过的
  };

  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  /**
   * 新插入的值和所有的队列经过迭代器处理后，新插入的这个值会在队列的什么位置
   * 所以，迭代器不一定是必须的
   * 这个方法不常用
   */ 
  _.sortedIndex = function(array, obj, iterator) {
    iterator = iterator || _.identity;
    var low = 0, high = array.length;
    while (low < high) {
      /**
       * >> 1 意思是除以2，之后向下取整数
       * 另一个位操作符相关的: >> 0。单纯的向下取整数，和parseInt一样
       */ 
      var mid = (low + high) >> 1; 
      iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Convert anything iterable into a real, live array.
  _.toArray = function(iterable) {
    if (!iterable)                return []; // 传的多态假值，返回空数组
    if (iterable.toArray)         return iterable.toArray(); // 这句话有点多余，后面版本去除了
    if (_.isArray(iterable))      return iterable; // 是数组，直接返回

     /**
      *  是参数对象，返回处理过的结果，什么情况下会这样？应该很少有这种情况，这句话个人觉得也多余
      *  后面版本这个也去掉了
      */
    if (_.isArguments(iterable))  return slice.call(iterable);
    // 不然就直接拿 values 组成的数组
    return _.values(iterable);
  };

  // Return the number of elements in an object.
  // 一维上，队列的长度（对象可枚举的自身属性的key的个数，或者数组的length）
  _.size = function(obj) {
    return _.toArray(obj).length;
  };

  // -------------------------- Array Functions: ------------------------------
  // 注意以下开始的都是数组方法
  // Get the first element of an array. Passing "n" will return the first N
  // values in the array. Aliased as "head". The "guard" check allows it to work
  // with _.map.
  /**
   * 拿起始位置到结束为止的个数，slice的简化版，其实如果slice熟悉的话，这个也没多大用
   * 熟悉以下 slice:
   * 当只有一个参数的时候，返回的是从起始位置去掉几个的数组：[1, 2, 3, 4, 5].slice(2) => [3, 4, 5]
   * 当有多个参数的时候，返回的是从坐标位置到坐标为止的数组：[1, 2, 3, 4, 5].slice(1, 2) => [2]
   * 负数不接受，是无效的
   */ 
  _.first = function(array, n, guard) {
    return n && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the first entry of the array. Aliased as "tail".
  // Especially useful on the arguments object. Passing an "index" will return
  // the rest of the values in the array from that index onward. The "guard"
   //check allows it to work with _.map.
   // 同上，默认会返回去除第一项之后的剩余
  _.rest = function(array, index, guard) {
    return slice.call(array, _.isUndefined(index) || guard ? 1 : index);
  };

  // Get the last element of an array.
  // 同上
  _.last = function(array) {
    return array[array.length - 1];
  };

  // Trim out all falsy values from an array.
  // 去掉一维上的假值，返回新数组
  _.compact = function(array) {
    return _.filter(array, function(value){ return !!value; });
  };

  // Return a completely flattened version of an array.
  // 将数组里的所有项目的数组字段，递归展开到一维
  _.flatten = function(array) {
    return _.reduce(array, [], function(memo, value) {
      // 是数组的时候才会往下递归
      if (_.isArray(value)) return memo.concat(_.flatten(value)); // 这个地方递归，最终会全都迭代出来
      memo.push(value);
      return memo;
    });
  };

  // Return a version of the array that does not contain the specified value(s).
  /**
   * 在数组中排除传入的参数，返回新数组 _.without([1, 2, 1, 0, 3, 1, 4], 0, 1) => [2, 3, 4]
   * 这个是基于 全等于 === 的，所以 _.without([{}, {}], {}) => [{}, {}]
   */ 
  _.without = function(array) {
    var values = _.rest(arguments);
    // 这里用 include 是全等的判断
    return _.filter(array, function(value){ return !_.include(values, value); });
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  /** 
   * 数组去重，基于 === 的去重
   * 如果传入第二个形参告知传入的数组已经排序过，则用更快的比较方法，性能更好
   * 
   * es6有新的去重方式：
   * var arr = [1, 2, { a: 1 }, { a: 1 }];
   * var resultarr = [...new Set(arr)]; =>  [1, 2, { a :1 }, { a: 1 }] 真实有效，对引用类型也管用
   */
  _.uniq = function(array, isSorted) {
    return _.reduce(array, [], function(memo, el, i) {
      /**
       * 如果排序过，直接顺序比值，如果有不同则推入结果，这里的!=，后面版本有修正，不然就不是基于 === 的比较了
       * 如果没排序过，则用 memo 做缓存，然后在用 include 来，判断是否在 memo 里，不再则拓展memo，最终返回 memo
       */
      if (0 == i || (isSorted === true ? _.last(memo) != el : !_.include(memo, el))) memo.push(el);
      return memo;
    });
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  // 取传入多个数组的交集，基于 ===
  _.intersect = function(array) {
    var rest = _.rest(arguments);
    /**
     * 1. 先对第一项自身去重
     * 2. 然后使用第一项，在后面的条件里过滤（filter）。
     * 3. 过滤的条件是，是否无这一项都能在后面的数组里找到
     */
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  /**
   * 传入多个数组，按照位置在一维上一一对应，组成新数组
   * _.zip([1, 2, 3], [2, 3, 3, 6], [8, 8]) => [[1, 2, 8], [2 ,3 ,8], [3, 3, undef], [undef, 6, undef]]
   */ 
  _.zip = function() {
    var args = _.toArray(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) results[i] = _.pluck(args, String(i));
    return results;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, MSIE),
  // we need this function. Return the position of the first occurence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to JavaScript 1.8's native indexOf if available.
  // 原生 indexOf 的 polyfill
  _.indexOf = function(array, item) {
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item);
    for (var i = 0, l = array.length; i < l; i++) if (array[i] === item) return i;
    return -1;
  };


  // Delegates to JavaScript 1.6's native lastIndexOf if available.
  // 原生 lastIndexOf 的 polyfill
  _.lastIndexOf = function(array, item) {
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) return array.lastIndexOf(item);
    var i = array.length;
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python range() function. See:
  // http://docs.python.org/library/functions.html#range
  /**
   * 这个是 python 的 range 版本
   * _.range(10); // => [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
   * _.range(1, 11); // => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
   * _.range(0, 30, 5); // => [0, 5, 10, 15, 20, 25]
   */
  _.range = function(start, stop, step) {
    var a     = _.toArray(arguments);
    var solo  = a.length <= 1;// 没给参数或者只给了一个参数 => true ,否则 => false
    /**
     * 如果给了一个参数或者没给的话，这个 start 是 0，不然就是给的那个给定的参数的第一个作为起点
     * 停止针对只有一个参数或者没有参数的情况，他会被尝试赋值成 arguments[0]，也就是说没传参数是 undef，有停止参数就是停止参数
     * 步伐幅度是step参数或者不给就是1
     */
    var start = solo ? 0 : a[0], stop = solo ? a[0] : a[1], step = a[2] || 1;
    /**
     * 向上取整，这里如果 stop 是 undef，这个len会是NaN，一下行会【报错】
     * 这个主要原因是上文用 length 来决定 solo ，从而决定 start、stop、step 三个参数
     * 那我填 undef ，或者其他不合理的值，都会对他造成影响: _.range(2, 'null'); => 报错
     */
    var len   = Math.ceil((stop - start) / step);
    if (len <= 0) return [];
    var range = new Array(len);
    for (var i = start, idx = 0; true; i += step) {  // 下来就是填充的工作了
      if ((step > 0 ? i - stop : stop - i) >= 0) return range;
      range[idx++] = i;
    }
  };

  // ----------------------- Function Functions: ------------------------------

  // Create a function bound to a given object (assigning 'this', and arguments,
  // optionally). Binding with arguments is also known as 'curry'.
  /**
   * 原生 bind 的 polyfill，返回一个闭包函数
   * curry化函数，它只会去给传入的纯函数创造不同上下文，作为一个副本（返回的是一个匿名函数封包，不会影响原函数）
   */ 
  _.bind = function(func, obj) {
    var args = _.rest(arguments, 2); 
    // 这个变量环境会被保存下来以便访问，不会销毁
    return function() {
      /**
       * 这里 apply 本来是 第一个参数是 (obj || window)
       * 现在改成了这个 {}，可能是为了防止主动去找到一些 window 上的同名方法
       */
      return func.apply(obj || {}, args.concat(_.toArray(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  // 为多个方法 bind 相同的上下文，批量操作
  _.bindAll = function(obj) {
    var funcs = _.rest(arguments);
    if (funcs.length == 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  // 快速setTimeout
  _.delay = function(func, wait) {
    var args = _.rest(arguments, 2);
    return setTimeout(function(){ return func.apply(func, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  // 链式调用了，可能有点看不懂，本质是延时1毫秒执行
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(_.rest(arguments)));
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  /**
   * wrap会返回一个函数，这个函数是一个闭包函数
   * 这个会导致wrap函数不会销毁一直存在，原因是返回的函数会引用原来函数的 arguments 对象
   * 这个函数的功能主要是返回函数，这个函数是原函数的参数很返回值的重新运用
   * 这个和 currying 化还不太一样，currying是返回一个函数的各种不同参数的副本以供调用
   * 这个函数是用原函数的处理逻辑和返回值重新组织逻辑代码
   * 这个函数，我认为作用可能不大。但是也有运用的场景
   */
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func].concat(_.toArray(arguments));
      return wrapper.apply(wrapper, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  /** 
   * 这个方法接受一堆函数，返回一个闭包函数
   * 返回的函数可以接受任意参数，这些参数会作为传入方法中左右边的第一个方法的实参
   * 然后从右往左运行函数
   * 除了最右边的那个函数外能接受调用时候的参数作为对应的多个参数外，之后运行的函数值接受一个参数
   * 这个参数就是前面那个函数的返回值
   * 可以类比一下 promise 里 then 的效果
   */
  _.compose = function() {
    var funcs = _.toArray(arguments);
    return function() {
      var args = _.toArray(arguments);
      // 这里是一个迭代，从大到小的迭代
      for (var i=funcs.length-1; i >= 0; i--) {
        // 迭代运行中，后面的方法只接受一个参数了，这个参数就是前一个函数的返回值
        args = [funcs[i].apply(this, args)];
      }
       /**
        * 最终如果运行闭包函数的话，他会返回一个值，这里之所以还要用[0]取一下的原因是
        * 那个地方为了让迭代的 apply 能运行，返回了一个 [funcs[i].apply(this, args)] 
        * 所以要取一下值
        */
      return args[0];
    };
  };

  // ------------------------- Object Functions: ------------------------------

  // Retrieve the names of an object's properties.
  // Delegates to ECMA5's native Object.keys
  // key 的 polyfill
  _.keys = nativeKeys || function(obj) {
    if (_.isArray(obj)) return _.range(0, obj.length);
    var keys = [];
    for (var key in obj) if (hasOwnProperty.call(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  // 直接去对象 value 组成的数组
  _.values = function(obj) {
    return _.map(obj, _.identity);
  };

  // Return a sorted list of the function names available on the object.
  // 返回一个第一维下，所有类型是 function 的 key 组成的数组
  _.functions = function(obj) {
    return _.filter(_.keys(obj), function(key){ return _.isFunction(obj[key]); }).sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  /**
   * 把源对象的可枚举属性，扔到目标对象上(浅拷贝)
   * 这个是会改原对象的，和这个用法的效果是一样的：Object.assign(sourceObj, { yourAttr: yourValue });
   */
  _.extend = function(obj) {
    each(_.rest(arguments), function(source) {
      for (var prop in source) obj[prop] = source[prop];
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  /**
   * 浅拷贝，这个就是这个用法，创建新对象副本：Object.assign({},obj)
   * underscore一直没有提供深拷贝方法，作者认为做不完美，所以不做
   */
  _.clone = function(obj) {
    if (_.isArray(obj)) return obj.slice(0);
    return _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in order to perform operations on intermediate results within the chain.
  // 这个主要用于链式调用（chain）的时候，执行传入方法，同时不打断链式调用。
  _.tap = function(obj, interceptor) {
    interceptor(obj); // 这个是另外要执行的函数，这里可以对 obj 进行处理来修改引用
    return obj; // 返回的是obj，如果是在一个 chain 里的话会被处理成 { _wrapper: obj, _chain: true }
  };

  // Perform a deep comparison to check if two objects are equal.
  // 尝试用最合理的方式来比较对个传入的值是否相等
  _.isEqual = function(a, b) {
    // Check object identity.
    if (a === b) return true; // 全等则全等
    // Different types?
    var atype = typeof(a), btype = typeof(b);
    if (atype != btype) return false; // 类型不同直接false
    // Basic equality test (watch out for coercions).
    /**
     * 多态 == 则相等，这个涉及到一些简单类型，对象和fnc这一条是不会通过的
     * 复杂数据（对象）的比较，归根到底会比较是否是相同的引用，所以这个不会通过
     */
    if (a == b) return true;
    // One is falsy and the other truthy.
    if ((!a && b) || (a && !b)) return false; // 取反，不是很理解
    // One of them implements an isEqual()?
    if (a.isEqual) return a.isEqual(b); // 有isEqual方法，直接比较？这个很傻这句话
    // Check dates' integer values.
    if (_.isDate(a) && _.isDate(b)) return a.getTime() === b.getTime(); // 都是日期类型直接看时间戳
    // Both are NaN?
    if (_.isNaN(a) && _.isNaN(b)) return true; // 都是 NaN，返回true
    // Compare regular expressions.
    if (_.isRegExp(a) && _.isRegExp(b)) // 正则，对正则对象的各个组成进行对比
      return a.source     === b.source &&
             a.global     === b.global &&
             a.ignoreCase === b.ignoreCase &&
             a.multiline  === b.multiline;
    // If a is not an object by this point, we can't handle it.
    if (atype !== 'object') return false; // 不是对象，就不能处理了，直接false
    // Check for different array lengths before comparing contents.
    // 有 length 但是 length 不同则不对
    if (a.length && (a.length !== b.length)) return false;
    // Nothing else worked, deep compare the contents.
    var aKeys = _.keys(a), bKeys = _.keys(b);
    // Different object sizes?
    // 可枚举的自身 key，不对则不对
    if (aKeys.length != bKeys.length) return false;
    // Recursive comparison of contents.
    // 然后递归，对value进行比较
    for (var key in a) if (!_.isEqual(a[key], b[key])) return false;
    return true; // 都通过则true
  };

  // Is a given array or object empty?
  // 检测数组或者array是空
  _.isEmpty = function(obj) {
    if (_.isArray(obj)) return obj.length === 0;
    // 一旦有，而且还是自身属性直接跳出
    for (var key in obj) if (hasOwnProperty.call(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  // 检测是 DOM element 节点
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType == 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  // 是否传入的对象是数组，居然有原生的 isArray 方法，注意下，是 Array原生函数上的方法
  _.isArray = nativeIsArray || function(obj) {
    // 用着两个方法是否存在来决定是否是数组
    return !!(obj && obj.concat && obj.unshift);
  };

  // Is a given variable an arguments object?
  // 判断是参数对象
  _.isArguments = function(obj) {
    // 有 length，同时很多方法都没有，同时 length 又是不可枚举的
    return obj && _.isNumber(obj.length) && !obj.concat && !obj.substr && !obj.apply && !propertyIsEnumerable.call(obj, 'length');
  };

  // Is a given value a function?
  // 是函数对象
  _.isFunction = function(obj) {
    // 由构造器对象，有 call 和 apply
    return !!(obj && obj.constructor && obj.call && obj.apply);
  };

  // Is a given value a string?
  _.isString = function(obj) {
    return !!(obj === '' || (obj && obj.charCodeAt && obj.substr));
  };

  // Is a given value a number?
  // 不是很明白什么情况下 用 toString 会不安全
  _.isNumber = function(obj) {
    return (obj === +obj) || (toString.call(obj) === '[object Number]');
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    // 高效
    return obj === true || obj === false;
  };

  // Is a given value a date?
  _.isDate = function(obj) {
    return !!(obj && obj.getTimezoneOffset && obj.setUTCFullYear);
  };

  // Is the given value a regular expression?
  _.isRegExp = function(obj) {
    return !!(obj && obj.test && obj.exec && (obj.ignoreCase || obj.ignoreCase === false));
  };

  // Is the given value NaN -- this one is interesting. NaN != NaN, and
  // isNaN(undefined) == true, so we make sure it's a number first.
  _.isNaN = function(obj) {
    return _.isNumber(obj) && isNaN(obj);
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return typeof obj == 'undefined';
  };

  // -------------------------- Utility Functions: ----------------------------

  // Run Underscore.js in noConflict mode, returning the '_' variable to its
  // previous owner. Returns a reference to the Underscore object.
  // 把原来的 _ 保护起来，同时让你有能力赋值新的命名空间
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  // 单纯返回原值
  _.identity = function(value) {
    return value;
  };

  // Run a function n times.
  // 多次调用迭代器
  _.times = function (n, iterator, context) {
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Break out of the middle of an iteration.
  // 通用打断方法
  _.breakLoop = function() {
    throw breaker;
  };

  // Add your own custom functions to the Underscore object, ensuring that
  // they're correctly added to the OOP wrapper as well.
  // 把对象混合到 _ 上
  _.mixin = function(obj) {
    // 这里只要传递对象就可以了，会把对象上的 fnc 直接拿出来混合
    each(_.functions(obj), function(name){
      addToWrapper(name, _[name] = obj[name]);
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  // 生成唯一 id，react、vue在 loop 的时候设置 key 的时候有用
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  // 不用管，模板相关的，没什么用
  _.templateSettings = {
    start       : '<%',
    end         : '%>',
    interpolate : /<%=(.+?)%>/g
  };

  // JavaScript templating a-la ERB, pilfered from John Resig's
  // "Secrets of the JavaScript Ninja", page 83.
  // Single-quote fix from Rick Strahl's version.
  // With alterations for arbitrary delimiters.
  // 不用管，模板相关的，没什么用
  _.template = function(str, data) {
    var c  = _.templateSettings;
    var endMatch = new RegExp("'(?=[^"+c.end.substr(0, 1)+"]*"+escapeRegExp(c.end)+")","g");
    var fn = new Function('obj',
      'var p=[],print=function(){p.push.apply(p,arguments);};' +
      'with(obj){p.push(\'' +
      str.replace(/[\r\t\n]/g, " ")
         .replace(endMatch,"\t")
         .split("'").join("\\'")
         .split("\t").join("'")
         .replace(c.interpolate, "',$1,'")
         .split(c.start).join("');")
         .split(c.end).join("p.push('")
         + "');}return p.join('');");
    return data ? fn(data) : fn;
  };

  // ------------------------------- Aliases ----------------------------------
  // 别名 
  _.each     = _.forEach;
  _.foldl    = _.inject       = _.reduce;
  _.foldr    = _.reduceRight;
  _.select   = _.filter;
  _.all      = _.every;
  _.any      = _.some;
  _.head     = _.first;
  _.tail     = _.rest;
  _.methods  = _.functions;

  // ------------------------ Setup the OOP Wrapper: --------------------------

  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.
  /**
   * 说一下 oop style 的表现
   * _.map([1, 2, 3], function(n){ return n * 2; }); => 通常是这样的，这个是每个函数入参时候的定义，本质是调用挂在 _ 对象上的方法
   * _([1, 2, 3]).map(function(n){ return n * 2; }); => 这么写也可以，类似封装了一层，在调用方法
   * 单纯这么写，并没带来多大的好处，只有 oop 之后跟上 chain 可能会更加好一点：
   * 
   * var lyrics = [
   *    {line : 1, words : "I'm a lumberjack and I'm okay"},
   *    {line : 2, words : "I sleep all night and I work all day"},
   *    {line : 3, words : "He's a lumberjack and he's okay"},
   *    {line : 4, words : "He sleeps all night and he works all day"}
   * ];
   *
   * _(lyrics).chain()
   *   .map(function(line) { return line.words.split(' '); })
   *   .flatten()
   *   .value();
   *
   *  => ["I'm", "a", "lumberjack", "and", "I'm", ...] 
   * 上个函数调用的返回值，直接可以继续来用 _ 上的方法，这样会带来一些便利
   * 不过这里要注意各个方法的返回值，因为都是返回值在继续向下调用
   */

  /**
   * 来说说这个是如何实现的
   * _ 被定义为 : ƒ (obj) { return new wrapper(obj); }
   * 因为是这样定义的 var _ = root._ = function(obj) { return new wrapper(obj); };
   * 
   * a. _() 执行 返回 wrapper方法的执行 => { _wrapped: undefined };
   * 举例子：_('test','test2') => wrapper { _wrapped: "test" };
   * 第二个参数是没用，是因为 wrapper 函数是这么定义的  var wrapper = function(obj) { this._wrapped = obj; };
   * 
   * b. 本质上就是为了返回一个对象，这个对象有一个 _wrapped属性，属性被赋值为调用时候的第一个实参
   * new 是为了改变 wrapper 函数的 this 指针，让他指向被创建的对象，以便往这个对象上正确的挂在属性
   * 
   * c. 截止目前，_()，就是返回一个对象，对象上有一个属性（_wrapper）用来指代传入的参数
   * 下文有这么一些定义，大致意思是 wrapper.prototype = _; 
   * 新建出来的对象就有了 _ 上所有的属性和方法，所以实现了可以 oop 的基本功能
   * 
   * d. 所以，实现了这样的调用方式 _([1, 2, 3, 3, 2]).uniq(); // 返回 { _wrapper: [1, 2, 3, 4, 5] }，上面有 _ 的方法
   */

   /**
    * 链式调用是这么实现的：
    * 通过一个挂在构造函数原型上的 chain 方法，给构造出来的对象打上一个 _chain 为 true 的标记
    * 下文中还通过一个 result 的函数，检测这个标记，如果有这个标记则返回 _() 的 oop wrap 对象
    * 就是通过这两个函数实现的
    */

  // 就是一个构造函数来返回，一个对象
  var wrapper = function(obj) { this._wrapped = obj; };

  // Helper function to continue chaining intermediate results.
  // 如果有 _chain 标记则返回 oop wrap 对象
  var result = function(obj, chain) {
    return chain ? _(obj).chain() : obj;
  };
  
  // A method to easily add functions to the OOP wrapper.
  // 为核心构造函数上挂载方法，这个函数在 mixin 里被调用
  var addToWrapper = function(name, func) {
    wrapper.prototype[name] = function() {
      var args = _.toArray(arguments);
      /**
       * 在 args 开头添加 _wrapped
       * _wrapped 就是构造函数实例的时候传入的要被操作的值
       * 再通过函数本身的调用，就可以实现 _().map(() => { do something... }) 的调用
       * 
       * 也就是说，所有不论是 oop 的方式 _().map(() => {});
       * 还是正常方式 _.map([], () => {});
       * 都会走到这个方法里，这个方法会把参数都组织成为第一个参数是要迭代对象，其他参数分别对应不同位置的形式
       * 本质上是通过，把第一个参数和其他参数剥离的形式做到的
       * 第一个参数会被赋值成一个对象上的某个属性，其他参数则在这里组织起来
       */
      unshift.call(args, this._wrapped);
      return result(func.apply(_, args), this._chain);
    };
  };

  // Add all of the Underscore functions to the wrapper object.
  // 把上文方法直接挂载好
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  // 挂载常用数组方法，这样 chain 的时候就更加方便了
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      method.apply(this._wrapped, arguments);
      /*
       * 这个地方返回的是原来的值，并不是正常这些数组方法的返回值
       * 这么做的原因是这些方法是改变原对象的，返回原对象可以用来继续操作
       */  
      return result(this._wrapped, this._chain);
    };
  });

  // Add all accessor Array functions to the wrapper.
  // 数组方法继续挂载，只是这一组数组方法是不会改变原对象的
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    // 这里就直接返回了这些操作方法的返回结果，因为这些操作方法是不会改变原对象的，但是会返回一个数组可供再次操作
    wrapper.prototype[name] = function() {
      return result(method.apply(this._wrapped, arguments), this._chain);
    };
  });

  // Start chaining a wrapped Underscore object.
  // 实现 chain 的核心函数，在构造出来的对象上添加一个标记 _chain
  wrapper.prototype.chain = function() {
    this._chain = true;
    return this;
  };

  // Extracts the result from a wrapped and chained object.
  // 直接拿实例的 _wrapped 的值
  wrapper.prototype.value = function() {
    return this._wrapped;
  };

})();

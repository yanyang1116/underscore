// Underscore.js
// (c) 2010 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is freely distributable under the terms of the MIT license.
// Portions of Underscore are inspired by or borrowed from Prototype.js,
// Oliver Steele's Functional, and John Resig's Micro-Templating.
// For all details and documentation:
// http://documentcloud.github.com/underscore

(function() {
  // ------------------------- Baseline setup ---------------------------------

  // Establish the root object, "window" in the browser, or "global" on the server.
  // 考虑多环境的情况，这里用this来指代 global
  var root = this;

  // Save the previous value of the "_" variable.
  // 把全局上之前被声明的 _ 符号赋值出来，下文有个 noConflict 方法会来处理这种冲突
  var previousUnderscore = root._;

  // Establish the object that gets thrown to break out of a loop iteration.
  /*
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
  /*
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
  /*
   * 核心方法
   * 迭代 object 和 array，然后做 iterator 函数规定做的事情，可以指定上下文对象
   */
  var each = _.forEach = function(obj, iterator, context) {
    try {
      /*
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
        /*
         * 其他情况(对象)，就迭代进去
         * 并且做和 数组 的 forEach 类似的用法
         * 这里一个细节是， for in 迭代对于处理是非常柔和的，只迭代可枚举对象。
         * 所以就算给到的是 function、'string'，也不会报错。只要没人为添加属性（做这种奇怪的事），就默认不迭代
         */ 
        for (var key in obj) {
           /* 
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
  // 不过下文为什么没有用 arr 的 find 来拦一下，可能是这个写法效率比 find 更好。
  _.detect = function(obj, iterator, context) {
    var result;
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
  /*
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
  /*
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
    /*
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
      /*
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
      /*
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
  /*
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
  /* 数组去重，基于 === 的去重
   * 如果传入第二个形参告知传入的数组已经排序过，则用更快的比较方法，性能更好
   * 
   * es6有新的去重方式：
   * var arr = [1, 2, { a: 1 }, { a: 1 }];
   * var resultarr = [...new Set(arr)]; =>  [1, 2, { a :1 }, { a: 1 }] 真实有效，对引用类型也管用
   */
  _.uniq = function(array, isSorted) {
    return _.reduce(array, [], function(memo, el, i) {
      /*
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
  // 传入多个数组，按照位置在一维上一一对应，组成新数组
  // _.zip([1, 2, 3], [2, 3, 3, 6], [8, 8]) => [[1, 2, 8], [2 ,3 ,8], [3, 3, undef], [undef, 6, undef]]
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
  
  _.range = function(start, stop, step) {
    var a     = _.toArray(arguments);
    var solo  = a.length <= 1;
    var start = solo ? 0 : a[0], stop = solo ? a[0] : a[1], step = a[2] || 1;
    var len   = Math.ceil((stop - start) / step);
    if (len <= 0) return [];
    var range = new Array(len);
    for (var i = start, idx = 0; true; i += step) {
      if ((step > 0 ? i - stop : stop - i) >= 0) return range;
      range[idx++] = i;
    }
  };

  // ----------------------- Function Functions: ------------------------------

  // Create a function bound to a given object (assigning 'this', and arguments,
  // optionally). Binding with arguments is also known as 'curry'.
  _.bind = function(func, obj) {
    var args = _.rest(arguments, 2);
    return function() {
      return func.apply(obj || {}, args.concat(_.toArray(arguments)));
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = _.rest(arguments);
    if (funcs.length == 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = _.rest(arguments, 2);
    return setTimeout(function(){ return func.apply(func, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(_.rest(arguments)));
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = [func].concat(_.toArray(arguments));
      return wrapper.apply(wrapper, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = _.toArray(arguments);
    return function() {
      var args = _.toArray(arguments);
      for (var i=funcs.length-1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // ------------------------- Object Functions: ------------------------------

  // Retrieve the names of an object's properties.
  // Delegates to ECMA5's native Object.keys
  _.keys = nativeKeys || function(obj) {
    if (_.isArray(obj)) return _.range(0, obj.length);
    var keys = [];
    for (var key in obj) if (hasOwnProperty.call(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    return _.map(obj, _.identity);
  };

  // Return a sorted list of the function names available on the object.
  _.functions = function(obj) {
    return _.filter(_.keys(obj), function(key){ return _.isFunction(obj[key]); }).sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(_.rest(arguments), function(source) {
      for (var prop in source) obj[prop] = source[prop];
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (_.isArray(obj)) return obj.slice(0);
    return _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    // Check object identity.
    if (a === b) return true;
    // Different types?
    var atype = typeof(a), btype = typeof(b);
    if (atype != btype) return false;
    // Basic equality test (watch out for coercions).
    if (a == b) return true;
    // One is falsy and the other truthy.
    if ((!a && b) || (a && !b)) return false;
    // One of them implements an isEqual()?
    if (a.isEqual) return a.isEqual(b);
    // Check dates' integer values.
    if (_.isDate(a) && _.isDate(b)) return a.getTime() === b.getTime();
    // Both are NaN?
    if (_.isNaN(a) && _.isNaN(b)) return true;
    // Compare regular expressions.
    if (_.isRegExp(a) && _.isRegExp(b))
      return a.source     === b.source &&
             a.global     === b.global &&
             a.ignoreCase === b.ignoreCase &&
             a.multiline  === b.multiline;
    // If a is not an object by this point, we can't handle it.
    if (atype !== 'object') return false;
    // Check for different array lengths before comparing contents.
    if (a.length && (a.length !== b.length)) return false;
    // Nothing else worked, deep compare the contents.
    var aKeys = _.keys(a), bKeys = _.keys(b);
    // Different object sizes?
    if (aKeys.length != bKeys.length) return false;
    // Recursive comparison of contents.
    for (var key in a) if (!_.isEqual(a[key], b[key])) return false;
    return true;
  };

  // Is a given array or object empty?
  _.isEmpty = function(obj) {
    if (_.isArray(obj)) return obj.length === 0;
    for (var key in obj) if (hasOwnProperty.call(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType == 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return !!(obj && obj.concat && obj.unshift);
  };

  // Is a given variable an arguments object?
  _.isArguments = function(obj) {
    return obj && _.isNumber(obj.length) && !obj.concat && !obj.substr && !obj.apply && !propertyIsEnumerable.call(obj, 'length');
  };

  // Is a given value a function?
  _.isFunction = function(obj) {
    return !!(obj && obj.constructor && obj.call && obj.apply);
  };

  // Is a given value a string?
  _.isString = function(obj) {
    return !!(obj === '' || (obj && obj.charCodeAt && obj.substr));
  };

  // Is a given value a number?
  _.isNumber = function(obj) {
    return (obj === +obj) || (toString.call(obj) === '[object Number]');
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
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
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function n times.
  _.times = function (n, iterator, context) {
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Break out of the middle of an iteration.
  _.breakLoop = function() {
    throw breaker;
  };

  // Add your own custom functions to the Underscore object, ensuring that
  // they're correctly added to the OOP wrapper as well.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      addToWrapper(name, _[name] = obj[name]);
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    start       : '<%',
    end         : '%>',
    interpolate : /<%=(.+?)%>/g
  };

  // JavaScript templating a-la ERB, pilfered from John Resig's
  // "Secrets of the JavaScript Ninja", page 83.
  // Single-quote fix from Rick Strahl's version.
  // With alterations for arbitrary delimiters.
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
  var wrapper = function(obj) { this._wrapped = obj; };

  // Helper function to continue chaining intermediate results.
  var result = function(obj, chain) {
    return chain ? _(obj).chain() : obj;
  };

  // A method to easily add functions to the OOP wrapper.
  var addToWrapper = function(name, func) {
    wrapper.prototype[name] = function() {
      var args = _.toArray(arguments);
      unshift.call(args, this._wrapped);
      return result(func.apply(_, args), this._chain);
    };
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      method.apply(this._wrapped, arguments);
      return result(this._wrapped, this._chain);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      return result(method.apply(this._wrapped, arguments), this._chain);
    };
  });

  // Start chaining a wrapped Underscore object.
  wrapper.prototype.chain = function() {
    this._chain = true;
    return this;
  };

  // Extracts the result from a wrapped and chained object.
  wrapper.prototype.value = function() {
    return this._wrapped;
  };

})();

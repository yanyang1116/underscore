// Underscore.js
// (c) 2010 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is freely distributable under the terms of the MIT license.
// Portions of Underscore are inspired by or borrowed from Prototype.js,
// Oliver Steele's Functional, and John Resig's Micro-Templating.
// For all details and documentation:
// http://documentcloud.github.com/underscore

/**
 * update to 0.6.0:
 * 
 * 1. 新增了以下方法：
 * noConflict、lastIndexOf、compose、identity、first、last、rest
 * functions、chain、tap、mixin、times、range、reduceRight
 * isNaN、isDate、isNull、isReg、isEmpty、isString、isNumber
 * ****************************************************************************
 * 
 * 2. 重写了核心函数【each】
 * ****************************************************************************
 * 
 * 3. 支持了oop:
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
 * c. 截止目前，确实就是返回的就是传入参数的那个单纯的对象，但是下文有这么一些定义，大致意思是 wrapper.prototype = _; 
 * 新建出来的对象就有了 _ 上所有的属性和方法
 * 
 * d. 所以，实现了这样的调用方式 _([1, 2, 3, 3, 2]).uniq(); // 返回 { _wrapper: [1, 2, 3, 4, 5] }，上面有 _ 的方法
 * 
 * e. 总之，具体还得看下文的定义
 * ****************************************************************************
 * 
 * 4. 增加了对commonJs的支持：
 * if (typeof exports !== 'undefined') exports._ = _;
 * commonJs 会注入一个 exports 对象，通过 把属性和方法挂在 exports 上，暴露出去
 * 支持这个可以更好的服务于 node 环境，
 * 不用关心太多，对于 webpack + babel 而言，require 和 important 都会有很好的兼容处理
 * 
 * ****************************************************************************
 * 
 * 5. 处理的别名
 * ****************************************************************************
 * 
 * 6. 其他若干优化
 * ****************************************************************************
 * 
 */


(function() {
  // ------------------------- Baseline setup ---------------------------------

  // Establish the root object, "window" in the browser, or "global" on the server.
  var root = this;

  // Save the previous value of the "_" variable.
  var previousUnderscore = root._;

  // Establish the object that gets thrown to break out of a loop iteration.
  var breaker = typeof StopIteration !== 'undefined' ? StopIteration : '__break__';

  // Quick regexp-escaping function, because JS doesn't have RegExp.escape().
  var escapeRegExp = function(s) { return s.replace(/([.*+?^${}()|[\]\/\\])/g, '\\$1'); };

  // Save bytes in the minified (but not gzipped) version:
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

  // Create a safe reference to the Underscore object for reference below.
  var _ = function(obj) { return new wrapper(obj); };

  // Export the Underscore object for CommonJS.
  if (typeof exports !== 'undefined') exports._ = _;

  // Export underscore to global scope.
  root._ = _;

  // Current version.
  _.VERSION = '0.6.0';

  // ------------------------ Collection Functions: ---------------------------

  // The cornerstone, an each implementation.
  // Handles objects implementing forEach, arrays, and raw objects.
  // Delegates to JavaScript 1.6's native forEach if available.
  var each = _.forEach = function(obj, iterator, context) {
    var index = 0;
    try {
      if (nativeForEach && obj.forEach === nativeForEach) {
        obj.forEach(iterator, context);
      } else if (_.isNumber(obj.length)) {
        for (var i = 0, l = obj.length; i < l; i++) iterator.call(context, obj[i], i, obj);
      } else {
        for (var key in obj) {
          if (hasOwnProperty.call(obj, key)) iterator.call(context, obj[key], key, obj);
        }
      }
    } catch(e) {
      if (e != breaker) throw e;
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to JavaScript 1.6's native map if available.
  _.map = function(obj, iterator, context) {
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    var results = [];
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  // Reduce builds up a single result from a list of values, aka inject, or foldl.
  // Delegates to JavaScript 1.8's native reduce if available.
  _.reduce = function(obj, memo, iterator, context) {
    if (nativeReduce && obj.reduce === nativeReduce) return obj.reduce(_.bind(iterator, context), memo);
    each(obj, function(value, index, list) {
      memo = iterator.call(context, memo, value, index, list);
    });
    return memo;
  };

  // The right-associative version of reduce, also known as foldr. Uses
  // Delegates to JavaScript 1.8's native reduceRight if available.
  // reduceRight的polyfill
  _.reduceRight = function(obj, memo, iterator, context) {
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) return obj.reduceRight(_.bind(iterator, context), memo);
    var reversed = _.clone(_.toArray(obj)).reverse();
    return _.reduce(reversed, memo, iterator, context);
  };

  // Return the first value which passes a truth test.
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
  _.filter = function(obj, iterator, context) {
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    var results = [];
    each(obj, function(value, index, list) {
      iterator.call(context, value, index, list) && results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    var results = [];
    each(obj, function(value, index, list) {
      !iterator.call(context, value, index, list) && results.push(value);
    });
    return results;
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to JavaScript 1.6's native every if available.
  _.every = function(obj, iterator, context) {
    iterator = iterator || _.identity;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    var result = true;
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) _.breakLoop();
    });
    return result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to JavaScript 1.6's native some if available.
  _.some = function(obj, iterator, context) {
    iterator = iterator || _.identity;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    var result = false;
    each(obj, function(value, index, list) {
      if (result = iterator.call(context, value, index, list)) _.breakLoop();
    });
    return result;
  };

  // Determine if a given value is included in the array or object using '==='.
  _.include = function(obj, target) {
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    var found = false;
    each(obj, function(value) {
      if (found = value === target) _.breakLoop();
    });
    return found;
  };

  // Invoke a method with arguments on every item in a collection.
  _.invoke = function(obj, method) {
    var args = _.rest(arguments, 2);
    return _.map(obj, function(value) {
      return (method ? value[method] : value).apply(value, args);
    });
  };

  // Convenience version of a common use case of map: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Return the maximum item or (item-based computation).
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.max.apply(Math, obj);
    var result = {computed : -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.min.apply(Math, obj);
    var result = {computed : Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Sort the object's values by a criteria produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  };

  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator) {
    iterator = iterator || _.identity;
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >> 1;
      iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Convert anything iterable into a real, live array.
  _.toArray = function(iterable) {
    if (!iterable)                return [];
    if (iterable.toArray)         return iterable.toArray();
    if (_.isArray(iterable))      return iterable;
    if (_.isArguments(iterable))  return slice.call(iterable);
    return _.values(iterable);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    return _.toArray(obj).length;
  };

  // -------------------------- Array Functions: ------------------------------

  // Get the first element of an array. Passing "n" will return the first N
  // values in the array. Aliased as "head". The "guard" check allows it to work
  // with _.map.
  /**
   * 返回一个数组的第一个，或者头几个
   * 这个方法，并没有太大的方便之处，相对于原生的实现方法：arr[0]，arr.slice(0, n);
   * 不过也许放到 underscore 的 chain 里，会有点用吧，显得美观点
   */
  _.first = function(array, n, guard) {
    // guard用来检查是否能使用map函数，如果传入真值就什么都不管了，返回第一个值（绝大多数情况下，都不会传guard，不用关心）
    // 传入了第二个参数 n，则使用slice处理数组，否则返回第一个
    return n && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the first entry of the array. Aliased as "tail".
  // Especially useful on the arguments object. Passing an "index" will return
  // the rest of the values in the array from that index onward. The "guard"
  // check allows it to work with _.map.
  /**
   * 类似上面的first
   * 默认显示除去第一项之后的剩余项目，传入参数后就是显示传入参数坐标之后的剩余项目
   */
  _.rest = function(array, index, guard) {
    return slice.call(array, _.isUndefined(index) || guard ? 1 : index);
  };

  // Get the last element of an array.
  // 拿数组的最后一项
  _.last = function(array) {
    return array[array.length - 1];
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, function(value){ return !!value; });
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array) {
    return _.reduce(array, [], function(memo, value) {
      if (_.isArray(value)) return memo.concat(_.flatten(value));
      memo.push(value);
      return memo;
    });
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    var values = _.rest(arguments);
    return _.filter(array, function(value){ return !_.include(values, value); });
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  _.uniq = function(array, isSorted) {
    return _.reduce(array, [], function(memo, el, i) {
      if (0 == i || (isSorted === true ? _.last(memo) != el : !_.include(memo, el))) memo.push(el);
      return memo;
    });
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersect = function(array) {
    var rest = _.rest(arguments);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
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
  _.indexOf = function(array, item) {
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item);
    for (var i = 0, l = array.length; i < l; i++) if (array[i] === item) return i;
    return -1;
  };


  // Delegates to JavaScript 1.6's native lastIndexOf if available.
  /**
   * 从数组的末尾开始找，直到找到第一个与传入值相等的值，并返回坐标
   * 其实就是 lastIndexOf 的一个 polyfill
   */ 
  _.lastIndexOf = function(array, item) {
    // 有原生的 lastIndexOf ，而且传入对象上没有主动写一个 lastIndexOf 来覆盖原生的，就调用原生的来处理
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) return array.lastIndexOf(item);
    var i = array.length;
    while (i--) if (array[i] === item) return i; // 
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
    var solo  = a.length <= 1; // 没给参数或者只给了一个参数 => true ,否则 => false

    /**
     * 如果给了一个参数或者没给的话，这个 start 是 0，不然就是给的那个给定的参数的第一个作为起点
     * 停止针对只有一个参数或者没有参数的情况，他会被尝试赋值成 arguments[0]，也就是说没传参数是 undef，有停止参数就是停止参数
     * 步伐幅度是step参数或者不给就是1
     */
    var start = solo ? 0 : a[0], stop = solo ? a[0] : a[1], step = a[2] || 1;

    var len = Math.ceil((stop - start) / step); // 向上取整，这里如果 stop 是 undef，这个len会是NaN，一下行会【报错】
    if (len <= 0) return []; // 这个 len 有可能是 NaN，会【报错】，以后版本应该修复了这个问题
    var range = new Array(len);
    for (var i = start, idx = 0; true; i += step) { // 下来就是填充的工作了
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
      /**
       * 一处优化：
       * 这里 apply 本来是 第一个参数是 (obj || window)
       * 现在改成了这个 {}，可能是为了防止主动去找到一些 window 上的同名方法
       */
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
      // 最终如果运行闭包函数的话，他会返回一个值，这里之所以还要用[0]取一下的原因是
      // 你看那个地方为了让迭代的 apply 能运行，返回了一个 [funcs[i].apply(this, args)]
      // 所以要取一下值
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
  // 返回一个第一维下，所有类型是 function 的 key 组成的数组
  _.functions = function(obj) {
    return _.filter(_.keys(obj), function(key){ return _.isFunction(obj[key]); }).sort();
  };

  // Extend a given object with all of the properties in a source object.
  _.extend = function(destination, source) {
    for (var property in source) destination[property] = source[property];
    return destination;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (_.isArray(obj)) return obj.slice(0);
    return _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in order to perform operations on intermediate results within the chain.
  // 这个主要用于链式调用（chain）的时候，执行传入方法，同时不打断链式调用。
  _.tap = function(obj, interceptor) {
    interceptor(obj); // 这个是另外要执行的函数
    return obj; // 返回的是obj，如果是在一个 chain 里的话会被处理成 { _wrapper: obj, _chain: true }
  };

  // Perform a deep comparison to check if two objects are equal.
  // 做了一些优化比值
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
    // 新增加的Date比较
    if (_.isDate(a) && _.isDate(b)) return a.getTime() === b.getTime();
    // Both are NaN?
    // 都是NaN的时候反的是true，更加符合逻辑
    if (_.isNaN(a) && _.isNaN(b)) return true;
    // Compare regular expressions.
    if (_.isRegExp(a) && _.isRegExp(b))
      // 这个是正则比较，新加的，主要比较正则对象的下面四个字段
      return a.source     === b.source &&
             a.global     === b.global &&
             a.ignoreCase === b.ignoreCase &&
             a.multiline  === b.multiline;
    // If a is not an object by this point, we can't handle it.
    if (atype !== 'object') return false;
    // Check for different array lengths before comparing contents.
    if (a.length && (a.length !== b.length)) return false;
    // Nothing else worked, deep compare the contents.
    // 先看长度，再看内容
    var aKeys = _.keys(a), bKeys = _.keys(b);
    // Different object sizes?
    // 先看长度，再看内容
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
  /** 
   * 这个函数用处不大，主要是为了方式_符号被占用了 
   * 就需要把underscore复制给别的变量来使用
   */
  _.noConflict = function() {
    root._ = previousUnderscore; // 如果全局环境有_， 则原先的_任然用_占位
    return this; // 返回 this 对象，给新的变量名保存
  };

  // Keep the identity function around for default iterators.
  // 一个返回原值的通用方法，作用其实主要是用来某些条件下替代迭代器，是通篇的结构整洁一点
  _.identity = function(value) {
    return value;
  };

  // Run a function n times.
  _.times = function (n, iterator, context) {
    // 根据传入的次数和迭代器，执行指定次数，同时可以指定上下文
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Break out of the middle of an iteration.
  // 这里优化了一下，这个方法应该内部使用吧，为了格式更加统一一点
  _.breakLoop = function() {
    throw breaker;
  };

  // Add your own custom functions to the Underscore object, ensuring that
  // they're correctly added to the OOP wrapper as well.
  // 这个意思应该是说，会把你传入的方法添加到 wrapper 的原型对象上
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
  // 定义 wrapper 函数，这个函数类似于一个构造函数
  var wrapper = function(obj) { this._wrapped = obj; };

  // Helper function to continue chaining intermediate results.
  // 这个函数当有 chain 的时候，会返回 wrapper 包裹的原来的obj，所以可以链式调用
  // 如果想合理的一直 . 下去，应该考虑对 obj 的引用直接修改 
  var result = function(obj, chain) {
    return chain ? _(obj).chain() : obj;
  };

  // A method to easily add functions to the OOP wrapper.
  /**
   * 这个函数在 mixin 的时候有用到
   * 主要功能是将传入的方法名和具体方法，赋值到 wrapper 函数的原型链上
   * 同时，最后 返回 result 执行结果是实现 oop 的核心之一，会根据 chain ，还有 apply 参数的形式做相关处理
   */
  var addToWrapper = function(name, func) {
    wrapper.prototype[name] = function() {
      var args = _.toArray(arguments);
      unshift.call(args, this._wrapped); // 重新组织参数形式
      return result(func.apply(_, args), this._chain);
    };
  };

  // Add all of the Underscore functions to the wrapper object.
  // _ 上自己的方法先做一个 mixin 处理，会走一下 addToWrapper 函数来实现 oop 的功能
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  // 把 array 常用方法也放到 wrapper 上，这样会 oop 对数组的处理更加好
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      method.apply(this._wrapped, arguments);
      return result(this._wrapped, this._chain);
    };
  });

  // Add all accessor Array functions to the wrapper.
  // 和上面的是差不多的，只是这里处理的是不会改变原来数组的情况，所以这里把方法的返回结果给 return 出来
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      return result(method.apply(this._wrapped, arguments), this._chain);
    };
  });

  // Start chaining a wrapped Underscore object.
  /**
   * 如果使用了 chain 方法的话，会在 new 出来的 wrapper 对象里，放一个 _chain 的 key
   * 这个 key 会在 上文中的 result 函数中判断，用来返回合适的值，连续的链式调用
   * chain方法本身是返回 _ 本身的，本质上单纯是为了 打一个 _chain 标记上去
   * 大概效果是这样的：
   * var stooges = [{name : 'curly', age : 25}, {name : 'moe', age : 21}, {name : 'larry', age : 23}];
   * var youngest = _(stooges).chain()
   * .sortBy(function(stooge){ return stooge.age; })
   * .map(function(stooge){ return stooge.name + ' is ' + stooge.age; })
   * .first()
   * .value();
   * => "moe is 21"
   */
  wrapper.prototype.chain = function() {
    this._chain = true;
    return this;
  };

  // Extracts the result from a wrapped and chained object.
  // 这个方法是直接把 new 出来的 wrapper 对象里，_wrapped 的值给弄出来
  // 通常配合 oop 和 chain 使用，用来拿到最后的结果
  // _([1, 2, 3]).value(); => [1, 2, 3]
  // _([1,2,3]).chain().reverse().first().value() => 3
  wrapper.prototype.value = function() {
    return this._wrapped;
  };

})();

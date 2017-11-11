// Underscore.js
// (c) 2009 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is freely distributable under the terms of the MIT license.
// Portions of Underscore are inspired by or borrowed from Prototype.js, 
// Oliver Steele's Functional, And John Resig's Micro-Templating.
// For all details and documentation:
// http://documentcloud.github.com/underscore/
window._ = {
  
  VERSION : '0.1.0',
  
  /*------------------------ Collection Functions: ---------------------------*/
    
  // The cornerstone, an each implementation.
  // Handles objects implementing forEach, each, arrays, and raw objects.
  each : function(obj, iterator, context) {
    var index = 0;
    try {
      if (obj.forEach) { // 兼容到ie9
        obj.forEach(iterator, context);
      } else if (obj.length) {
        // 数组情况处理
        // 这里没有安全实现forEach的功能。传入的实参是按值传递，没有实现forEach左右一个参数按照引用传递的功能
        // 在ie 8 一下可以证实这个结果
        for (var i=0; i<obj.length; i++) iterator.call(context, obj[i], i);
      } else if (obj.each) {
        // 这里故意这么做的吧？大概率是像枚举自身 _ 的时候：
        // _.each(_, () => {}) 可能不想对 _ 重新操作，同时对于普通对象，也存在each的方法的情况就执行函数
        obj.each(function(value) { iterator.call(context, value, index++); });
      } else {
        var i = 0;
        for (var key in obj) {
          var value = obj[key], pair = [key, value];
          pair.key = key;
          pair.value = value;
          iterator.call(context, pair, i++);
        }
        // 这里的参数形式是，第二个参数是index 第一个参数是数组[a, 1, key: 'a', value: 1]
      }
    } catch(e) {
      // 用error 来控制一个函数整个程序的终止
      // 一旦抛出错误，整个程序都会终止，这里是为了跳出迭代
      if (e != '__break__') throw e;
    }
    return obj; // 返回对象本身，可以链式调用
  },
  
  // Return the results of applying the iterator to each element. Use Javascript
  // 1.6's version of map, if possible.
  map : function(obj, iterator, context) {
    if (obj && obj.map) return obj.map(iterator, context);
    var results = [];
    _.each(obj, function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results; // 返回结果
  },
  
  // Inject builds up a single result from a list of values. Also known as
  // reduce, or foldl.
  // 模拟 reduce ，兼容到ie9，注意，这里大部分方法都没有把自身对象当作引用传入的功能，下文不再论述
  // 这个函数，初始值强制传入，和reduce不同。所以迭代次数会是对象长度。这样更加便于理解
  inject : function(obj, memo, iterator, context) {
    _.each(obj, function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  },
  
  // Return the first value which passes a truth test.
  // 相当于find，兼容到ie9
  detect : function(obj, iterator, context) {
    var result;
    _.each(obj, function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        throw '__break__'; // 抛出错误的方式来控制迭代的结束
      }
    });
    return result;
  },
  
  // Return all the elements that pass a truth test. Use Javascript 1.6's
  // filter(), if it exists.
  // 相当 filter，兼容到ie9
  select : function(obj, iterator, context) {
    if (obj.filter) return obj.filter(iterator, context);
    var results = [];
    _.each(obj, function(value, index) {
      if (iterator.call(context, value, index)) results.push(value);
    });
    return results;
  },
  
  // Return all the elements for which a truth test fails.
  // filter取反，返回测试为false的结果集合
  reject : function(obj, iterator, context) {
    var results = [];
    _.each(obj, function(value, index) {
      if (!iterator.call(context, value, index)) results.push(value);
    });
    return results;
  },
  
  // Determine whether all of the elements match a truth test. Delegate to
  // Javascript 1.6's every(), if it is present.
  // 相当于every，兼容到ie9。是否都为真，返回布尔
  all : function(obj, iterator, context) {
    iterator = iterator || function(v){ return v; };
    if (obj.every) return obj.every(iterator, context);
    var result = true;
    _.each(obj, function(value, index) {
      result = result && !!iterator.call(context, value, index);
      if (!result) throw '__break__';
    });
    return result;
  },
  
  // Determine if at least one element in the object matches a truth test. Use
  // Javascript 1.6's some(), if it exists.
  // 相当于some，兼容到ie9。是否有真的，返回布尔。
  any : function(obj, iterator, context) {
    iterator = iterator || function(v) { return v; };
    if (obj.some) return obj.some(iterator, context);
    var result = false;
    _.each(obj, function(value, index) {
      if (result = !!iterator.call(context, value, index)) throw '__break__';
    });
    return result;
  },
  
  // Determine if a given value is included in the array or object, 
  // based on '==='.
  // 基于 === 比较，返回布尔值
  include : function(obj, target) {
    // es6的Array.prototype.includes 可以考虑
    if (_.isArray(obj)) return _.indexOf(obj, target) != -1;
    var found = false;
    _.each(obj, function(pair) {
      if (pair.value === target) {
        found = true; // 一拿到就跳出
        throw '__break__';
      }
    });
    return found;
  },
  
  // Invoke a method with arguments on every item in a collection.
  // 对目标对象调用目标方法，多余的参数为方法的实参。
  // 返回每个执行结果的合集
  invoke : function(obj, method) {
    var args = _.toArray(arguments).slice(2); // 抽取参数
    return _.map(obj, function(value) { // map 返回合集
      return (method ? value[method] : value).apply(value, args); // apply 数组方式传参数
    });
  },
  
  // Optimized version of a common use case of map: fetching a property.
  // 从目标对象里，拿目标键的数组集合
  pluck : function(obj, key) {
    var results = [];
    _.each(obj, function(value){ results.push(value[key]); });
    return results;
  },
  
  // Return the maximum item or (item-based computation).
  // 尝试拿目标对象，或者经过迭代之后的最大值
  max : function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.max.apply(Math, obj); // 注意此处，有不可比对象（非数字），会返回NaN
    var result;
    // 不是数组是对象，赋值迭代器的执行结果或者迭代值本身做检查
    _.each(obj, function(value, index) {
      var computed = iterator ? iterator.call(context, value, index) : value;
      /**
       * 下面的 == null 
       * 其实考虑了返回undef 和 null还有未初始化的情况，值得学习
       * 同时下面这个记录比值方法也不错
       */
      // 这下面的一系列比值，可以温习一下数据类型比较，大概意思是不同类型的先toString一下，然后在搞
      if (result == null || computed >= result.computed) result = {value : value, computed : computed};
    });
    return result.value;
  },
  
  // Return the minimum element (or element-based computation).
  // 同上面的max相反
  min : function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.min.apply(Math, obj);
    var result;
    _.each(obj, function(value, index) {
      var computed = iterator ? iterator.call(context, value, index) : value;
      if (result == null || computed < result.computed) result = {value : value, computed : computed};
    });
    return result.value;
  },
  
  // Sort the object's values by a criteria produced by an iterator.
  // 假设按照迭代器的sort处理过后，下面的数组会如何排列，返回的是原值
  // sort方法熟悉一下:
  // arr.sort((a,b) => {return 0});
  // 这个只要return里的结果通过多态后，不是正数，则正在比较的放在左边
  sortBy : function(obj, iterator, context) {
    return _.pluck(_.map(obj, function(value, index) {
      return {
        value : value,
        criteria : iterator.call(context, value, index)
      };
      // 这个通过对象，然后sort的比较方法也可以看看
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  },
  
  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  // 假如插入一个值，这个值按照迭代器的sort，会在那个位置，返回位置
  // 实战中没卵用
  sortedIndex : function(array, obj, iterator) {
    iterator = iterator || function(val) { return val; };
    var low = 0, high = array.length;
    // 这个while循环可以看看，不过这么做可读性不强
    while (low < high) {
      // 位操作符，向下取中位数，这个方法可以学学
      // 说到这个位操作符，还有一个值得学的
      // '-2147483.647' >> 0  这个可以快速parseInt，不过可读性不行
      var mid = (low + high) >> 1; 
      iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
    }
    return low;
  },
  
  // Convert anything iterable into a real, live array.
  // 尝试将所有类型转化成数组对象
  // 这个想到类数组转数组的es6方法 Array.from
  toArray : function(iterable) {
    if (!iterable) return []; // 多态假值，直接空
    if (_.isArray(iterable)) return iterable; // 是数组就还是数组
    return _.map(iterable, function(val){ return val; }); // 拿val集合
  },
  
  // Return the number of elements in an object.
  size : function(obj) {
    // 针对对象的话，也是拿可枚举keys的个数，较为鸡肋。 Object.keys().length ? 更加易懂，兼容到es6
    return _.toArray(obj).length; 
  },
  
  /*-------------------------- Array Functions: ------------------------------*/
  
  // Get the first element of an array.
  first : function(array) {
    return array[0];
  },
  
  // Get the last element of an array.
  last : function(array) {
    return array[array.length - 1];
  },
  
  // Trim out all falsy values from an array.
  compact : function(array) {
    // 过滤去掉假值
    return _.select(array, function(value){ return !!value; });
  },
  
  // Return a completely flattened version of an array.
  // 把数组展开到一维。这里返回有个递归
  flatten : function(array) {
    return _.inject(array, [], function(memo, value) {
      if (_.isArray(value)) return memo.concat(_.flatten(value)); // 递归调用，最终会合并成一个数组输出
      memo.push(value);
      return memo;
    });
  },
  
  // Return a version of the array that does not contain the specified value(s).
  // 返回去除指定目标值后的数组，这个是基于 === 对引用类型作用不大
  without : function(array) {
    // 以前取数组参数的方法并转字符串是这样的
    // 这里为什么不截取一下？取 array.slice.call(arguments, 1)? 应该结果是一样的测试过
    var values = array.slice.call(arguments, 0); 
    return _.select(array, function(value){ return !_.include(values, value); });
  },
  
  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // 基于 === 的去重，如果知道数组以及排序过了，就用 更快的处理方式
  uniq : function(array, isSorted) {
    return _.inject(array, [], function(memo, el, i) {
      // 注意这个去重，缓存里不包含的时候推入
      // 如果排序过，直接用last推入，这样是合理的
      // es6有新的去重方式：
      // var arr = [1,2,{a:1},{a:1}];
      // var resultarr = [...new Set(arr)]; =>  [1,2,{a:1},{a:1}]   真实有效，对引用类型也管用
      if (0 == i || (isSorted ? _.last(memo) != el : !_.include(memo, el))) memo.push(el);
      return memo;
    });
  },
  
  // Produce an array that contains every item shared between all the 
  // passed-in arrays.
  // 取数组交集
  intersect : function(array) {
    var rest = _.toArray(arguments).slice(1); // 拿待比较的两个数组
    return _.select(_.uniq(array), function(item) { // 最终return的是一纬值的集合
      return _.all(rest, function(other) { 
        // 用迭代的项目和正在比较的项目做对比 ，看看是否在项目里
        return _.indexOf(other, item) >= 0;
      });
    });
  },
  
  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  // 把传入的数组，按照位置在一维上一一对应，组成新数组
  zip : function() {
    var args = _.toArray(arguments);
    var length = _.max(_.pluck(args, 'length')); // 去最大长度来决定迭代次数
    var results = new Array(length);
    for (var i=0; i<length; i++) results[i] = _.pluck(args, String(i)); // 新数组每项位置都pluck来实现核心功能
    return results;
  },
  
  // If the browser doesn't supply us with indexOf (I'm looking at you, MSIE), 
  // we need this function. Return the position of the first occurence of an 
  // item in an array, or -1 if the item is not included in the array.
  indexOf : function(array, item) {
    // 有indexOf则使用array的indexOf，兼容到ie9
    if (array.indexOf) return array.indexOf(item);
    // 做hack处理
    var length = array.length;
    for (i=0; i<length; i++) if (array[i] === item) return i;
    return -1;
  },
  
  /* ----------------------- Function Functions: -----------------------------*/
  
  // Create a function bound to a given object (assigning 'this', and arguments,
  // optionally). Binding with arguments is also known as 'curry'.
  // 这个curry需要研究一下
  // 这里就是类似function的bind方法，返回fnc 兼容到ie9
  bind : function(func, context) {
    if (!context) return func; // 没上下文，直接返回
    var args = _.toArray(arguments).slice(2); // 多余的认为是参数
    return function() {
      var a = args.concat(_.toArray(arguments));
      return func.apply(context, a); // apply调用参数
    };
  },
  
  // Bind all of an object's methods to that object. Useful for ensuring that 
  // all callbacks defined on an object belong to it.
  // 给对象里的自定义方法的this指针，绑在这个对象上面
  // _.bindAll(*methodNames, context)
  bindAll : function() {
    debugger
    var args = _.toArray(arguments); // 拿参
    var context = args.pop(); // 返回最后一个，上下文对象
    _.each(args, function(methodName) { // 迭代参数
      // 上下文的方法名 使用 bind 绑定this
      // 不过这里为什么不把上下文对象本身排除掉，其实向上仔细看，pop方法已经删掉了上下文对象了
      context[methodName] = _.bind(context[methodName], context);
    });
  },
  
  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  // 快捷方式调用 setTimeout
  delay : function(func, wait) {
    var args = _.toArray(arguments).slice(2);
    return window.setTimeout(function(){ return func.apply(func, args); }, wait);
  },
  
  // Defers a function, scheduling it to run after the current call stack has 
  // cleared.
  // setTimeout = 1 , 优化队列，延后执行
  defer : function(func) {
    return _.delay.apply(_, [func, 1].concat(_.toArray(arguments).slice(1)));
  },
  
  // Returns the first function passed as an argument to the second, 
  // allowing you to adjust arguments, run code before and after, and 
  // conditionally execute the original function.
  // 这一条仔细看了，确实没啥卵用
  wrap : function(func, wrapper) {
    return function() {
      var args = [func].concat(_.toArray(arguments));
      return wrapper.apply(wrapper, args);
    };
  },
  
  /* ------------------------- Object Functions: ---------------------------- */
  
  // Retrieve the names of an object's properties.
  // 和Object.keys() 一样，兼容到ie9
  // 这个传 key 能拿到的原因是，each里面针对对象返回的是 [a, 1, key: 'a', value: '1']
  keys : function(obj) {
    return _.pluck(obj, 'key');
  },
  
  // Retrieve the values of an object's properties.
  // 同上
  values : function(obj) {
    return _.pluck(obj, 'value');
  },
  
  // Extend a given object with all of the properties in a source object.
  // 源对象的可枚举属性，扔到目标对象上。浅拷贝
  extend : function(destination, source) {
    for (var property in source) destination[property] = source[property];
    return destination;
  },
  
  // Create a (shallow-cloned) duplicate of an object.
  // 浅拷贝，类似于Object.assign({},obj) es6方法
  clone : function(obj) {
    return _.extend({}, obj);
  },
  
  // Perform a deep comparison to check if two objects are equal.
  // 这里是一个非常好的深度比较方法，比较值是否相等。
  // 即使是引用类型，只要他们表示的值相等。也报相等
  isEqual : function(a, b) {
    // Check object identity.
    if (a === b) return true; // 全等就直接过
    // Different types?
    var atype = typeof(a), btype = typeof(b);
    if (atype != btype) return false; // 类型都不同就挂了
    // Basic equality test (watch out for coercions).

    // 强制多态下相等，就直接过了。这里要熟悉各种多态的默认处理逻辑。主要是调用toString方法。
    // 所以说，fnc可以在这里判断是否相等，不过这里是tostring后判断，所以基于对fnc的判断要 toSting 后完全相等
    if (a == b) return true;

    // One of them implements an isEqual()?
    if (a.isEqual) return a.isEqual(b); // 如果有isEqual的话，直接用尝试（这里其实是说，有对象自带了isEqual方法，就仍用他的方法，但绝不是 _ ，应为 _ 在上面就会通过）
    // If a is not an object by this point, we can't handle it.
    if (atype !== 'object') return false; // 没有被上文处理好的 fnc 就不处理了，这里处理不了，直接false
    // Nothing else worked, deep compare the contents.
    var aKeys = _.keys(a), bKeys = _.keys(b); // 下来就是处理对象和数组的情况
    // Different object sizes?
    if (aKeys.length != bKeys.length) return false; // 长度都不等，直接false

    // Recursive comparison of contents.
    // 逐级从一维迭代。这里如果一维上的是对象则递归下去，注意这个递归，最终都会通过一个布尔值 向上传递，直到最顶层
    for (var key in a) if (!_.isEqual(a[key], b[key])) return false;
    // 通过最终是true
    return true;  
  },
  
  // Is a given value a DOM element?
  isElement : function(obj) {
    return !!(obj && obj.nodeType == 1);
  },
  
  // Is a given value a real Array?
  isArray : function(obj) {
    return Object.prototype.toString.call(obj) == '[object Array]';
  },
  
  // Is a given value a Function?
  isFunction : function(obj) {
    return typeof obj == 'function';
  },
  
  // Is a given variable undefined?
  // 这里想到 void 0 ，它只是为了防止 IE 8 里被重写
  isUndefined : function(obj) {
    return typeof obj == 'undefined';
  },
  
  /* -------------------------- Utility Functions: -------------------------- */
  
  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  // 在_对象上，挂载一个累加的id号，可以拼上前缀
  // 用途应该不大
  uniqueId : function(prefix) {
    var id = this._idCounter = (this._idCounter || 0) + 1;
    return prefix ? prefix + id : id;
  },
  
  // Javascript templating a-la ERB, pilfered from John Resig's 
  // "Secrets of the Javascript Ninja", page 83.
  // 有空研究，一种模板处理方式
  template : function(str, data) {
    var fn = new Function('obj', 
      'var p=[],print=function(){p.push.apply(p,arguments);};' +
      'with(obj){p.push(\'' +
      str
        .replace(/[\r\t\n]/g, " ") 
        .split("<%").join("\t") 
        .replace(/((^|%>)[^\t]*)'/g, "$1\r") 
        .replace(/\t=(.*?)%>/g, "',$1,'") 
        .split("\t").join("');") 
        .split("%>").join("p.push('") 
        .split("\r").join("\\'") 
    + "');}return p.join('');");
    return data ? fn(data) : fn;  
  }
  
};

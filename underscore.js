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
    // 迭代过程中使用 throw 来模拟 break
    try {
        // 下文中所有方法都会优先尝试原生方法，不行再进行Polyfill
        // 只有极少部分方法和原生方法的使用略有不同
        if (obj.forEach) { 
        obj.forEach(iterator, context);
      } else if (obj.length) {
        // 数组处理, 类型校验略显不足
        // 和原生forEach略有不同，缺少最后一个参数
        for (var i=0; i<obj.length; i++) iterator.call(context, obj[i], i);
      } else if (obj.each) {
        // 这段可能为了处理 _ 自身情况？后来版本删了
        obj.each(function(value) { iterator.call(context, value, index++); });
      } else {
        // 对象处理
        var i = 0;
        for (var key in obj) {
          var value = obj[key], pair = [key, value];
          pair.key = key;
          pair.value = value;
          // 这里迭代方法的传参和理想的有所不同，后来版本修正了
          iterator.call(context, pair, i++);
        }
      }
    } catch(e) {
      if (e != '__break__') throw e;
    }
    // 返回对象本身，可以链式调用。原生 forEach 没有返回值
    return obj; 
  },
  
  // Return the results of applying the iterator to each element. Use Javascript
  // 1.6's version of map, if possible.
  map : function(obj, iterator, context) {
    if (obj && obj.map) return obj.map(iterator, context);
    var results = [];
    _.each(obj, function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results; // 返回结果和原生效果一致
  },
  
  // Inject builds up a single result from a list of values. Also known as
  // reduce, or foldl.
  inject : function(obj, memo, iterator, context) {
    _.each(obj, function(value, index) {
      memo = iterator.call(context, memo, value, index);
    });
    return memo;
  },
  
  // Return the first value which passes a truth test.
  detect : function(obj, iterator, context) {
    var result;
    _.each(obj, function(value, index) {
      if (iterator.call(context, value, index)) {
        result = value;
        // 所有函数内部一旦有 error 被 throw ,该函数立刻终止
        throw '__break__';
      }
    });
    return result;
  },
  
  // Return all the elements that pass a truth test. Use Javascript 1.6's
  // filter(), if it exists.
  select : function(obj, iterator, context) {
    if (obj.filter) return obj.filter(iterator, context);
    var results = [];
    _.each(obj, function(value, index) {
      // 细节：这个地方，用强制多态来处理。而不是和 布尔 比值
      // 是符合真实的 filter 的效果的
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
  // 相当于every 判断集合迭代过后 是否都为真，返回布尔
  all : function(obj, iterator, context) {
    iterator = iterator || function(v){ return v; };
    if (obj.every) return obj.every(iterator, context);
    var result = true; 
    _.each(obj, function(value, index) {
      // 这个地方是不是多余了？应该没有必要给给初始值验真
      result = result && !!iterator.call(context, value, index);
      if (!result) throw '__break__';
    });
    return result;
  },
  
  // Determine if at least one element in the object matches a truth test. Use
  // Javascript 1.6's some(), if it exists.
  // 相当于some 判断集合迭代过后 是否有真的，返回布尔。
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
  // 对 集合中的每个目标对象 调用 目标方法，多余的参数为方法的实参。
  // 返回每个执行结果的合集
  invoke : function(obj, method) {
    // 抽取参数，2 因为除去 目标对象 和 目标方法 之外的才是目标方法的实参
    var args = _.toArray(arguments).slice(2); 
    return _.map(obj, function(value) { // map 返回合集
      // 如果没有目标方法，则就是单纯 map 的效果
      return (method ? value[method] : value).apply(value, args); // apply 接受数组
    });
  },
  
  // Optimized version of a common use case of map: fetching a property.
  // 从集合对象中，拿每个对象的目标键的数组集合
  pluck : function(obj, key) {
    var results = [];
    _.each(obj, function(value){ results.push(value[key]); });
    return results;
  },
  
  // Return the maximum item or (item-based computation).
  // 尝试对集合中每个目标对象，或者经过迭代之后的最大值
  max : function(obj, iterator, context) {
    // 没有迭代器，同时传入了一个数组，则直接尝试对数组比较得出最大值
    // 如果数组中有 经过强转后还是 NaN 的对象，则返回NaN
    if (!iterator && _.isArray(obj)) return Math.max.apply(Math, obj);
    var result;

    // 其他情况统一迭代传入的集合对象
    _.each(obj, function(value, index) {
      // 这里弄一个缓存值，有迭代器的情况下缓存是迭代器的执行结果，没有则就是正在迭代的值
      var computed = iterator ? iterator.call(context, value, index) : value;

      /**
       * 下面的 == null 
       * 其实考虑了返回undef 和 null还有未初始化的情况，值得学习
       * 同时下面这个记录比值方法也不错
       */

      // 这个比值方法的对象里，computed是用来比较的，value是最后输出结果的
      // 在 >= 的比较里，会进行强制多态的转换
      // 不过这个方法本质上是为了快速得出数字的最大值，所以无需关心 
      // 传入对象的情况也很少
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
  // 这个只要return里的结果通过多态后，不是正数，则正在比较的放在左边，最终达到重新排序的目的
  sortBy : function(obj, iterator, context) {
    // 最终是 pluck 一个数组的 value
    // 这个数组是一个 对象集合
    // 这个对象集合的value值上保留了原始信息，但是顺序是经过sort方法处理过的
    // 这个sort方法处理时候的比值是 传入迭代方法的返回值
    // 实战中用处应该不大
    return _.pluck(_.map(obj, function(value, index) {
      return {
        value : value,
        criteria : iterator.call(context, value, index)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  },
  
  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  // 实战中没卵用
  sortedIndex : function(array, obj, iterator) {
    iterator = iterator || function(val) { return val; };
    var low = 0, high = array.length;
    // 这个while循环可以看看 while的速度比 【for loop】 快10万倍
    while (low < high) {
      // 位操作符，向下取中位数，这个方法可以学学
      // 说到这个位操作符，还有一个值得学的
      // '-2147483.647' >> 0  这个可以快速parseInt，不过可读性不行
      // 这个执行效率大概是 parseint的 8 倍，但是有部分值执行的时候有bug
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
    // 针对对象的话，也是拿可枚举keys的个数
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
  // 把数组展开到一维。这里有个递归
  flatten : function(array) {
    return _.inject(array, [], function(memo, value) {
      if (_.isArray(value)) return memo.concat(_.flatten(value)); // 递归调用，最终会合并成一个数组输出
      memo.push(value);
      return memo;
    });
  },
  
  // Return a version of the array that does not contain the specified value(s).
  // 返回去除指定目标值后的数组，多余的参数就是要去除的目标值
  without : function(array) {
    // 以前取数组参数的方法并转字符串是这样的
    var values = array.slice.call(arguments, 0); // 参数数组化，没有自己的 _.toArray 方法

    // 这里就是把要去除值得数组迭代，返回不包含参数的数组（因为参数就是要去掉的值）
    return _.select(array, function(value){ return !_.include(values, value); }); // filter
  },
  
  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // 基于 === 的去重，
  // 如果知道数组以及排序过了，就用 更快的处理方式: isSorted 传true
  uniq : function(array, isSorted) {
    // inject 就是 reduce，初始值是 []
    return _.inject(array, [], function(memo, el, i) {
      // 如果排序过，直接顺序比值，如果有不同则推入结果

      // es6有新的去重方式：
      // var arr = [1,2,{a:1},{a:1}];
      // var resultarr = [...new Set(arr)]; =>  [1,2,{a:1},{a:1}]   真实有效，对引用类型也管用

      // 这个第一把，会推入一次。然后再去走 || 后面的，后面的直接用正在迭代的值在memo里做 include
      // 没有则推入，有则不做动作
      // 迭代完就做到了去重
      if (0 == i || (isSorted ? _.last(memo) != el : !_.include(memo, el))) memo.push(el);
      return memo;
    });
  },
  
  // Produce an array that contains every item shared between all the 
  // passed-in arrays.
  // 取传入的多个数组的集合
  intersect : function(array) {
    var rest = _.toArray(arguments).slice(1); // 去掉第一项以后的等待取交集的数组的数组集合

    /**
     * 1. 先对待比较第一项自身去重
     * 2. 然后迭代去重后的结果，迭代使用的是 filter 用来返回最后的交集数组
     * 3. 迭代动作里，去处理参数数组集合
     * 4. 主要看第一项里正在迭代的值是不是都在不在其他多个数组里
     * 5. 是的话最终会返回 true 作为最后的交集输出
     */

     // 这里多个 return 和 函数把作用域链弄的很长，不过都是能取到的
    return _.select(_.uniq(array), function(item) { // select => filter
      return _.all(rest, function(other) { // all => every
        return _.indexOf(other, item) >= 0;
      });
    });
  },
  
  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  // 传入多个数组，按照位置在一维上一一对应，组成新数组
  zip : function() {
    var args = _.toArray(arguments);
    var length = _.max(_.pluck(args, 'length')); // 这些传入数值中的最大长度来决定迭代次数
    var results = new Array(length);

    // _.zip([1, 2, 3], [2, 3, 3, 6], [8, 8]) => [[1,2,8],[2,3,8],[3,3,undef],[undef,6,undef]]
    for (var i=0; i<length; i++) results[i] = _.pluck(args, String(i)); // 下标用字符串拿

    return results;
  },
  
  // If the browser doesn't supply us with indexOf (I'm looking at you, MSIE), 
  // we need this function. Return the position of the first occurence of an 
  // item in an array, or -1 if the item is not included in the array.
  // 基于 === 的indexOf , 返回下标和原生的表现一致
  indexOf : function(array, item) {
    if (array.indexOf) return array.indexOf(item);
    // 做hack处理
    var length = array.length;
    for (var i=0; i<length; i++) if (array[i] === item) return i;
    return -1;
  },
  
  /* ----------------------- Function Functions: -----------------------------*/
  
  // Create a function bound to a given object (assigning 'this', and arguments,
  // optionally). Binding with arguments is also known as 'curry'.
  // 这里就是 function 的 bind 方法
  // bind 也可以认为是一个 curry 函数，它只会去给传入的纯函数创造不同上下文，作为一个副本
  bind : function(func, context) {
    if (!context) return func; // 没上下文，直接返回
    var args = _.toArray(arguments).slice(2); // 多余的认为是参数

    // 返回闭包，保持了 args、context 的状态来供访问
    // 认为是副本的原因是，返回的是一个匿名函数封包，不会影响原函数
    return function() {
      var a = args.concat(_.toArray(arguments));
      return func.apply(context, a);
    };
  },
  
  // Bind all of an object's methods to that object. Useful for ensuring that 
  // all callbacks defined on an object belong to it.
  // 为多个方法 bind 相同的上下文，批量操作
  // _.bindAll(*methodNames, context)
  bindAll : function() {
    var args = _.toArray(arguments); // 拿参
    var context = args.pop(); // 返回最后一个实参(上下文对象), pop已经删除了这个最后一项了
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
  // 放弃，没卵用
  wrap : function(func, wrapper) {
    return function() {
      var args = [func].concat(_.toArray(arguments));
      return wrapper.apply(wrapper, args);
    };
  },
  
  /* ------------------------- Object Functions: ---------------------------- */
  
  // Retrieve the names of an object's properties.
  // 返回对象的key集合
  keys : function(obj) {
    // 这个传 key 能拿到的原因是，each里面针对对象返回的是[a, 1, key: 'a', value: '1']
    return _.pluck(obj, 'key');
  },
  
  // Retrieve the values of an object's properties.
  // 返回对象的value集合，原理同上
  values : function(obj) {
    return _.pluck(obj, 'value');
  },
  
  // Extend a given object with all of the properties in a source object.
  // 把源对象的可枚举属性，扔到目标对象上(浅拷贝)
  extend : function(destination, source) {
    for (var property in source) destination[property] = source[property];
    return destination;
  },
  
  // Create a (shallow-cloned) duplicate of an object.
  // 浅拷贝，类似于Object.assign({},obj)
  // underscore一直没有提供深拷贝方法，作者认为做不完美，所以不做
  clone : function(obj) {
    return _.extend({}, obj);
  },
  
  // Perform a deep comparison to check if two objects are equal.
  // 这里是一个非常好的深度比较方法，比较值是否相等
  // 即使是引用类型，只要他们表示的值相等。也报相等
  // 以后版本这个比较被反复修改过，可以处理的比较符合容易想到的逻辑效果
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
  // nodeType === 1 的元素是 DOM节点
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
  uniqueId : function(prefix) {
    var id = this._idCounter = (this._idCounter || 0) + 1;
    return prefix ? prefix + id : id;
  },
  
  // Javascript templating a-la ERB, pilfered from John Resig's 
  // "Secrets of the Javascript Ninja", page 83.
  // 放弃，无卵用
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

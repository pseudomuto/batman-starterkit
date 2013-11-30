(function() {
  (typeof window !== "undefined" && window !== null ? window : global).module = void 0;

}).call(this);

/**
 * Zest (https://github.com/chjj/zest)
 * A css selector engine.
 * Copyright (c) 2011-2012, Christopher Jeffrey. (MIT Licensed)
 */

// TODO
// - Recognize the TR subject selector when parsing.
// - Pass context to scope.
// - Add :column pseudo-classes.

;(function() {

/**
 * Shared
 */

var window = this
  , document = this.document
  , old = this.zest;

/**
 * Helpers
 */

var compareDocumentPosition = (function() {
  if (document.compareDocumentPosition) {
    return function(a, b) {
      return a.compareDocumentPosition(b);
    };
  }
  return function(a, b) {
    var el = a.ownerDocument.getElementsByTagName('*')
      , i = el.length;

    while (i--) {
      if (el[i] === a) return 2;
      if (el[i] === b) return 4;
    }

    return 1;
  };
})();

var order = function(a, b) {
  return compareDocumentPosition(a, b) & 2 ? 1 : -1;
};

var next = function(el) {
  while ((el = el.nextSibling)
         && el.nodeType !== 1);
  return el;
};

var prev = function(el) {
  while ((el = el.previousSibling)
         && el.nodeType !== 1);
  return el;
};

var child = function(el) {
  if (el = el.firstChild) {
    while (el.nodeType !== 1
           && (el = el.nextSibling));
  }
  return el;
};

var lastChild = function(el) {
  if (el = el.lastChild) {
    while (el.nodeType !== 1
           && (el = el.previousSibling));
  }
  return el;
};

var unquote = function(str) {
  if (!str) return str;
  var ch = str[0];
  return ch === '"' || ch === '\''
    ? str.slice(1, -1)
    : str;
};

var indexOf = (function() {
  if (Array.prototype.indexOf) {
    return Array.prototype.indexOf;
  }
  return function(obj, item) {
    var i = this.length;
    while (i--) {
      if (this[i] === item) return i;
    }
    return -1;
  };
})();

var makeInside = function(start, end) {
  var regex = rules.inside.source
    .replace(/</g, start)
    .replace(/>/g, end);

  return new RegExp(regex);
};

var replace = function(regex, name, val) {
  regex = regex.source;
  regex = regex.replace(name, val.source || val);
  return new RegExp(regex);
};

var truncateUrl = function(url, num) {
  return url
    .replace(/^(?:\w+:\/\/|\/+)/, '')
    .replace(/(?:\/+|\/*#.*?)$/, '')
    .split('/', num)
    .join('/');
};

/**
 * Handle `nth` Selectors
 */

var parseNth = function(param, test) {
  var param = param.replace(/\s+/g, '')
    , cap;

  if (param === 'even') {
    param = '2n+0';
  } else if (param === 'odd') {
    param = '2n+1';
  } else if (!~param.indexOf('n')) {
    param = '0n' + param;
  }

  cap = /^([+-])?(\d+)?n([+-])?(\d+)?$/.exec(param);

  return {
    group: cap[1] === '-'
      ? -(cap[2] || 1)
      : +(cap[2] || 1),
    offset: cap[4]
      ? (cap[3] === '-' ? -cap[4] : +cap[4])
      : 0
  };
};

var nth = function(param, test, last) {
  var param = parseNth(param)
    , group = param.group
    , offset = param.offset
    , find = !last ? child : lastChild
    , advance = !last ? next : prev;

  return function(el) {
    if (el.parentNode.nodeType !== 1) return;

    var rel = find(el.parentNode)
      , pos = 0;

    while (rel) {
      if (test(rel, el)) pos++;
      if (rel === el) {
        pos -= offset;
        return group && pos
          ? !(pos % group) && (pos < 0 === group < 0)
          : !pos;
      }
      rel = advance(rel);
    }
  };
};

/**
 * Simple Selectors
 */

var selectors = {
  '*': (function() {
    if (function() {
      var el = document.createElement('div');
      el.appendChild(document.createComment(''));
      return !!el.getElementsByTagName('*')[0];
    }()) {
      return function(el) {
        if (el.nodeType === 1) return true;
      };
    }
    return function() {
      return true;
    };
  })(),
  'type': function(type) {
    type = type.toLowerCase();
    return function(el) {
      return el.nodeName.toLowerCase() === type;
    };
  },
  'attr': function(key, op, val, i) {
    op = operators[op];
    return function(el) {
      var attr;
      switch (key) {
        case 'for':
          attr = el.htmlFor;
          break;
        case 'class':
          // className is '' when non-existent
          // getAttribute('class') is null
          attr = el.className;
          if (attr === '' && el.getAttribute('class') == null) {
            attr = null;
          }
          break;
        case 'href':
          attr = el.getAttribute('href', 2);
          break;
        case 'title':
          // getAttribute('title') can be '' when non-existent sometimes?
          attr = el.getAttribute('title') || null;
          break;
        case 'id':
          if (el.getAttribute) {
            attr = el.getAttribute('id');
            break;
          }
        default:
          attr = el[key] != null
            ? el[key]
            : el.getAttribute && el.getAttribute(key);
          break;
      }
      if (attr == null) return;
      attr = attr + '';
      if (i) {
        attr = attr.toLowerCase();
        val = val.toLowerCase();
      }
      return op(attr, val);
    };
  },
  ':first-child': function(el) {
    return !prev(el) && el.parentNode.nodeType === 1;
  },
  ':last-child': function(el) {
    return !next(el) && el.parentNode.nodeType === 1;
  },
  ':only-child': function(el) {
    return !prev(el) && !next(el)
      && el.parentNode.nodeType === 1;
  },
  ':nth-child': function(param, last) {
    return nth(param, function() {
      return true;
    }, last);
  },
  ':nth-last-child': function(param) {
    return selectors[':nth-child'](param, true);
  },
  ':root': function(el) {
    return el.ownerDocument.documentElement === el;
  },
  ':empty': function(el) {
    return !el.firstChild;
  },
  ':not': function(sel) {
    var test = compileGroup(sel);
    return function(el) {
      return !test(el);
    };
  },
  ':first-of-type': function(el) {
    if (el.parentNode.nodeType !== 1) return;
    var type = el.nodeName;
    while (el = prev(el)) {
      if (el.nodeName === type) return;
    }
    return true;
  },
  ':last-of-type': function(el) {
    if (el.parentNode.nodeType !== 1) return;
    var type = el.nodeName;
    while (el = next(el)) {
      if (el.nodeName === type) return;
    }
    return true;
  },
  ':only-of-type': function(el) {
    return selectors[':first-of-type'](el)
        && selectors[':last-of-type'](el);
  },
  ':nth-of-type': function(param, last) {
    return nth(param, function(rel, el) {
      return rel.nodeName === el.nodeName;
    }, last);
  },
  ':nth-last-of-type': function(param) {
    return selectors[':nth-of-type'](param, true);
  },
  ':checked': function(el) {
    return !!(el.checked || el.selected);
  },
  ':indeterminate': function(el) {
    return !selectors[':checked'](el);
  },
  ':enabled': function(el) {
    return !el.disabled && el.type !== 'hidden';
  },
  ':disabled': function(el) {
    return !!el.disabled;
  },
  ':target': function(el) {
    return el.id === window.location.hash.substring(1);
  },
  ':focus': function(el) {
    return el === el.ownerDocument.activeElement;
  },
  ':matches': function(sel) {
    return compileGroup(sel);
  },
  ':nth-match': function(param, last) {
    var args = param.split(/\s*,\s*/)
      , arg = args.shift()
      , test = compileGroup(args.join(','));

    return nth(arg, test, last);
  },
  ':nth-last-match': function(param) {
    return selectors[':nth-match'](param, true);
  },
  ':links-here': function(el) {
    return el + '' === window.location + '';
  },
  ':lang': function(param) {
    return function(el) {
      while (el) {
        if (el.lang) return el.lang.indexOf(param) === 0;
        el = el.parentNode;
      }
    };
  },
  ':dir': function(param) {
    return function(el) {
      while (el) {
        if (el.dir) return el.dir === param;
        el = el.parentNode;
      }
    };
  },
  ':scope': function(el, con) {
    var context = con || el.ownerDocument;
    if (context.nodeType === 9) {
      return el === context.documentElement;
    }
    return el === context;
  },
  ':any-link': function(el) {
    return typeof el.href === 'string';
  },
  ':local-link': function(el) {
    if (el.nodeName) {
      return el.href && el.host === window.location.host;
    }
    var param = +el + 1;
    return function(el) {
      if (!el.href) return;

      var url = window.location + ''
        , href = el + '';

      return truncateUrl(url, param) === truncateUrl(href, param);
    };
  },
  ':default': function(el) {
    return !!el.defaultSelected;
  },
  ':valid': function(el) {
    return el.willValidate || (el.validity && el.validity.valid);
  },
  ':invalid': function(el) {
    return !selectors[':valid'](el);
  },
  ':in-range': function(el) {
    return el.value > el.min && el.value <= el.max;
  },
  ':out-of-range': function(el) {
    return !selectors[':in-range'](el);
  },
  ':required': function(el) {
    return !!el.required;
  },
  ':optional': function(el) {
    return !el.required;
  },
  ':read-only': function(el) {
    if (el.readOnly) return true;

    var attr = el.getAttribute('contenteditable')
      , prop = el.contentEditable
      , name = el.nodeName.toLowerCase();

    name = name !== 'input' && name !== 'textarea';

    return (name || el.disabled) && attr == null && prop !== 'true';
  },
  ':read-write': function(el) {
    return !selectors[':read-only'](el);
  },
  ':hover': function() {
    throw new Error(':hover is not supported.');
  },
  ':active': function() {
    throw new Error(':active is not supported.');
  },
  ':link': function() {
    throw new Error(':link is not supported.');
  },
  ':visited': function() {
    throw new Error(':visited is not supported.');
  },
  ':column': function() {
    throw new Error(':column is not supported.');
  },
  ':nth-column': function() {
    throw new Error(':nth-column is not supported.');
  },
  ':nth-last-column': function() {
    throw new Error(':nth-last-column is not supported.');
  },
  ':current': function() {
    throw new Error(':current is not supported.');
  },
  ':past': function() {
    throw new Error(':past is not supported.');
  },
  ':future': function() {
    throw new Error(':future is not supported.');
  },
  // Non-standard, for compatibility purposes.
  ':contains': function(param) {
    return function(el) {
      var text = el.innerText || el.textContent || el.value || '';
      return !!~text.indexOf(param);
    };
  },
  ':has': function(param) {
    return function(el) {
      return zest(param, el).length > 0;
    };
  }
  // Potentially add more pseudo selectors for
  // compatibility with sizzle and most other
  // selector engines (?).
};

/**
 * Attribute Operators
 */

var operators = {
  '-': function() {
    return true;
  },
  '=': function(attr, val) {
    return attr === val;
  },
  '*=': function(attr, val) {
    return attr.indexOf(val) !== -1;
  },
  '~=': function(attr, val) {
    var i = attr.indexOf(val)
      , f
      , l;

    if (i === -1) return;
    f = attr[i - 1];
    l = attr[i + val.length];

    return (!f || f === ' ') && (!l || l === ' ');
  },
  '|=': function(attr, val) {
    var i = attr.indexOf(val)
      , l;

    if (i !== 0) return;
    l = attr[i + val.length];

    return l === '-' || !l;
  },
  '^=': function(attr, val) {
    return attr.indexOf(val) === 0;
  },
  '$=': function(attr, val) {
    return attr.indexOf(val) + val.length === attr.length;
  },
  // non-standard
  '!=': function(attr, val) {
    return attr !== val;
  }
};

/**
 * Combinator Logic
 */

var combinators = {
  ' ': function(test) {
    return function(el) {
      while (el = el.parentNode) {
        if (test(el)) return el;
      }
    };
  },
  '>': function(test) {
    return function(el) {
      return test(el = el.parentNode) && el;
    };
  },
  '+': function(test) {
    return function(el) {
      return test(el = prev(el)) && el;
    };
  },
  '~': function(test) {
    return function(el) {
      while (el = prev(el)) {
        if (test(el)) return el;
      }
    };
  },
  'noop': function(test) {
    return function(el) {
      return test(el) && el;
    };
  },
  'ref': function(test, name) {
    var node;

    function ref(el) {
      var doc = el.ownerDocument
        , nodes = doc.getElementsByTagName('*')
        , i = nodes.length;

      while (i--) {
        node = nodes[i];
        if (ref.test(el)) {
          node = null;
          return true;
        }
      }

      node = null;
    }

    ref.combinator = function(el) {
      if (!node || !node.getAttribute) return;

      var attr = node.getAttribute(name) || '';
      if (attr[0] === '#') attr = attr.substring(1);

      if (attr === el.id && test(node)) {
        return node;
      }
    };

    return ref;
  }
};

/**
 * Grammar
 */

var rules = {
  qname: /^ *([\w\-]+|\*)/,
  simple: /^(?:([.#][\w\-]+)|pseudo|attr)/,
  ref: /^ *\/([\w\-]+)\/ */,
  combinator: /^(?: +([^ \w*]) +|( )+|([^ \w*]))(?! *$)/,
  attr: /^\[([\w\-]+)(?:([^\w]?=)(inside))?\]/,
  pseudo: /^(:[\w\-]+)(?:\((inside)\))?/,
  inside: /(?:"(?:\\"|[^"])*"|'(?:\\'|[^'])*'|<[^"'>]*>|\\["'>]|[^"'>])*/
};

rules.inside = replace(rules.inside, '[^"\'>]*', rules.inside);
rules.attr = replace(rules.attr, 'inside', makeInside('\\[', '\\]'));
rules.pseudo = replace(rules.pseudo, 'inside', makeInside('\\(', '\\)'));
rules.simple = replace(rules.simple, 'pseudo', rules.pseudo);
rules.simple = replace(rules.simple, 'attr', rules.attr);

/**
 * Compiling
 */

var compile = function(sel) {
  var sel = sel.replace(/^\s+|\s+$/g, '')
    , test
    , filter = []
    , buff = []
    , subject
    , qname
    , cap
    , op
    , ref;

  while (sel) {
    if (cap = rules.qname.exec(sel)) {
      sel = sel.substring(cap[0].length);
      qname = cap[1];
      buff.push(tok(qname, true));
    } else if (cap = rules.simple.exec(sel)) {
      sel = sel.substring(cap[0].length);
      qname = '*';
      buff.push(tok(qname, true));
      buff.push(tok(cap));
    } else {
      throw new Error('Invalid selector.');
    }

    while (cap = rules.simple.exec(sel)) {
      sel = sel.substring(cap[0].length);
      buff.push(tok(cap));
    }

    if (sel[0] === '!') {
      sel = sel.substring(1);
      subject = makeSubject();
      subject.qname = qname;
      buff.push(subject.simple);
    }

    if (cap = rules.ref.exec(sel)) {
      sel = sel.substring(cap[0].length);
      ref = combinators.ref(makeSimple(buff), cap[1]);
      filter.push(ref.combinator);
      buff = [];
      continue;
    }

    if (cap = rules.combinator.exec(sel)) {
      sel = sel.substring(cap[0].length);
      op = cap[1] || cap[2] || cap[3];
      if (op === ',') {
        filter.push(combinators.noop(makeSimple(buff)));
        break;
      }
    } else {
      op = 'noop';
    }

    filter.push(combinators[op](makeSimple(buff)));
    buff = [];
  }

  test = makeTest(filter);
  test.qname = qname;
  test.sel = sel;

  if (subject) {
    subject.lname = test.qname;

    subject.test = test;
    subject.qname = subject.qname;
    subject.sel = test.sel;
    test = subject;
  }

  if (ref) {
    ref.test = test;
    ref.qname = test.qname;
    ref.sel = test.sel;
    test = ref;
  }

  return test;
};

var tok = function(cap, qname) {
  // qname
  if (qname) {
    return cap === '*'
      ? selectors['*']
      : selectors.type(cap);
  }

  // class/id
  if (cap[1]) {
    return cap[1][0] === '.'
      ? selectors.attr('class', '~=', cap[1].substring(1))
      : selectors.attr('id', '=', cap[1].substring(1));
  }

  // pseudo-name
  // inside-pseudo
  if (cap[2]) {
    return cap[3]
      ? selectors[cap[2]](unquote(cap[3]))
      : selectors[cap[2]];
  }

  // attr name
  // attr op
  // attr value
  if (cap[4]) {
    var i;
    if (cap[6]) {
      i = cap[6].length;
      cap[6] = cap[6].replace(/ +i$/, '');
      i = i > cap[6].length;
    }
    return selectors.attr(cap[4], cap[5] || '-', unquote(cap[6]), i);
  }

  throw new Error('Unknown Selector.');
};

var makeSimple = function(func) {
  var l = func.length
    , i;

  // Potentially make sure
  // `el` is truthy.
  if (l < 2) return func[0];

  return function(el) {
    if (!el) return;
    for (i = 0; i < l; i++) {
      if (!func[i](el)) return;
    }
    return true;
  };
};

var makeTest = function(func) {
  if (func.length < 2) {
    return function(el) {
      return !!func[0](el);
    };
  }
  return function(el) {
    var i = func.length;
    while (i--) {
      if (!(el = func[i](el))) return;
    }
    return true;
  };
};

var makeSubject = function() {
  var target;

  function subject(el) {
    var node = el.ownerDocument
      , scope = node.getElementsByTagName(subject.lname)
      , i = scope.length;

    while (i--) {
      if (subject.test(scope[i]) && target === el) {
        target = null;
        return true;
      }
    }

    target = null;
  }

  subject.simple = function(el) {
    target = el;
    return true;
  };

  return subject;
};

var compileGroup = function(sel) {
  var test = compile(sel)
    , tests = [ test ];

  while (test.sel) {
    test = compile(test.sel);
    tests.push(test);
  }

  if (tests.length < 2) return test;

  return function(el) {
    var l = tests.length
      , i = 0;

    for (; i < l; i++) {
      if (tests[i](el)) return true;
    }
  };
};

/**
 * Selection
 */

var find = function(sel, node) {
  var results = []
    , test = compile(sel)
    , scope = node.getElementsByTagName(test.qname)
    , i = 0
    , el;

  while (el = scope[i++]) {
    if (test(el)) results.push(el);
  }

  if (test.sel) {
    while (test.sel) {
      test = compile(test.sel);
      scope = node.getElementsByTagName(test.qname);
      i = 0;
      while (el = scope[i++]) {
        if (test(el) && !~indexOf.call(results, el)) {
          results.push(el);
        }
      }
    }
    results.sort(order);
  }

  return results;
};

/**
 * Native
 */

var select = (function() {
  var slice = (function() {
    try {
      Array.prototype.slice.call(document.getElementsByTagName('zest'));
      return Array.prototype.slice;
    } catch(e) {
      e = null;
      return function() {
        var a = [], i = 0, l = this.length;
        for (; i < l; i++) a.push(this[i]);
        return a;
      };
    }
  })();

  if (document.querySelectorAll) {
    return function(sel, node) {
      try {
        return slice.call(node.querySelectorAll(sel));
      } catch(e) {
        return find(sel, node);
      }
    };
  }

  return function(sel, node) {
    try {
      if (sel[0] === '#' && /^#[\w\-]+$/.test(sel)) {
        return [node.getElementById(sel.substring(1))];
      }
      if (sel[0] === '.' && /^\.[\w\-]+$/.test(sel)) {
        sel = node.getElementsByClassName(sel.substring(1));
        return slice.call(sel);
      }
      if (/^[\w\-]+$/.test(sel)) {
        return slice.call(node.getElementsByTagName(sel));
      }
    } catch(e) {
      ;
    }
    return find(sel, node);
  };
})();

/**
 * Zest
 */

var zest = function(sel, node) {
  try {
    sel = select(sel, node || document);
  } catch(e) {
    if (window.ZEST_DEBUG) {
      console.log(e.stack || e + '');
    }
    sel = [];
  }
  return sel;
};

/**
 * Expose
 */

zest.selectors = selectors;
zest.operators = operators;
zest.combinators = combinators;
zest.compile = compileGroup;

zest.matches = function(el, sel) {
  return !!compileGroup(sel)(el);
};

zest.cache = function() {
  if (compile.raw) return;

  var raw = compile
    , cache = {};

  compile = function(sel) {
    return cache[sel]
      || (cache[sel] = raw(sel));
  };

  compile.raw = raw;
  zest._cache = cache;
};

zest.noCache = function() {
  if (!compile.raw) return;
  compile = compile.raw;
  delete zest._cache;
};

zest.noConflict = function() {
  window.zest = old;
  return zest;
};

zest.noNative = function() {
  select = find;
};

if (typeof module !== 'undefined') {
  module.exports = zest;
} else {
  this.zest = zest;
}

if (window.ZEST_DEBUG) {
  zest.noNative();
} else {
  zest.cache();
}

}).call(function() {
  return this || (typeof window !== 'undefined' ? window : global);
}());

/*!
  * Reqwest! A general purpose XHR connection manager
  * (c) Dustin Diaz 2011
  * https://github.com/ded/reqwest
  * license MIT
  */
!function (name, definition) {
  if (typeof module != 'undefined') module.exports = definition()
  else if (typeof define == 'function' && define.amd) define(name, definition)
  else this[name] = definition()
}('reqwest', function () {

  var context = this
    , win = window
    , doc = document
    , old = context.reqwest
    , twoHundo = /^20\d$/
    , byTag = 'getElementsByTagName'
    , readyState = 'readyState'
    , contentType = 'Content-Type'
    , requestedWith = 'X-Requested-With'
    , head = doc[byTag]('head')[0]
    , uniqid = 0
    , lastValue // data stored by the most recent JSONP callback
    , xmlHttpRequest = 'XMLHttpRequest'
    , isArray = typeof Array.isArray == 'function' ? Array.isArray : function (a) {
        return a instanceof Array
      }
    , defaultHeaders = {
          contentType: 'application/x-www-form-urlencoded'
        , accept: {
              '*':  'text/javascript, text/html, application/xml, text/xml, */*'
            , xml:  'application/xml, text/xml'
            , html: 'text/html'
            , text: 'text/plain'
            , json: 'application/json, text/javascript'
            , js:   'application/javascript, text/javascript'
          }
        , requestedWith: xmlHttpRequest
      }
    , xhr = win[xmlHttpRequest] ?
        function () {
          return new XMLHttpRequest()
        } :
        function () {
          return new ActiveXObject('Microsoft.XMLHTTP')
        }

  function handleReadyState(o, success, error) {
    return function () {
      if (o && o[readyState] == 4) {
        if (twoHundo.test(o.status)) {
          success(o)
        } else {
          error(o)
        }
      }
    }
  }

  function setHeaders(http, o) {
    var headers = o.headers || {}, h
    headers.Accept = headers.Accept || defaultHeaders.accept[o.type] || defaultHeaders.accept['*']
    // breaks cross-origin requests with legacy browsers
    if (!o.crossOrigin && !headers[requestedWith]) headers[requestedWith] = defaultHeaders.requestedWith
    if (!headers[contentType]) headers[contentType] = o.contentType || defaultHeaders.contentType
    for (h in headers) {
      headers.hasOwnProperty(h) && http.setRequestHeader(h, headers[h])
    }
  }

  function generalCallback(data) {
    lastValue = data
  }

  function urlappend(url, s) {
    return url + (/\?/.test(url) ? '&' : '?') + s
  }

  function handleJsonp(o, fn, err, url) {
    var reqId = uniqid++
      , cbkey = o.jsonpCallback || 'callback' // the 'callback' key
      , cbval = o.jsonpCallbackName || ('reqwest_' + reqId) // the 'callback' value
      , cbreg = new RegExp('((^|\\?|&)' + cbkey + ')=([^&]+)')
      , match = url.match(cbreg)
      , script = doc.createElement('script')
      , loaded = 0

    if (match) {
      if (match[3] === '?') {
        url = url.replace(cbreg, '$1=' + cbval) // wildcard callback func name
      } else {
        cbval = match[3] // provided callback func name
      }
    } else {
      url = urlappend(url, cbkey + '=' + cbval) // no callback details, add 'em
    }

    win[cbval] = generalCallback

    script.type = 'text/javascript'
    script.src = url
    script.async = true
    if (typeof script.onreadystatechange !== 'undefined') {
        // need this for IE due to out-of-order onreadystatechange(), binding script
        // execution to an event listener gives us control over when the script
        // is executed. See http://jaubourg.net/2010/07/loading-script-as-onclick-handler-of.html
        script.event = 'onclick'
        script.htmlFor = script.id = '_reqwest_' + reqId
    }

    script.onload = script.onreadystatechange = function () {
      if ((script[readyState] && script[readyState] !== 'complete' && script[readyState] !== 'loaded') || loaded) {
        return false
      }
      script.onload = script.onreadystatechange = null
      script.onclick && script.onclick()
      // Call the user callback with the last value stored and clean up values and scripts.
      o.success && o.success(lastValue)
      lastValue = undefined
      head.removeChild(script)
      loaded = 1
    }

    // Add the script to the DOM head
    head.appendChild(script)
  }

  function getRequest(o, fn, err) {
    var method = (o.method || 'GET').toUpperCase()
      , url = typeof o === 'string' ? o : o.url
      // convert non-string objects to query-string form unless o.processData is false
      , data = (o.processData !== false && o.data && typeof o.data !== 'string')
        ? reqwest.toQueryString(o.data)
        : (o.data || null)
      , http

    // if we're working on a GET request and we have data then we should append
    // query string to end of URL and not post data
    if ((o.type == 'jsonp' || method == 'GET') && data) {
      url = urlappend(url, data)
      data = null
    }

    if (o.type == 'jsonp') return handleJsonp(o, fn, err, url)

    http = xhr()
    http.open(method, url, true)
    setHeaders(http, o)
    http.onreadystatechange = handleReadyState(http, fn, err)
    o.before && o.before(http)
    http.send(data)
    return http
  }

  function Reqwest(o, fn) {
    this.o = o
    this.fn = fn
    init.apply(this, arguments)
  }

  function setType(url) {
    var m = url.match(/\.(json|jsonp|html|xml)(\?|$)/)
    return m ? m[1] : 'js'
  }

  function init(o, fn) {
    this.url = typeof o == 'string' ? o : o.url
    this.timeout = null
    var type = o.type || setType(this.url)
      , self = this
    fn = fn || function () {}

    if (o.timeout) {
      this.timeout = setTimeout(function () {
        self.abort()
      }, o.timeout)
    }

    function complete(resp) {
      o.timeout && clearTimeout(self.timeout)
      self.timeout = null
      o.complete && o.complete(resp)
    }

    function success(resp) {
      var r = resp.responseText
      if (r) {
        switch (type) {
        case 'json':
          try {
            resp = win.JSON ? win.JSON.parse(r) : eval('(' + r + ')')
          } catch (err) {
            return error(resp, 'Could not parse JSON in response', err)
          }
          break;
        case 'js':
          resp = eval(r)
          break;
        case 'html':
          resp = r
          break;
        }
      }

      fn(resp)
      o.success && o.success(resp)

      complete(resp)
    }

    function error(resp, msg, t) {
      o.error && o.error(resp, msg, t)
      complete(resp)
    }

    this.request = getRequest(o, success, error)
  }

  Reqwest.prototype = {
    abort: function () {
      this.request.abort()
    }

  , retry: function () {
      init.call(this, this.o, this.fn)
    }
  }

  function reqwest(o, fn) {
    return new Reqwest(o, fn)
  }

  // normalize newline variants according to spec -> CRLF
  function normalize(s) {
    return s ? s.replace(/\r?\n/g, '\r\n') : ''
  }

  function serial(el, cb) {
    var n = el.name
      , t = el.tagName.toLowerCase()
      , optCb = function(o) {
          // IE gives value="" even where there is no value attribute
          // 'specified' ref: http://www.w3.org/TR/DOM-Level-3-Core/core.html#ID-862529273
          if (o && !o.disabled)
            cb(n, normalize(o.attributes.value && o.attributes.value.specified ? o.value : o.text))
        }

    // don't serialize elements that are disabled or without a name
    if (el.disabled || !n) return;

    switch (t) {
    case 'input':
      if (!/reset|button|image|file/i.test(el.type)) {
        var ch = /checkbox/i.test(el.type)
          , ra = /radio/i.test(el.type)
          , val = el.value;
        // WebKit gives us "" instead of "on" if a checkbox has no value, so correct it here
        (!(ch || ra) || el.checked) && cb(n, normalize(ch && val === '' ? 'on' : val))
      }
      break;
    case 'textarea':
      cb(n, normalize(el.value))
      break;
    case 'select':
      if (el.type.toLowerCase() === 'select-one') {
        optCb(el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null)
      } else {
        for (var i = 0; el.length && i < el.length; i++) {
          el.options[i].selected && optCb(el.options[i])
        }
      }
      break;
    }
  }

  // collect up all form elements found from the passed argument elements all
  // the way down to child elements; pass a '<form>' or form fields.
  // called with 'this'=callback to use for serial() on each element
  function eachFormElement() {
    var cb = this
      , e, i, j
      , serializeSubtags = function(e, tags) {
        for (var i = 0; i < tags.length; i++) {
          var fa = e[byTag](tags[i])
          for (j = 0; j < fa.length; j++) serial(fa[j], cb)
        }
      }

    for (i = 0; i < arguments.length; i++) {
      e = arguments[i]
      if (/input|select|textarea/i.test(e.tagName)) serial(e, cb)
      serializeSubtags(e, [ 'input', 'select', 'textarea' ])
    }
  }

  // standard query string style serialization
  function serializeQueryString() {
    return reqwest.toQueryString(reqwest.serializeArray.apply(null, arguments))
  }

  // { 'name': 'value', ... } style serialization
  function serializeHash() {
    var hash = {}
    eachFormElement.apply(function (name, value) {
      if (name in hash) {
        hash[name] && !isArray(hash[name]) && (hash[name] = [hash[name]])
        hash[name].push(value)
      } else hash[name] = value
    }, arguments)
    return hash
  }

  // [ { name: 'name', value: 'value' }, ... ] style serialization
  reqwest.serializeArray = function () {
    var arr = []
    eachFormElement.apply(function(name, value) {
      arr.push({name: name, value: value})
    }, arguments)
    return arr
  }

  reqwest.serialize = function () {
    if (arguments.length === 0) return ''
    var opt, fn
      , args = Array.prototype.slice.call(arguments, 0)

    opt = args.pop()
    opt && opt.nodeType && args.push(opt) && (opt = null)
    opt && (opt = opt.type)

    if (opt == 'map') fn = serializeHash
    else if (opt == 'array') fn = reqwest.serializeArray
    else fn = serializeQueryString

    return fn.apply(null, args)
  }

  reqwest.toQueryString = function (o) {
    var qs = '', i
      , enc = encodeURIComponent
      , push = function (k, v) {
          qs += enc(k) + '=' + enc(v) + '&'
        }

    if (isArray(o)) {
      for (i = 0; o && i < o.length; i++) push(o[i].name, o[i].value)
    } else {
      for (var k in o) {
        if (!Object.hasOwnProperty.call(o, k)) continue;
        var v = o[k]
        if (isArray(v)) {
          for (i = 0; i < v.length; i++) push(k, v[i])
        } else push(k, o[k])
      }
    }

    // spaces should be + according to spec
    return qs.replace(/&$/, '').replace(/%20/g,'+')
  }

  // jQuery and Zepto compatibility, differences can be remapped here so you can call
  // .ajax.compat(options, callback)
  reqwest.compat = function (o, fn) {
    if (o) {
      o.type && (o.method = o.type) && delete o.type
      o.dataType && (o.type = o.dataType)
      o.jsonpCallback && (o.jsonpCallbackName = o.jsonpCallback) && delete o.jsonpCallback
      o.jsonp && (o.jsonpCallback = o.jsonp)
    }
    return new Reqwest(o, fn)
  }

  return reqwest
});

(function() {
  var SAFARI_CONTAINS_IS_BROKEN, version;

  if (/Safari/.test(navigator.userAgent)) {
    version = /WebKit\/(\S+)/.exec(navigator.userAgent);
    if (version && parseFloat(version) < 540) {
      SAFARI_CONTAINS_IS_BROKEN = true;
    }
  }

  (typeof window !== "undefined" && window !== null ? window : global).containsNode = function(parent, child) {
    if (parent === child) {
      return true;
    }
    if (parent.contains && !SAFARI_CONTAINS_IS_BROKEN) {
      return parent.contains(child);
    }
    if (parent.compareDocumentPosition) {
      return !!(parent.compareDocumentPosition(child) & 16);
    }
    while (child && parent !== child) {
      child = child.parentNode;
    }
    return child === parent;
  };

}).call(this);

(function() {
  Batman.extend(Batman.DOM, {
    querySelectorAll: function(node, selector) {
      return zest(selector, node);
    },
    querySelector: function(node, selector) {
      return zest(selector, node)[0];
    },
    setInnerHTML: function(node, html) {
      return node != null ? node.innerHTML = html : void 0;
    },
    containsNode: function(parent, child) {
      if (!child) {
        child = parent;
        parent = document.body;
      }
      return window.containsNode(parent, child);
    },
    textContent: function(node) {
      var _ref;
      return (_ref = node.textContent) != null ? _ref : node.innerText;
    },
    destroyNode: function(node) {
      var _ref;
      Batman.DOM.cleanupNode(node);
      return node != null ? (_ref = node.parentNode) != null ? _ref.removeChild(node) : void 0 : void 0;
    }
  });

  Batman.extend(Batman.Request.prototype, {
    _parseResponseHeaders: function(xhr) {
      var headers;
      return headers = xhr.getAllResponseHeaders().split('\n').reduce(function(acc, header) {
        var key, matches, value;
        if (matches = header.match(/([^:]*):\s*(.*)/)) {
          key = matches[1];
          value = matches[2];
          acc[key] = value;
        }
        return acc;
      }, {});
    },
    send: function(data) {
      var options, xhr, _ref,
        _this = this;
      if (data == null) {
        data = this.get('data');
      }
      this.fire('loading');
      options = {
        url: this.get('url'),
        method: this.get('method'),
        type: this.get('type'),
        headers: this.get('headers'),
        success: function(response) {
          _this.mixin({
            xhr: xhr,
            response: response,
            status: typeof xhr !== "undefined" && xhr !== null ? xhr.status : void 0,
            responseHeaders: _this._parseResponseHeaders(xhr)
          });
          return _this.fire('success', response);
        },
        error: function(xhr) {
          _this.mixin({
            xhr: xhr,
            response: xhr.responseText || xhr.content,
            status: xhr.status,
            responseHeaders: _this._parseResponseHeaders(xhr)
          });
          xhr.request = _this;
          return _this.fire('error', xhr);
        },
        complete: function() {
          return _this.fire('loaded');
        }
      };
      if ((_ref = options.method) === 'PUT' || _ref === 'POST') {
        if (this.hasFileUploads()) {
          options.data = this.constructor.objectToFormData(data);
        } else {
          options.contentType = this.get('contentType');
          options.data = Batman.URI.queryFromParams(data);
        }
      } else {
        options.data = data;
      }
      return xhr = (reqwest(options)).request;
    }
  });

}).call(this);

(function() {
  Batman.Request.setupMockedResponse = function() {
    return Batman.Request.mockedResponses = {};
  };

  Batman.Request.addMockedResponse = function(method, url, callback) {
    var _base, _name;
    (_base = Batman.Request.mockedResponses)[_name = "" + method + "::" + url] || (_base[_name] = []);
    return Batman.Request.mockedResponses["" + method + "::" + url].push(callback);
  };

  Batman.Request.fetchMockedResponse = function(method, url) {
    var callback, callbackList, _ref;
    callbackList = (_ref = Batman.Request.mockedResponses) != null ? _ref["" + method + "::" + url] : void 0;
    if (!callbackList || callbackList.length === 0) {
      return;
    }
    callback = callbackList.pop();
    return callback();
  };

  Batman.Request.prototype.send = function(data) {
    var beforeResponse, mockedResponse, response, responseHeaders, status;
    data || (data = this.get('data'));
    this.fire('loading');
    mockedResponse = Batman.Request.fetchMockedResponse(this.get('method'), this.get('url'));
    if (!mockedResponse) {
      return;
    }
    status = mockedResponse.status, response = mockedResponse.response, beforeResponse = mockedResponse.beforeResponse, responseHeaders = mockedResponse.responseHeaders;
    this.mixin({
      status: status || 200,
      response: JSON.stringify(response),
      responseHeaders: responseHeaders || {}
    });
    if (typeof beforeResponse === "function") {
      beforeResponse(this, data);
    }
    if (this.status < 400) {
      this.fire('success', response);
    } else {
      this.fire('error', {
        response: response,
        status: this.status,
        request: this
      });
    }
    return this.fire('loaded');
  };

  Batman.setImmediate = function(fn) {
    return setTimeout(fn, 0);
  };

  Batman.clearImmediate = function(handle) {
    return clearTimeout(handle);
  };

}).call(this);

(function() {
  Batman.ModelExpectations = {
    expectCreate: function(instance, options) {
      var _this = this;
      if (options == null) {
        options = {};
      }
      this.addExpectation('expectCreate');
      this.assert(instance.isNew(), "Expected " + instance.constructor.name + " to be new when saving");
      return this.stub(instance, 'save', function(callback) {
        var _ref;
        _this.completeExpectation('expectCreate');
        return callback(options.error, (_ref = options.response) != null ? _ref : instance);
      });
    },
    expectUpdate: function(instance, options) {
      var _this = this;
      if (options == null) {
        options = {};
      }
      this.addExpectation('expectUpdate');
      this.assert(!instance.isNew(), "Expected " + instance.constructor.name + " to exist when saving");
      return this.stub(instance, 'save', function(callback) {
        var _ref;
        _this.completeExpectation('expectUpdate');
        return callback(options.error, (_ref = options.response) != null ? _ref : instance);
      });
    },
    expectDestroy: function(instance, options) {
      var _this = this;
      if (options == null) {
        options = {};
      }
      this.addExpectation('expectDestroy');
      return this.stub(instance, 'destroy', function(callback) {
        var _ref;
        _this.completeExpectation('expectDestroy');
        return callback(options.error, (_ref = options.response) != null ? _ref : instance);
      });
    },
    expectLoad: function(klass, options) {
      var _this = this;
      if (options == null) {
        options = {};
      }
      this.addExpectation('expectLoad');
      return this.stub(klass, 'load', function(innerParams, callback) {
        var _ref;
        if ((_ref = typeof innerParams) === 'function' || _ref === 'undefined') {
          callback = innerParams;
        }
        if (options.params != null) {
          _this.assertEqual(options.params, innerParams);
        }
        _this.completeExpectation('expectLoad');
        return typeof callback === "function" ? callback(options.error, options.response) : void 0;
      });
    },
    expectFind: function(klass, options) {
      var _this = this;
      if (options == null) {
        options = {};
      }
      this.addExpectation('expectFind');
      return this.stub(klass, 'find', function(innerParams, callback) {
        var _ref;
        if ((_ref = typeof innerParams) === 'function' || _ref === 'undefined') {
          callback = innerParams;
        }
        if (options.params != null) {
          _this.assertEqual(options.params, innerParams);
        }
        _this.completeExpectation('expectFind');
        return typeof callback === "function" ? callback(options.error, options.response) : void 0;
      });
    }
  };

}).call(this);

(function() {
  var __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Batman.TestCase = (function(_super) {
    __extends(TestCase, _super);

    TestCase.Test = (function() {
      function Test(name, expected, testFunction) {
        this.name = name;
        this.expected = expected;
        this.testFunction = testFunction;
      }

      Test.prototype.run = function(testCase) {
        var wrappedTest;
        wrappedTest = sinon.test(this.testFunction).bind(testCase);
        wrappedTest = testCase.expectationsWrapper(wrappedTest);
        wrappedTest = testCase.xhrWrapper(wrappedTest);
        return QUnit.test(this.name, this.expected, wrappedTest);
      };

      return Test;

    })();

    TestCase.test = function(name, expected, testFunction) {
      if (typeof expected === 'function') {
        testFunction = expected;
        expected = null;
      }
      this.tests || (this.tests = []);
      return this.tests.push(new this.Test(name, expected, testFunction));
    };

    function TestCase() {
      this._expectations = {};
    }

    TestCase.prototype.runTests = function() {
      var desc, test, _ref, _results;
      QUnit.module(this.constructor.name, {
        setup: this.xhrWrapper(this.setup.bind(this)),
        teardown: this.xhrWrapper(this.teardown.bind(this))
      });
      _ref = this.constructor.tests;
      _results = [];
      for (desc in _ref) {
        test = _ref[desc];
        _results.push(test.run(this));
      }
      return _results;
    };

    TestCase.prototype.setup = function() {};

    TestCase.prototype.teardown = function() {};

    TestCase.prototype["continue"] = function() {
      return QUnit.start();
    };

    TestCase.prototype.wait = function() {
      return QUnit.stop();
    };

    TestCase.prototype.assert = function(assertion, message) {
      if (message == null) {
        message = 'was not true';
      }
      return QUnit.ok(assertion, message);
    };

    TestCase.prototype.assertEqual = function(expected, actual, message) {
      return QUnit.ok(this._areEquivalent(expected, actual), message || ("Expected: " + expected + " \nGot: " + actual));
    };

    TestCase.prototype.assertNotEqual = function(expected, actual, message) {
      return QUnit.ok(!this._areEquivalent(expected, actual), message || ("Value not expected to match: " + expected));
    };

    TestCase.prototype.assertMatch = function(expected, actual, message) {
      return QUnit.ok(expected.test(actual), message || ("Expected: " + expected + " \nGot: " + actual));
    };

    TestCase.prototype.assertNoMatch = function(expected, actual, message) {
      return QUnit.ok(!expected.test(actual), message || ("Value not expected to match: " + expected));
    };

    TestCase.prototype.assertDifference = function(expressions, difference, message, callback) {
      var before, e, error, i, _i, _len, _results;
      if (difference == null) {
        difference = 1;
      }
      if (Batman.typeOf(expressions) !== 'Array') {
        expressions = [expressions];
      }
      if (arguments.length === 2) {
        callback = difference;
        difference = 1;
      } else if (arguments.length === 3) {
        callback = message;
        message = null;
      }
      before = expressions.map(function(expression) {
        return eval(expression);
      });
      callback();
      _results = [];
      for (i = _i = 0, _len = expressions.length; _i < _len; i = ++_i) {
        e = expressions[i];
        error = "" + e + " didn't change by " + difference;
        if (message) {
          error = "" + message + ".\n" + error;
        }
        _results.push(this.assertEqual(before[i] + difference, eval(e), error));
      }
      return _results;
    };

    TestCase.prototype.assertNoDifference = function(expressions, message, callback) {
      if (arguments.length === 2) {
        callback = message;
        message = null;
      }
      return this.assertDifference(expressions, 0, message, callback);
    };

    TestCase.prototype.assertRaises = function(expected, callback, message) {
      return QUnit.raises(callback, expected, message);
    };

    TestCase.prototype.addExpectation = function(name) {
      if (this._expectations[name]) {
        return this._expectations[name]++;
      } else {
        return this._expectations[name] = 1;
      }
    };

    TestCase.prototype.stubAccessor = function(object, keypath, fn) {
      return sinon.sandbox.stub(object.property(keypath), 'getValue', fn);
    };

    TestCase.prototype.completeExpectation = function(name) {
      if (!this._expectations[name]) {
        return;
      }
      QUnit.ok(true, "Completed " + name);
      if (this._expectations[name] === 1) {
        return delete this._expectations[name];
      } else {
        return this._expectations[name]--;
      }
    };

    TestCase.prototype.verifyExpectations = function() {
      var count, key, _ref, _results;
      _ref = this._expectations;
      _results = [];
      for (key in _ref) {
        count = _ref[key];
        _results.push(QUnit.ok(false, "Expectation " + key + " did not callback " + count + " time(s)"));
      }
      return _results;
    };

    TestCase.prototype.clearExpectations = function() {
      return this._expectations = {};
    };

    TestCase.prototype.expectationsWrapper = function(fn) {
      var testCase;
      testCase = this;
      return function() {
        var results;
        testCase.clearExpectations();
        results = fn.apply(this, arguments);
        testCase.verifyExpectations();
        return results;
      };
    };

    TestCase.prototype.xhrWrapper = function(fn) {
      return function() {
        Batman.Request.setupMockedResponse();
        return fn.apply(this, arguments);
      };
    };

    TestCase.prototype.assertGET = function(url, params) {
      return this._assertXHR('GET', url, params);
    };

    TestCase.prototype.assertPOST = function(url, params) {
      return this._assertXHR('POST', url, params);
    };

    TestCase.prototype.assertPUT = function(url, params) {
      return this._assertXHR('PUT', url, params);
    };

    TestCase.prototype.assertDELETE = function(url, params) {
      return this._assertXHR('DELETE', url, params);
    };

    TestCase.prototype._assertXHR = function(method, url, params) {
      var id,
        _this = this;
      id = "" + method + " to " + url;
      this.addExpectation(id);
      return Batman.Request.addMockedResponse(method, url, function() {
        _this.completeExpectation(id);
        params || (params = {});
        params.status || (params.status = 200);
        params.response || (params.response = {});
        return params;
      });
    };

    TestCase.prototype._unwrapStringOrNumber = function(obj) {
      if (obj instanceof Number || obj instanceof String) {
        return obj.valueOf();
      }
      return obj;
    };

    TestCase.prototype._areEquivalent = function(a, b) {
      var newA, newB, prop, tmp;
      a = this._unwrapStringOrNumber(a);
      b = this._unwrapStringOrNumber(b);
      if (a === b) {
        return true;
      }
      if (a === null || b === null || typeof a !== typeof b) {
        return false;
      }
      if (a instanceof Date) {
        return b instanceof Date && a.valueOf() === b.valueOf();
      }
      if (typeof a !== "object") {
        return a === b;
      }
      newA = a.areEquivalent_Eq_91_2_34 === void 0;
      newB = b.areEquivalent_Eq_91_2_34 === void 0;
      try {
        if (newA) {
          a.areEquivalent_Eq_91_2_34 = [];
        } else if (a.areEquivalent_Eq_91_2_34.some(function(other) {
          return other === b;
        })) {
          return true;
        }
        if (newB) {
          b.areEquivalent_Eq_91_2_34 = [];
        } else if (b.areEquivalent_Eq_91_2_34.some(function(other) {
          return other === a;
        })) {
          return true;
        }
        a.areEquivalent_Eq_91_2_34.push(b);
        b.areEquivalent_Eq_91_2_34.push(a);
        tmp = {};
        for (prop in a) {
          if (prop !== "areEquivalent_Eq_91_2_34") {
            tmp[prop] = null;
          }
        }
        for (prop in b) {
          if (prop !== "areEquivalent_Eq_91_2_34") {
            tmp[prop] = null;
          }
        }
        for (prop in tmp) {
          if (!this._areEquivalent(a[prop], b[prop])) {
            return false;
          }
        }
        return true;
      } finally {
        if (newA) {
          delete a.areEquivalent_Eq_91_2_34;
        }
        if (newB) {
          delete b.areEquivalent_Eq_91_2_34;
        }
      }
    };

    return TestCase;

  })(Batman.Object);

  (function() {
    var originalPush, parseActual, parseExpected;
    originalPush = QUnit.push;
    parseExpected = function(exp) {
      return "\x1B[32m" + (QUnit.jsDump.parse(exp)) + "\x1B[39m";
    };
    parseActual = function(act) {
      return "\x1B[31m" + (QUnit.jsDump.parse(act)) + "\x1B[39m";
    };
    return QUnit.push = function(result, actual, expected, message) {
      message || (message = "" + (parseExpected(expected)) + " expected but was " + (parseActual(actual)));
      return originalPush.call(QUnit, result, actual, expected, message);
    };
  })();

}).call(this);

(function() {
  var _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  Batman.ModelTestCase = (function(_super) {
    __extends(ModelTestCase, _super);

    function ModelTestCase() {
      _ref = ModelTestCase.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    ModelTestCase.mixin(Batman.ModelExpectations);

    ModelTestCase.prototype.assertValid = function(model, message) {
      var _this = this;
      if (message == null) {
        message = "" + model + " expected to be valid";
      }
      return model.validate(function(_, err) {
        return _this.assert(err.length === 0, message);
      });
    };

    ModelTestCase.prototype.assertNotValid = function(model, message) {
      var _this = this;
      if (message == null) {
        message = "" + model + " expected to be not valid";
      }
      return model.validate(function(_, err) {
        return _this.assert(err.length > 0, message);
      });
    };

    ModelTestCase.prototype.assertDecoders = function() {
      var decoders, keys, modelClass;
      modelClass = arguments[0], keys = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      decoders = [];
      modelClass.prototype._batman.get("encoders").forEach(function(key, encoder) {
        if (encoder.decode) {
          return decoders.push(key);
        }
      });
      return this.assertEqual(keys.sort(), decoders.sort());
    };

    ModelTestCase.prototype.assertEncoders = function() {
      var encoders, keys, modelClass;
      modelClass = arguments[0], keys = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      encoders = [];
      modelClass.prototype._batman.get("encoders").forEach(function(key, encoder) {
        if (encoder.encode) {
          return encoders.push(key);
        }
      });
      return this.assertEqual(keys.sort(), encoders.sort());
    };

    ModelTestCase.prototype.assertEncoded = function(model, key, expected) {
      var value;
      value = model.toJSON()[key];
      if (typeof expected === 'function') {
        return this.assert(expected(value));
      } else {
        return this.assertEqual(expected, value);
      }
    };

    return ModelTestCase;

  })(Batman.TestCase);

}).call(this);

(function() {
  var _ref,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  Batman.ControllerTestCase = (function(_super) {
    __extends(ControllerTestCase, _super);

    function ControllerTestCase() {
      _ref = ControllerTestCase.__super__.constructor.apply(this, arguments);
      return _ref;
    }

    ControllerTestCase.mixin(Batman.ModelExpectations);

    ControllerTestCase.prototype.dispatch = function(action, params) {
      var actionRoutes, controllerName, currentView, div, e, namedRoute, routeMap, _i, _len, _ref1,
        _this = this;
      if (params == null) {
        params = {};
      }
      this.controllerClass || (this.controllerClass = Batman.currentApp[this.constructor.name.replace(/Test/, '')]);
      if (!this.controllerClass) {
        throw new Error("Unable to deduce controller class name from test class. Please set @controllerClass if not conventional");
      }
      this.controller = params.controller || new this.controllerClass;
      controllerName = Batman.helpers.camelize(this.controllerClass.name.replace(/Controller/, ''), true);
      routeMap = Batman.currentApp.get('routes.routeMap');
      actionRoutes = routeMap.childrenByOrder.filter(function(route) {
        return route.controller === controllerName && route.action === action;
      });
      if (actionRoutes.length === 0) {
        this.assert(false, "Route doesn't exist for action");
        return;
      }
      if (actionRoutes[0].namedArguments.length > 0) {
        this.assert(params.params, 'params are required for action');
      }
      _ref1 = actionRoutes[0].namedArguments;
      for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
        namedRoute = _ref1[_i];
        this.assert(namedRoute in params.params, 'named argument mismatch');
      }
      this.assertEqual('function', typeof this.controller[action], "Action: " + action + " doesn't exist!");
      try {
        this.controller.dispatch(action, params.params);
        currentView = this.controller.get('currentView');
        this.assert(currentView.get('html'), "No HTML for view");
        div = document.createElement('div');
        document.body.appendChild(div);
        currentView.get('node');
        currentView.addToParentNode(div);
        currentView.propagateToSubviews('viewWillAppear');
        currentView.initializeBindings();
        currentView.propagateToSubviews('isInDOM', true);
        currentView.propagateToSubviews('viewDidAppear');
      } catch (_error) {
        e = _error;
        this.assert(false, "exception was raised in view bindings: " + e.stack);
      } finally {
        if (div != null) {
          document.body.removeChild(div);
        }
      }
      return null;
    };

    return ControllerTestCase;

  })(Batman.TestCase);

}).call(this);

(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var Directives = require('./directives');

function DirectivesManager (el) {
  this.el = el;
  this.directives = {};
  this.patchIndex = {};

  this.queryMap(Directives.ShowDirective);
  this.queryMap(Directives.TextDirective);
  this.queryMap(Directives.ClassDirective);
  this.queryMap(Directives.AttributesDirective);
}

var Proto = DirectivesManager.prototype;

Proto.queryMap = function (cls) {
  var attr = cls.prototype.attribute;
  Array.prototype.forEach.call(
    this.el.querySelectorAll('[' + attr + ']'), function (el) {
      var directive = new cls(el);

      this.directives[attr] = this.directives[attr] || [];
      this.directives[attr].push(directive);

      directive.getNames().forEach(function (name) {
        this.patchIndex[name] = this.patchIndex[name] || [];
        this.patchIndex[name].push(directive);
      }.bind(this));
    }.bind(this));
};

Proto.patch = function (key, state) {
  // console.log('patch', key, state);
  if (this.patchIndex.hasOwnProperty(key)) {
    this.patchIndex[key].forEach(function (directive) {
      directive.update(state);
    });
  }
};

Proto.update = function (state) {
  // console.log('update', this.directives);
  Object.keys(this.directives).forEach(function (key) {
    this.directives[key].forEach(function (directive) {
      directive.update(state);
    });
  }.bind(this));
};

module.exports = DirectivesManager;

},{"./directives":2}],2:[function(require,module,exports){
var Parser = require('../expressions/parser').Parser;
var utils = require('../utils');

// Use one parser across directives to make use of the cache
var parser = new Parser();
parser.parse = parser.parse.bind(parser);
parser.parseObject = parser.parseObject.bind(parser);

function Directive (el) {
  this.el = el;
  this.attributeValue = this.el.getAttribute(this.attribute);
  this.expression = this.parse(this.attributeValue);

  /**
   * @return {Array[String]} names of access members
   */
  this.getNames = function () {
    return this.expression.accessScopeNames;
  }
}

function ObjectDirective () {
  this.parse = parser.parseObject;
  Directive.apply(this, arguments);

  this.update = function (state) {
    var matchedObject = this.expression.eval(state);

    Object.keys(matchedObject).forEach(function (key) {
      this.toggleMethod(this.el, key, matchedObject[key]);
    }.bind(this));
  };
}

function AttributesDirective () {
  this.toggleMethod = utils.toggleAttribute;
  ObjectDirective.apply(this, arguments);
}
AttributesDirective.prototype.attribute = 'sf-attributes';

function ClassDirective () {
  this.toggleMethod = utis.toggleClass;
  ObjectDirective.apply(this, arguments);
}
ObjectDirective.prototype.attribute = 'sf-class';

function ShowDirective () {
  this.parse = parser.parse;
  Directive.apply(this, arguments);

  this.update = function (state) {
    if (!!this.expression.eval(state)) {
      this.el.style.display = '';
    } else {
      this.el.style.display = 'none';
    }
  };
}
ShowDirective.prototype.attribute = 'sf-show';

function TextDirective () {
  this.parse = parser.parse;
  Directive.apply(this, arguments);

  this.update = function (state) {
    this.el.innerHTML = this.expression.eval(state);
  }
}
TextDirective.prototype.attribute = 'sf-text';

module.exports = {
  Directive: Directive,
  ObjectDirective: ObjectDirective,
  AttributesDirective: AttributesDirective,
  ClassDirective: ClassDirective,
  ShowDirective: ShowDirective,
  TextDirective: TextDirective,
};

},{"../expressions/parser":5,"../utils":14}],3:[function(require,module,exports){
/**
 * @param {String} operation
 * @param {Expression} leftExp
 * @param {Expression} rightExp
 */
function Binary (operation, leftExp, rightExp) {
  this.eval = function (scope) {
    var left = leftExp.eval(scope);

    switch (operation) {
      case '&&': return !!left && !!rightExp.eval(scope);
      case '||': return !!left || !!rightExp.eval(scope);
    }

    var right = rightExp.eval(scope);

    // Null check for the operations.
    if (left == null || right == null) {
      switch (operation) {
        case '+':
          if (left != null) return left;
          if (right != null) return right;
          return 0;
        case '-':
          if (left != null) return left;
          if (right != null) return 0 - right;
          return 0;
      }

      return null;
    }

    switch (operation) {
      case '+'  : return autoConvertAdd(left, right);
      case '-'  : return left - right;
      case '*'  : return left * right;
      case '/'  : return left / right;
      case '~/' : return Math.floor(left / right);
      case '%'  : return left % right;
      case '==' : return left == right;
      case '!=' : return left != right;
      case '<'  : return left < right;
      case '>'  : return left > right;
      case '<=' : return left <= right;
      case '>=' : return left >= right;
      case '^'  : return left ^ right;
      case '&'  : return left & right;
    }

    throw new Error('Internal error [' + operation + '] not handled');
  };
}

/**
 * @param {Expression} object
 * @param {String} name
 */
function AccessMember (object, name) {
  this.eval = function (scope) {
    var instance = object.eval(scope);
    return instance == null ? null : instance[name];
  };
}

/**
 * @param {String} name
 */
function AccessScope (name) {
  this.eval = function (scope) {
    return scope[name];
  };
}

/**
 * @param {String} operation
 * @param {Expression} expression
 */
function PrefixNot (operation, expression) {
  this.eval = function (scope) {
    return !expression.eval(scope);
  };
}

function LiteralPrimitive (value) {
  this.eval = function (scope) {
    return value;
  };
}

/**
 * @param {Expression} condition
 * @param {Expression} yes
 * @param {Expresssion} no
 */
function Conditional (condition, yes, no) {
  this.eval = function (scope) {
    return (!!condition.eval(scope)) ? yes.eval(scope) : no.eval(scope);
  };
}

// Add the two arguments with automatic type conversion.
function autoConvertAdd(a, b) {
  if (a != null && b != null) {
    if (typeof a == 'string' && typeof b != 'string') {
      return a + b.toString();
    }

    if (typeof a != 'string' && typeof b == 'string') {
      return a.toString() + b;
    }

    return a + b;
  }

  if (a != null) {
    return a;
  }

  if (b != null) {
    return b;
  }

  return 0;
}

module.exports = {
  Binary: Binary,
  Conditional: Conditional,
  AccessMember: AccessMember,
  AccessScope: AccessScope,
  PrefixNot: PrefixNot,
  LiteralPrimitive: LiteralPrimitive
};

},{}],4:[function(require,module,exports){
/**
 * @param {Number} index
 * @param {String} text
 */
function Token (index, text) {
  this.index = index;
  this.text = text;
}

Token.prototype = {
  withOp: function (op) {
    this.opKey = op;
    return this;
  },
  withGetterSetter: function (key) {
    this.key = key;
    return this;
  },
  withValue: function (value) {
    this.value = value;
    return this;
  },
  toString: function () {
    return 'Token(' + this.text + ')';
  }
};

/**
 * @param {String} text
 * @return {Array} ArrayOfTokens
 */
function lex (text) {
  var scanner = new Scanner(text);
  var tokens = [];
  var token = scanner.scanToken();

  while (token) {
    tokens.push(token);
    token = scanner.scanToken();
  }

  return tokens;
}

/**
 * @param {String} input
 */
function Scanner (input) {
  this.input = input;
  this.length = input.length;
  this.peek = 0;
  this.index = -1;

  this.advance();
}

Scanner.prototype = {

  /**
   * @return {Token}
   */
  scanToken: function () {
      // Skip whitespace.
    while (this.peek <= $SPACE) {
      if (++this.index >= this.length) {
        this.peek = $EOF;
        return null;
      } else {
        this.peek = this.input.charCodeAt(this.index);
      }
    }

    // Handle identifiers and numbers.
    if (isIdentifierStart(this.peek)) {
      return this.scanIdentifier();
    }

    if (isDigit(this.peek)) {
      return this.scanNumber(this.index);
    }

    var start = this.index;

    switch (this.peek) {
      case $PERIOD:
        this.advance();
        return isDigit(this.peek) ? this.scanNumber(start) : new Token(start, '.');
      case $LPAREN:
      case $RPAREN:
      case $LBRACE:
      case $RBRACE:
      case $LBRACKET:
      case $RBRACKET:
      case $COMMA:
      case $COLON:
      case $SEMICOLON:
        return this.scanCharacter(start, String.fromCharCode(this.peek));
      case $SQ:
      case $DQ:
        return this.scanString();
      case $PLUS:
      case $MINUS:
      case $STAR:
      case $SLASH:
      case $PERCENT:
      case $CARET:
      case $QUESTION:
        return this.scanOperator(start, String.fromCharCode(this.peek));
      case $LT:
      case $GT:
      case $BANG:
      case $EQ:
        return this.scanComplexOperator(start, $EQ, String.fromCharCode(this.peek), '=');
      case $AMPERSAND:
        return this.scanComplexOperator(start, $AMPERSAND, '&', '&');
      case $BAR:
        return this.scanComplexOperator(start, $BAR, '|', '|');
      case $TILDE:
        return this.scanComplexOperator(start, $SLASH, '~', '/');
      case $NBSP:
        while (isWhitespace(this.peek)){
          this.advance();
        }

        return this.scanToken();
    }

    var character = String.fromCharCode(this.peek);
    this.error('Unexpected character [' + character + '}]');
    return null;
  },

  /**
   * @param {Number} string
   * @param {String} text
   * @return {Token}
   */
  scanCharacter: function (start, text) {
    assert(this.peek == text.charCodeAt(0));
    this.advance();
    return new Token(start, text);
  },

  /**
   * @param {Number} string
   * @param {String} text
   * @return {Token}
   */
  scanOperator: function (start, text) {
    assert(this.peek == text.charCodeAt(0));
    assert(OPERATORS.indexOf(text) != -1);
    this.advance();
    return new Token(start, text).withOp(text);
  },

  /**
   * @param {Number} start
   * @param {Number} code
   * @param {String} one
   * @param {String} two
   * @return {Token}
   */
  scanComplexOperator: function (start, code, one, two) {
    assert(this.peek == one.charCodeAt(0));
    this.advance();

    var text = one;

    if (this.peek == code) {
      this.advance();
      text += two;
    }

    assert(OPERATORS.indexOf(text) != -1);

    return new Token(start, text).withOp(text);
  },

  /**
   * @return {Token}
   */
  scanIdentifier: function () {
    var start = this.index;

    this.advance();

    while (isIdentifierPart(this.peek)) {
      this.advance();
    }

    var text = this.input.substring(start, this.index);
    var result = new Token(start, text);

    // TODO(kasperl): Deal with null, undefined, true, and false in
    // a cleaner and faster way.
    if (OPERATORS.indexOf(text) != -1) {
      result.withOp(text);
    } else {
      result.withGetterSetter(text);
    }

    return result;
  },

  /**
   * @param {String} start
   * @return {Token}
   */
  scanNumber: function (start) {
    var simple = (this.index == start);
    this.advance();  // Skip initial digit.

    while (true) {
      if (isDigit(this.peek)) {
        // Do nothing.
      } else if (this.peek == $PERIOD) {
        simple = false;
      } else if (isExponentStart(this.peek)) {
        this.advance();

        if (isExponentSign(this.peek)){
          this.advance();
        }

        if (!isDigit(this.peek)){
          this.error('Invalid exponent', -1);
        }

        simple = false;
      } else {
        break;
      }

      this.advance();
    }

    var text = this.input.substring(start, this.index);
    var value = simple ? parseInt(text) : parseFloat(text);
    return new Token(start, text).withValue(value);
  },

  /**
   * @return {Token}
   */
  scanString: function () {
    var start = this.index;
    var quote = this.peek;

    this.advance();  // Skip initial quote.

    var buffer;
    var marker = this.index;

    while (this.peek != quote) {
      if (this.peek == $BACKSLASH) {
        if (buffer == null) {
          buffer = [];
        }

        buffer.push(this.input.substring(marker, this.index));
        this.advance();

        var unescaped;

        if (this.peek == $u) {
          // TODO(kasperl): Check bounds? Make sure we have test
          // coverage for this.
          var hex = this.input.substring(this.index + 1, this.index + 5);

          if(!/[A-Z0-9]{4}/.test(hex)){
            this.error('Invalid unicode escape [\\u' + hex + ']');
          }

          unescaped = parseInt(hex, 16);

          for (var i = 0; i < 5; i++) {
            this.advance();
          }
        } else {
          unescaped = decodeURIComponent(this.peek);
          this.advance();
        }

        buffer.push(String.fromCharCode(unescaped));
        marker = this.index;
      } else if (this.peek == $EOF) {
        this.error('Unterminated quote');
      } else {
        this.advance();
      }
    }

    var last = this.input.substring(marker, this.index);
    this.advance();  // Skip terminating quote.
    var text = this.input.substring(start, this.index);

    // Compute the unescaped string value.
    var unescaped = last;

    if (buffer != null) {
      buffer.push(last);
      unescaped = buffer.join('');
    }

    return new Token(start, text).withValue(unescaped);
  },

  advance: function () {
    if (++this.index >= this.length){
      this.peek = $EOF;
    } else {
      this.peek = this.input.charCodeAt(this.index);
    }
  },

  /**
   * @param {String} message
   * @param {Number} offset
   */
  error: function (message, offset) {
    offset = offset || 0;
    var position = this.index + offset;
    throw new Error('Lexer Error: ' + message + ' at column ' + position + ' in expression [' + this.input + ']');
  }
};

var $EOF       = 0;
var $TAB       = 9;
var $LF        = 10;
var $VTAB      = 11;
var $FF        = 12;
var $CR        = 13;
var $SPACE     = 32;
var $BANG      = 33;
var $DQ        = 34;
var $$         = 36;
var $PERCENT   = 37;
var $AMPERSAND = 38;
var $SQ        = 39;
var $LPAREN    = 40;
var $RPAREN    = 41;
var $STAR      = 42;
var $PLUS      = 43;
var $COMMA     = 44;
var $MINUS     = 45;
var $PERIOD    = 46;
var $SLASH     = 47;
var $COLON     = 58;
var $SEMICOLON = 59;
var $LT        = 60;
var $EQ        = 61;
var $GT        = 62;
var $QUESTION  = 63;

var $0 = 48;
var $9 = 57;

var $A = 65;
var $E = 69;
var $Z = 90;

var $LBRACKET  = 91;
var $BACKSLASH = 92;
var $RBRACKET  = 93;
var $CARET     = 94;
var $_         = 95;

var $a = 97;
var $e = 101;
var $f = 102;
var $n = 110;
var $r = 114;
var $t = 116;
var $u = 117;
var $v = 118;
var $z = 122;

var $LBRACE = 123;
var $BAR    = 124;
var $RBRACE = 125;
var $TILDE  = 126;
var $NBSP   = 160;

var OPERATORS = [
  'undefined',
  'null',
  'true',
  'false',
  '+',
  '-',
  '*',
  '/',
  '~/',
  '%',
  '^',
  '=',
  '==',
  '!=',
  '<',
  '>',
  '<=',
  '>=',
  '&&',
  '||',
  '&',
  '|',
  '!',
  '?'
];

function isWhitespace(code) {
  return (code >= $TAB && code <= $SPACE) || (code == $NBSP);
}

function isIdentifierStart(code) {
  return ($a <= code && code <= $z)
      || ($A <= code && code <= $Z)
      || (code == $_)
      || (code == $$);
}

function isIdentifierPart(code) {
  return ($a <= code && code <= $z)
      || ($A <= code && code <= $Z)
      || ($0 <= code && code <= $9)
      || (code == $_)
      || (code == $$);
}

function isDigit(code) {
  return ($0 <= code && code <= $9);
}

function isExponentStart(code) {
  return (code == $e || code == $E);
}

function isExponentSign(code) {
  return (code == $MINUS || code == $PLUS);
}

function unescape(code) {
  switch(code) {
    case $n: return $LF;
    case $f: return $FF;
    case $r: return $CR;
    case $t: return $TAB;
    case $v: return $VTAB;
    default: return code;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw message || "Assertion failed";
  }
}

module.exports = {
  Token: Token,
  lex: lex
};

},{}],5:[function(require,module,exports){
var Lexer = require('./lexer');
var Expressions = require('./ast');

var Binary = Expressions.Binary;
var AccessMember = Expressions.AccessMember;
var AccessScope = Expressions.AccessScope;
var PrefixNot = Expressions.PrefixNot;
var LiteralPrimitive = Expressions.LiteralPrimitive;
var Conditional = Expressions.Conditional;

function Parser () {
  this.cache = {};
}

Parser.prototype = {
  /**
   * @param {String} input
   * @return {ParserImplementation}
   */
  parse: function (input) {
    input = input || '';

    if (!this.cache.hasOwnProperty(input)) {
      this.cache[input] = new ParserImplementation(Lexer, input).parse();
    }

    return this.cache[input];
  },

  /**
   * @param {String} input
   * @return {Object}
   */
  parseObject: function (input) {
    var obj = {};
    var accessScopeNames = [];

    // TODO: there are edges cases here when using split
    input.split(';').forEach(function (exp) {
      var keySeparatorIndex = exp.indexOf(':');
      var expression = this.parse(exp.substring(keySeparatorIndex + 1).trim());
      accessScopeNames = accessScopeNames.concat(expression.accessScopeNames);
      obj[exp.substring(0, keySeparatorIndex)] = expression;
    }.bind(this));

    return {
      input: input,
      accessScopeNames: accessScopeNames,
      eval: function (scope) {
        var returnObj = {};

        Object.keys(obj).forEach(function (key) {
          returnObj[key] = obj[key].eval(scope);
        });

        return returnObj;
      }
    };
  }
}

var EOF = new Lexer.Token(-1, null);

/**
 * @param {Object} lexer
 * @param {String} input
 */
function ParserImplementation(lexer, input) {
  this.index = 0;
  this.input = input;
  this.accessScopeNames = [];
  this.tokens = lexer.lex(input);
}

ParserImplementation.prototype = {

  peek: function () {
    return (this.index < this.tokens.length) ? this.tokens[this.index] : EOF;
  },

  parse: function () {
    var expression = this.parseExpression();
    // expose useful information
    expression.input = this.input;
    expression.accessScopeNames = this.accessScopeNames;
    return expression;
  },

  parseExpression: function ()  {
    var result = this.parseConditional();

    while (this.optional(')')) {
      return result;
    }

    return result;
  },

  parseConditional: function () {
    var start = this.peek().index,
      result = this.parseLogicalOr();

    if (this.optional('?')) {
      var yes = this.parseExpression();

      if (!this.optional(':')) {
        var end = (this.index < this.tokens.length) ? this.peek().index : this.input.length;
        var expression = this.input.substring(start, end);

        this.error('Conditional expression' + expression + 'requires all 3 expressions');
      }

      var no = this.parseExpression();
      result = new Conditional(result, yes, no);
    }

    return result;
  },

  parseLogicalOr: function () {
    var result = this.parseLogicalAnd();

    while (this.optional('||')) {
      result = new Binary('||', result, this.parseLogicalAnd());
    }

    return result;
  },

  parseLogicalAnd: function () {
    var result = this.parseEquality();

    while (this.optional('&&')) {
      result = new Binary('&&', result, this.parseEquality());
    }

    return result;
  },

  parseEquality: function () {
    var result = this.parseRelational();

    while (true) {
      if (this.optional('==')) {
        result = new Binary('==', result, this.parseRelational());
      } else if (this.optional('!=')) {
        result = new Binary('!=', result, this.parseRelational());
      } else {
        return result;
      }
    }
  },

  parseRelational: function () {
    var result = this.parseAdditive();

    while (true) {
      if (this.optional('<')) {
        result = new Binary('<', result, this.parseAdditive());
      } else if (this.optional('>')) {
        result = new Binary('>', result, this.parseAdditive());
      } else if (this.optional('<=')) {
        result = new Binary('<=', result, this.parseAdditive());
      } else if (this.optional('>=')) {
        result = new Binary('>=', result, this.parseAdditive());
      } else {
        return result;
      }
    }
  },

  parseAdditive: function () {
    var result = this.parseMultiplicative();

    while (true) {
      if (this.optional('+')) {
        result = new Binary('+', result, this.parseMultiplicative());
      } else if (this.optional('-')) {
        result = new Binary('-', result, this.parseMultiplicative());
      } else {
        return result;
      }
    }
  },

  parseMultiplicative: function () {
    var result = this.parsePrefix();

    while (true) {
      if (this.optional('*')) {
        result = new Binary('*', result, this.parsePrefix());
      } else if (this.optional('%')) {
        result = new Binary('%', result, this.parsePrefix());
      } else if (this.optional('/')) {
        result = new Binary('/', result, this.parsePrefix());
      } else if (this.optional('~/')) {
        result = new Binary('~/', result, this.parsePrefix());
      } else {
        return result;
      }
    }
  },

  parsePrefix: function () {
    if (this.optional('+')) {
      return this.parsePrefix(); // TODO(kasperl): This is different than the original parser.
    } else if (this.optional('-')) {
      return new Binary('-', new LiteralPrimitive(0), this.parsePrefix());
    } else if (this.optional('!')) {
      return new PrefixNot('!', this.parsePrefix());
    } else {
      return this.parseAccessMember();
    }
  },

  parseAccessMember: function () {
    var result = this.parsePrimary();

    while (true) {
      if (this.optional('.')) {
        var name = this.peek().text;
        this.advance();
        result = new AccessMember(result, name);
      } else {
        return result;
      }
    }
  },

  parsePrimary: function () {
    if (this.optional('(')) {
      // TODO
      var result = this.parseExpression();
      return result
    } else if (this.optional('null') || this.optional('undefined')) {
      return new LiteralPrimitive(null);
    } else if (this.optional('true')) {
      return new LiteralPrimitive(true);
    } else if (this.optional('false')) {
      return new LiteralPrimitive(false);
    } else if (this.peek().key != null) {
      return this.parseAccessScope();
    } else if (this.peek().value != null) {
      var value = this.peek().value;
      this.advance();
      return new LiteralPrimitive(value);
    } else if (this.index >= this.tokens.length) {
      throw new Error('Unexpected end of expression: ' + this.input);
    } else {
      this.error('Unexpected token ' + this.peek().text);
    }

  },

  parseAccessScope: function () {
    var name = this.peek().key;

    this.advance();

    if (this.accessScopeNames.indexOf(name) === -1) {
      this.accessScopeNames.push(name);
    }

    return new AccessScope(name);
  },

  /**
   * @param {String} text
   * @return {Boolean}
   */
  optional: function (text) {
    if (this.peek().text == text) {
      this.advance();
      return true;
    }

    return false;
  },

  advance: function () {
    this.index++;
  },

  error: function (message) {
    var location = (this.index < this.tokens.length) ?
      'at column ' + this.tokens[this.index].index + 1 + ' in' :
      'at the end of the expression';

    throw new Error('Parser Error: ' + message + ' ' + location + ' [' + this.input + ']');
  }

};


module.exports = {
  Parser: Parser,
  ParserImplementation: ParserImplementation
};

},{"./ast":3,"./lexer":4}],6:[function(require,module,exports){
var StatefulFormElement = require('./stateful-form-element');

var Cls = function StatefulCheckbox () {
  StatefulFormElement.apply(this, arguments);
};

var Proto = Cls.prototype = Object.create(StatefulFormElement.prototype);

Proto.bindEvents = function () {
  this.el.addEventListener('change', this.updateValue.bind(this));
};

Proto.updateValue = function () {
  this.setState({ value: this.getValue(), pristine: false, touched: true });
};

Proto.isValid = function () {
  if (this.el.hasAttribute('required')) {
    return this.el.checked;
  }
  return true;
};

Proto.getValue = function () {
  return this.el.checked;
};

module.exports = Cls;

},{"./stateful-form-element":7}],7:[function(require,module,exports){
var StatefulObject = require('../stateful-object');
var reflectState = require('../utils').reflectState;

function StatefulFormElement (el) {
  this.el = el;
  this.name = this.el.getAttribute('name');
  StatefulObject.call(this);
  this.onStateChange(reflectState.bind(null, this.el));
  this.bindEvents();
  this.triggerStateChange();
}

var Proto = StatefulFormElement.prototype = Object.create(StatefulObject.prototype);

Proto.getDefaultState = function () {
  var state = {
    valid: this.isValid(),
    pristine: true,
    touched: false,
    value: this.getValue()
  };

  return state;
};

Proto.getValue = function () {
  return this.el.value;
};

Proto.computedState = function (state) {
  state.valid = this.isValid();

  return Object.assign(state, {
    invalid: !state.valid,
    dirty: !state.pristine,
    untouched: !state.touched
  });
};

module.exports = StatefulFormElement;

},{"../stateful-object":13,"../utils":14}],8:[function(require,module,exports){
var StatefulObject = require('../stateful-object');

var Cls = function StatefulRadioGroup (name) {
  this.name = name;
  this.radios = [];
  this.required = false;
  this.handleRadioStateChange = this.handleRadioStateChange.bind(this);
  StatefulObject.apply(this, arguments);
};

var Proto = Cls.prototype = Object.create(StatefulObject.prototype);

/**
 * @param {StatefulRadio} radio
 */
Proto.addRadio = function (radio) {
  radio.index = this.radios.length;
  this.required = this.required || radio.el.hasAttribute('required');
  this.radios.push(radio);
  radio.onStateChange(this.handleRadioStateChange);
}

Proto.triggerRadiosStateChange = function () {
  this.radios.forEach(function (radio) {
    radio.triggerStateChange();
  });
};

Proto.getDefaultState = function () {
  // This is actually not so important since all children will be
  return {
    pristine: true,
    valid: false,
    touched: false
  };
};

Proto.handleRadioStateChange = function (state, partialState, key, obj) {
  var isValid = !this.required || (this.state.valid || state.valid);
  var isPristine = this.state.pristine && state.pristine;
  var isTouched = this.state.touched || state.touched;

  this.setState({
    valid: isValid,
    invalid: !isValid,
    pristine: isPristine,
    dirty: !isPristine,
    touched: isTouched,
    untouched: !isTouched
  }, this.name);
};


module.exports = Cls;

},{"../stateful-object":13}],9:[function(require,module,exports){
var StatefulFormElement = require('./stateful-form-element');

var Cls = function StatefulRadio () {
  StatefulFormElement.apply(this, arguments);
};

var Proto = Cls.prototype = Object.create(StatefulFormElement.prototype);

Proto.bindEvents = function () {
  this.el.addEventListener('change', this.updateValue.bind(this));
};

Proto.updateValue = function () {
  this.setState({ value: this.getValue(), pristine: false, touched: true });
};

Proto.isValid = function () {
  return this.getValue();
};

Proto.getValue = function () {
  return this.el.checked;
};

module.exports = Cls;

},{"./stateful-form-element":7}],10:[function(require,module,exports){
var StatefulFormElement = require('./stateful-form-element');

function StatefulSelect () {
  StatefulFormElement.apply(this, arguments);
}

var Proto = StatefulSelect.prototype = Object.create(StatefulFormElement.prototype);

Proto.bindEvents = function () {
  this.el.addEventListener('change', this.updateValue.bind(this));
};

Proto.updateValue = function () {
  this.setState({ value: this.getValue(), pristine: false, touched: true });
};

Proto.isValid = function () {
  return !!this.el.value;
};

module.exports = StatefulSelect;

},{"./stateful-form-element":7}],11:[function(require,module,exports){
var StatefulFormElement = require('./stateful-form-element');

function StatefulTextInput () {
  StatefulFormElement.apply(this, arguments);
}

var Proto = StatefulTextInput.prototype = Object.create(StatefulFormElement.prototype);

Proto.bindEvents = function () {
  var updateValue = this.updateValue.bind(this);

  this.el.addEventListener('keyup', updateValue);
  this.el.addEventListener('change', updateValue);

  this.el.addEventListener('blur', function onBlur () {
    this.setState({ touched: true });
  }.bind(this));
};

Proto.updateValue = function () {
  this.setState({ value: this.getValue(), pristine: false });
};

Proto.computedState = function (state) {
  state.valid = this.isValid();

  return Object.assign(state, {
    invalid: !state.valid,
    dirty: !state.pristine,
    untouched: !state.touched
  });
};

Proto.getValidationRules = function () {
  var rules = [];
  var required = this.el.hasAttribute('required');
  var min = this.el.getAttribute('min');
  var max = this.el.getAttribute('max');
  var maxlength = this.el.getAttribute('maxlength');
  var minlength = this.el.getAttribute('minlength');
  var pattern = this.el.getAttribute('pattern');

  if (required) {
    rules.push(function required (val) {
      return val.length > 0;
    });
  }

  if (min !== null) {
    rules.push(function min (val) {
      return val >= min;
    });
  }

  if (max !== null) {
    rules.push(function max (val) {
      return val <= max;
    });
  }

  if (minlength !== null) {
    rules.push(function minlength (val) {
      return val.length >= minlength;
    });
  }

  if (maxlength !== null) {
    rules.push(function maxlength (val) {
      return val.length <= maxlength;
    });
  }

  if (pattern !== null) {
    rules.push(function pattern (val) {
      return val.match(new RegExp(pattern));
    });
  }

  return rules;
};

Proto.isValid = function () {
  var val = this.el.value.trim();
  // Get validation rules is always called to allow changing of properties
  var rules = this.getValidationRules();
  var isValid = true;

  if (this.el.getAttribute('type') === 'email') {
    isValid = (val.indexOf('@') > 0) && val.length > 2;
  }

  for (var i = 0; i < rules.length; i++) {
    isValid = rules[i](val) && isValid;
    if (!isValid) return false;
  }

  return isValid;
};

module.exports = StatefulTextInput;

},{"./stateful-form-element":7}],12:[function(require,module,exports){
var StatefulObject = require('./stateful-object');
var StatefulTextInput = require('./form-elements/stateful-text-input');
var StatefulSelect = require('./form-elements/stateful-select');
var StatefulCheckbox = require('./form-elements/stateful-checkbox');
var StatefulRadio = require('./form-elements/stateful-radio');
var StatefulRadioGroup = require('./form-elements/stateful-radio-group');

function StatefulForm (el) {
  this.el = el;
  this.handleFormElementStateChange = this.handleFormElementStateChange.bind(this)
  this.init();
  StatefulObject.call(this);
  this.bindEvents();
}

var Proto = StatefulForm.prototype = Object.create(StatefulObject.prototype);

/**
 * Handle state changes by form elements
 */
Proto.handleFormElementStateChange = function (state, partialState, key) {
  var newState = {};
  newState[key] = state;
  this.setState(newState, key);
};

Proto.setFormState = function (newState) {
  this.setState({ $form: Object.assign({}, this.state.$form, newState) }, '$form');
};

Proto.computedState = function (state) {
  var isValid = true;
  var isPristine = state.$form.pristine;
  var isTouched = state.$form.touched;

  Object.keys(state).forEach(function (key) {
    if (key.indexOf('$') === 0) return;

    var prop = state[key];

    if (isValid && prop.hasOwnProperty('valid')) {
      isValid = prop.valid;
    }

    if (isPristine && prop.hasOwnProperty('pristine')) {
      isPristine = prop.pristine;
    }

    if (prop.hasOwnProperty('touched')) {
      isTouched = isTouched || prop.touched;
    }
  });

  Object.assign(state.$form, {
    valid: isValid,
    pristine: isPristine,
    touched: isTouched,
    invalid: !isValid,
    dirty: !isPristine,
    untouched: !isTouched
  });

  return state;
};

Proto.init = function () {
  this.formElements = [];
  this.radioGroups = {};

  Array.prototype.forEach.call(this.el.elements, function (field) {
    var name = field.name;
    var type = field.type;

    if (!name) return;
    if (field.nodeName.toLowerCase() == 'fieldset') return;
    if (type == 'submit') return;
    if (type == 'reset') return;
    if (type == 'button') return;
    if (type == 'file') return;

    var formElement = createStatefulFormElement(field);

    if (formElement instanceof StatefulRadio) {
      if (this.radioGroups.hasOwnProperty(name)) {
        this.radioGroups[name].addRadio(formElement);
      } else {
        this.radioGroups[name] = new StatefulRadioGroup(name);
        this.radioGroups[name].addRadio(formElement);
      }
    } else if (formElement !== undefined) {
      this.formElements.push(formElement);
    }
  }.bind(this));

  Object.keys(this.radioGroups).forEach(function (name) {
    this.radioGroups[name].triggerRadiosStateChange();
    this.formElements.push(this.radioGroups[name]);
  }.bind(this));
};

Proto.getDefaultState = function () {
  var state = {};
  var isValid = true;

  Array.prototype.forEach.call(this.formElements, function (formElement) {
    formElement.onStateChange(this.handleFormElementStateChange);
    state[formElement.name] = formElement.state;
    isValid = formElement.state.valid && isValid;
  }.bind(this));

  return Object.assign({
    $form: {
      submitted: false,
      pristine: true,
      valid: isValid
    }
  }, state);
};

Proto.bindEvents = function () {
  this.el.addEventListener('submit', function (e) {
    e.preventDefault();
    this.submit();
  }.bind(this));
};

function serialize (state) {
  var result = [];

  Object.keys(state).forEach(function (key) {
    if (key.indexOf('$') === -1) {
      result.push(encodeURIComponent(key) + '=' + encodeURIComponent(state[key].value));
    }
  });

  return result.join('&');
}

function serializeJSON (state) {
  var obj = {};

  Object.keys(state).forEach(function (key) {
    if (key.indexOf('$') === -1) {
      obj[key] = state[key].value;
    }
  });

  return JSON.stringify(obj);
}

Proto.submit = function () {
  var action = this.el.getAttribute('action');
  var enctype = this.el.getAttribute('enctype') || 'application/x-www-form-urlencoded; charset=UTF-8';

  if (this.state.hasOwnProperty('$response')) {
    this.setState({ $response: undefined });
  }

  if (!this.state.$form.submitted) {
    this.setFormState({ submitted: true });
  }

  if (this.state.$form.invalid) return;

  var request = new XMLHttpRequest();
  request.open('POST', action, true);
  request.setRequestHeader('Content-Type', enctype);

  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {

      var json;
      try {
        json = JSON.parse(request.responseText);
      } catch (e) {
        json = {};
      }

      this.setState({
        $request: {
          success: true,
          failed: false,
          error: false,
          status: request.status
        },
        $response: {
          json: json,
          text: request.responseText
        }
      });
    } else {
      this.setState({
        $request: {
          success: false,
          failed: true,
          error: false,
          status: request.status
        }
      });
      // We reached our target server, but it returned an error
      console.log('error');
    }
  }.bind(this);

  request.onerror = function () {
    this.setState({
      $request: {
        success: false,
        failed: false,
        error: true,
        status: request.status
      }
    });
  };

  if (enctype === 'application/json') {
    request.send(serializeJSON(this.state));
  } else {
    request.send(serialize(this.state));
  }

};

// Private

function createStatefulFormElement (field) {
  var type = field.getAttribute('sf-element')
          || field.type
          || field.nodeName.toLowerCase();

  switch (type) {
    case 'textarea':
    case 'password':
    case 'text':
    case 'email':
    case 'phone':
    case 'tel':
    case 'hidden':
      return new StatefulTextInput(field);
    case 'checkbox': return new StatefulCheckbox(field);
    case 'radio': return new StatefulRadio(field);
    case 'select-one':
    case 'select':
      return new StatefulSelect(field);
    default:
      console.error('Form element type `' + type + '` not supported by Stateful Forms', field);
  }
}

module.exports = StatefulForm;

},{"./form-elements/stateful-checkbox":6,"./form-elements/stateful-radio":9,"./form-elements/stateful-radio-group":8,"./form-elements/stateful-select":10,"./form-elements/stateful-text-input":11,"./stateful-object":13}],13:[function(require,module,exports){
function StatefulObject () {
  this.listeners = [];
  this.setState(this.getDefaultState());
}

var Proto = StatefulObject.prototype;

Proto.onStateChange = function (listener) {
  this.listeners.push(listener);
  return this;
};

Proto.triggerStateChange = function (partialNewState, key) {
  this.listeners.forEach(function (listener) {
    listener(this.state, partialNewState, key, this);
  }.bind(this));
  return this;
};

/**
 * @param {Object} partialNewState
 * @param {?String} key
 */
Proto.setState = function (partialNewState, key) {
  var name = key || this.name;
  var oldState = this.state || {};
  this.state = this.computedState(Object.assign({}, this.state, partialNewState));
  if (JSON.stringify(oldState[key]) !== JSON.stringify(partialNewState)) {
    this.triggerStateChange(partialNewState, name);
  }
  return this;
};

Proto.computedState = function (state) {
  return state;
};

Proto.getDefaultState = function () {
  return {};
};

module.exports = StatefulObject;

},{}],14:[function(require,module,exports){
// IE8+
function removeClass (el, className) {
  if (el.classList) {
    el.classList.remove(className);
  } else {
    el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  }
}

// IE8+
function addClass (el, className) {
  if (el.classList) {
    el.classList.add(className);
  } else {
    el.className += ' ' + className;
  }
}

function toggleClass (el, className, isApplied) {
  if (isApplied) {
    addClass(el, className);
  } else {
    removeClass(el, className);
  }
}

function toggleAttribute (el, attrName, isApplied) {
  if (isApplied) {
    el.setAttribute(attrName, attrName);
  } else {
    el.removeAttribute(attrName);
  }
}

function reflectState (el, state) {
  Object.keys(state).forEach(function (key) {
    if (typeof state[key] === 'boolean') {
      toggleClass(el, 'is-' + key, !!state[key]);
    } else if (key === 'value') {
      toggleClass(el, 'has-value', !!state[key]);
    }
  });
}

module.exports = {
  toggleClass: toggleClass,
  reflectState: reflectState,
  removeClass: removeClass,
  addClass: addClass,
  toggleAttribute: toggleAttribute
};

},{}],15:[function(require,module,exports){
// Some browsers do not support Object.create
if (typeof Object.create === 'undefined') {
	Object.create = function(prototype) {
		function C() {}
		C.prototype = prototype;
		return new C();
	}
}

},{}],16:[function(require,module,exports){
(function (global){
'use strict';
/**
 * Stateful forms
 * ---
 * Author: Jeroen Ransijn
 * License: MIT
 */
require('./polyfills/object-create');
var StatefulForm = require('./lib/stateful-form');
var DirectivesManager = require('./lib/directives/directives-manager');

global.createStatefulForms = function createStatefulForms () {
  var forms = document.querySelectorAll('form[stateful]');

  // IE9+ NodeList iteration
  return Array.prototype.map.call(forms, function (form) {
    var manager = new DirectivesManager(form);
    return new StatefulForm(form).onStateChange(function (state, partialState, key) {
      console.log('form:stateChange', key, state);
      if (key) {
        manager.patch(key, state);
      } else {
        manager.update(state);
      }
    }).triggerStateChange();
  });
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./lib/directives/directives-manager":1,"./lib/stateful-form":12,"./polyfills/object-create":15}]},{},[16])


//# sourceMappingURL=stateful-forms.js.map

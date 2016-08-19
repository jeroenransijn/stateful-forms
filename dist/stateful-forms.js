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
  this.setState({ form: Object.assign({}, this.state.form, newState) }, 'form');
};

Proto.computedState = function (state) {
  var isValid = true;
  var isPristine = state.form.pristine;
  var isTouched = state.form.touched;

  Object.keys(state).forEach(function (key) {
    if (key === 'form') return;
    if (key === 'request') return;
    if (key === 'response') return;

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

  Object.assign(state.form, {
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
    form: {
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

Proto.submit = function () {
  var action = this.el.getAttribute('action');
  this.setFormState({ submitted: true });

  if (this.state.form.invalid) return;

  var request = new XMLHttpRequest();
  request.open('POST', action, true);
  request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {

      var json = {};
      try {
        json = JSON.parse(request.responseText);
      } catch (e) {
        json = {};
      }

      this.setState({
        request: {
          success: true,
          failed: false,
          status: request.status
        },
        response: {
          json: json,
          text: request.responseText
        }
      });
    } else {
      this.setState({
        request: {
          success: false,
          failed: true,
          status: request.status
        }
      });
      // We reached our target server, but it returned an error
      console.log('error');
    }
  }.bind(this);

  request.onerror = function() {
    // There was a connection error of some sort
    console.log('error');
  };

  request.send(this.state);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbGliL2RpcmVjdGl2ZXMvZGlyZWN0aXZlcy1tYW5hZ2VyLmpzIiwic3JjL2xpYi9kaXJlY3RpdmVzL2RpcmVjdGl2ZXMuanMiLCJzcmMvbGliL2V4cHJlc3Npb25zL2FzdC5qcyIsInNyYy9saWIvZXhwcmVzc2lvbnMvbGV4ZXIuanMiLCJzcmMvbGliL2V4cHJlc3Npb25zL3BhcnNlci5qcyIsInNyYy9saWIvZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1jaGVja2JveC5qcyIsInNyYy9saWIvZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1mb3JtLWVsZW1lbnQuanMiLCJzcmMvbGliL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtcmFkaW8tZ3JvdXAuanMiLCJzcmMvbGliL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtcmFkaW8uanMiLCJzcmMvbGliL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtc2VsZWN0LmpzIiwic3JjL2xpYi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXRleHQtaW5wdXQuanMiLCJzcmMvbGliL3N0YXRlZnVsLWZvcm0uanMiLCJzcmMvbGliL3N0YXRlZnVsLW9iamVjdC5qcyIsInNyYy9saWIvdXRpbHMuanMiLCJzcmMvcG9seWZpbGxzL29iamVjdC1jcmVhdGUuanMiLCJzcmMvc3RhdGVmdWwtZm9ybXMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Y0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3BHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMvTUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDMUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ25EQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBEaXJlY3RpdmVzID0gcmVxdWlyZSgnLi9kaXJlY3RpdmVzJyk7XG5cbmZ1bmN0aW9uIERpcmVjdGl2ZXNNYW5hZ2VyIChlbCkge1xuICB0aGlzLmVsID0gZWw7XG4gIHRoaXMuZGlyZWN0aXZlcyA9IHt9O1xuICB0aGlzLnBhdGNoSW5kZXggPSB7fTtcblxuICB0aGlzLnF1ZXJ5TWFwKERpcmVjdGl2ZXMuU2hvd0RpcmVjdGl2ZSk7XG4gIHRoaXMucXVlcnlNYXAoRGlyZWN0aXZlcy5UZXh0RGlyZWN0aXZlKTtcbiAgdGhpcy5xdWVyeU1hcChEaXJlY3RpdmVzLkNsYXNzRGlyZWN0aXZlKTtcbiAgdGhpcy5xdWVyeU1hcChEaXJlY3RpdmVzLkF0dHJpYnV0ZXNEaXJlY3RpdmUpO1xufVxuXG52YXIgUHJvdG8gPSBEaXJlY3RpdmVzTWFuYWdlci5wcm90b3R5cGU7XG5cblByb3RvLnF1ZXJ5TWFwID0gZnVuY3Rpb24gKGNscykge1xuICB2YXIgYXR0ciA9IGNscy5wcm90b3R5cGUuYXR0cmlidXRlO1xuICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKFxuICAgIHRoaXMuZWwucXVlcnlTZWxlY3RvckFsbCgnWycgKyBhdHRyICsgJ10nKSwgZnVuY3Rpb24gKGVsKSB7XG4gICAgICB2YXIgZGlyZWN0aXZlID0gbmV3IGNscyhlbCk7XG5cbiAgICAgIHRoaXMuZGlyZWN0aXZlc1thdHRyXSA9IHRoaXMuZGlyZWN0aXZlc1thdHRyXSB8fCBbXTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlc1thdHRyXS5wdXNoKGRpcmVjdGl2ZSk7XG5cbiAgICAgIGRpcmVjdGl2ZS5nZXROYW1lcygpLmZvckVhY2goZnVuY3Rpb24gKG5hbWUpIHtcbiAgICAgICAgdGhpcy5wYXRjaEluZGV4W25hbWVdID0gdGhpcy5wYXRjaEluZGV4W25hbWVdIHx8IFtdO1xuICAgICAgICB0aGlzLnBhdGNoSW5kZXhbbmFtZV0ucHVzaChkaXJlY3RpdmUpO1xuICAgICAgfS5iaW5kKHRoaXMpKTtcbiAgICB9LmJpbmQodGhpcykpO1xufTtcblxuUHJvdG8ucGF0Y2ggPSBmdW5jdGlvbiAoa2V5LCBzdGF0ZSkge1xuICAvLyBjb25zb2xlLmxvZygncGF0Y2gnLCBrZXksIHN0YXRlKTtcbiAgaWYgKHRoaXMucGF0Y2hJbmRleC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgdGhpcy5wYXRjaEluZGV4W2tleV0uZm9yRWFjaChmdW5jdGlvbiAoZGlyZWN0aXZlKSB7XG4gICAgICBkaXJlY3RpdmUudXBkYXRlKHN0YXRlKTtcbiAgICB9KTtcbiAgfVxufTtcblxuUHJvdG8udXBkYXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIC8vIGNvbnNvbGUubG9nKCd1cGRhdGUnLCB0aGlzLmRpcmVjdGl2ZXMpO1xuICBPYmplY3Qua2V5cyh0aGlzLmRpcmVjdGl2ZXMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgIHRoaXMuZGlyZWN0aXZlc1trZXldLmZvckVhY2goZnVuY3Rpb24gKGRpcmVjdGl2ZSkge1xuICAgICAgZGlyZWN0aXZlLnVwZGF0ZShzdGF0ZSk7XG4gICAgfSk7XG4gIH0uYmluZCh0aGlzKSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IERpcmVjdGl2ZXNNYW5hZ2VyO1xuIiwidmFyIFBhcnNlciA9IHJlcXVpcmUoJy4uL2V4cHJlc3Npb25zL3BhcnNlcicpLlBhcnNlcjtcbnZhciB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJyk7XG5cbi8vIFVzZSBvbmUgcGFyc2VyIGFjcm9zcyBkaXJlY3RpdmVzIHRvIG1ha2UgdXNlIG9mIHRoZSBjYWNoZVxudmFyIHBhcnNlciA9IG5ldyBQYXJzZXIoKTtcbnBhcnNlci5wYXJzZSA9IHBhcnNlci5wYXJzZS5iaW5kKHBhcnNlcik7XG5wYXJzZXIucGFyc2VPYmplY3QgPSBwYXJzZXIucGFyc2VPYmplY3QuYmluZChwYXJzZXIpO1xuXG5mdW5jdGlvbiBEaXJlY3RpdmUgKGVsKSB7XG4gIHRoaXMuZWwgPSBlbDtcbiAgdGhpcy5hdHRyaWJ1dGVWYWx1ZSA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKHRoaXMuYXR0cmlidXRlKTtcbiAgdGhpcy5leHByZXNzaW9uID0gdGhpcy5wYXJzZSh0aGlzLmF0dHJpYnV0ZVZhbHVlKTtcblxuICAvKipcbiAgICogQHJldHVybiB7QXJyYXlbU3RyaW5nXX0gbmFtZXMgb2YgYWNjZXNzIG1lbWJlcnNcbiAgICovXG4gIHRoaXMuZ2V0TmFtZXMgPSBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuIHRoaXMuZXhwcmVzc2lvbi5hY2Nlc3NTY29wZU5hbWVzO1xuICB9XG59XG5cbmZ1bmN0aW9uIE9iamVjdERpcmVjdGl2ZSAoKSB7XG4gIHRoaXMucGFyc2UgPSBwYXJzZXIucGFyc2VPYmplY3Q7XG4gIERpcmVjdGl2ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gIHRoaXMudXBkYXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgdmFyIG1hdGNoZWRPYmplY3QgPSB0aGlzLmV4cHJlc3Npb24uZXZhbChzdGF0ZSk7XG5cbiAgICBPYmplY3Qua2V5cyhtYXRjaGVkT2JqZWN0KS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgIHRoaXMudG9nZ2xlTWV0aG9kKHRoaXMuZWwsIGtleSwgbWF0Y2hlZE9iamVjdFtrZXldKTtcbiAgICB9LmJpbmQodGhpcykpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBBdHRyaWJ1dGVzRGlyZWN0aXZlICgpIHtcbiAgdGhpcy50b2dnbGVNZXRob2QgPSB1dGlscy50b2dnbGVBdHRyaWJ1dGU7XG4gIE9iamVjdERpcmVjdGl2ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuQXR0cmlidXRlc0RpcmVjdGl2ZS5wcm90b3R5cGUuYXR0cmlidXRlID0gJ3NmLWF0dHJpYnV0ZXMnO1xuXG5mdW5jdGlvbiBDbGFzc0RpcmVjdGl2ZSAoKSB7XG4gIHRoaXMudG9nZ2xlTWV0aG9kID0gdXRpcy50b2dnbGVDbGFzcztcbiAgT2JqZWN0RGlyZWN0aXZlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5PYmplY3REaXJlY3RpdmUucHJvdG90eXBlLmF0dHJpYnV0ZSA9ICdzZi1jbGFzcyc7XG5cbmZ1bmN0aW9uIFNob3dEaXJlY3RpdmUgKCkge1xuICB0aGlzLnBhcnNlID0gcGFyc2VyLnBhcnNlO1xuICBEaXJlY3RpdmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICB0aGlzLnVwZGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgIGlmICghIXRoaXMuZXhwcmVzc2lvbi5ldmFsKHN0YXRlKSkge1xuICAgICAgdGhpcy5lbC5zdHlsZS5kaXNwbGF5ID0gJyc7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcbiAgICB9XG4gIH07XG59XG5TaG93RGlyZWN0aXZlLnByb3RvdHlwZS5hdHRyaWJ1dGUgPSAnc2Ytc2hvdyc7XG5cbmZ1bmN0aW9uIFRleHREaXJlY3RpdmUgKCkge1xuICB0aGlzLnBhcnNlID0gcGFyc2VyLnBhcnNlO1xuICBEaXJlY3RpdmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICB0aGlzLnVwZGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgIHRoaXMuZWwuaW5uZXJIVE1MID0gdGhpcy5leHByZXNzaW9uLmV2YWwoc3RhdGUpO1xuICB9XG59XG5UZXh0RGlyZWN0aXZlLnByb3RvdHlwZS5hdHRyaWJ1dGUgPSAnc2YtdGV4dCc7XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBEaXJlY3RpdmU6IERpcmVjdGl2ZSxcbiAgT2JqZWN0RGlyZWN0aXZlOiBPYmplY3REaXJlY3RpdmUsXG4gIEF0dHJpYnV0ZXNEaXJlY3RpdmU6IEF0dHJpYnV0ZXNEaXJlY3RpdmUsXG4gIENsYXNzRGlyZWN0aXZlOiBDbGFzc0RpcmVjdGl2ZSxcbiAgU2hvd0RpcmVjdGl2ZTogU2hvd0RpcmVjdGl2ZSxcbiAgVGV4dERpcmVjdGl2ZTogVGV4dERpcmVjdGl2ZSxcbn07XG4iLCIvKipcbiAqIEBwYXJhbSB7U3RyaW5nfSBvcGVyYXRpb25cbiAqIEBwYXJhbSB7RXhwcmVzc2lvbn0gbGVmdEV4cFxuICogQHBhcmFtIHtFeHByZXNzaW9ufSByaWdodEV4cFxuICovXG5mdW5jdGlvbiBCaW5hcnkgKG9wZXJhdGlvbiwgbGVmdEV4cCwgcmlnaHRFeHApIHtcbiAgdGhpcy5ldmFsID0gZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgdmFyIGxlZnQgPSBsZWZ0RXhwLmV2YWwoc2NvcGUpO1xuXG4gICAgc3dpdGNoIChvcGVyYXRpb24pIHtcbiAgICAgIGNhc2UgJyYmJzogcmV0dXJuICEhbGVmdCAmJiAhIXJpZ2h0RXhwLmV2YWwoc2NvcGUpO1xuICAgICAgY2FzZSAnfHwnOiByZXR1cm4gISFsZWZ0IHx8ICEhcmlnaHRFeHAuZXZhbChzY29wZSk7XG4gICAgfVxuXG4gICAgdmFyIHJpZ2h0ID0gcmlnaHRFeHAuZXZhbChzY29wZSk7XG5cbiAgICAvLyBOdWxsIGNoZWNrIGZvciB0aGUgb3BlcmF0aW9ucy5cbiAgICBpZiAobGVmdCA9PSBudWxsIHx8IHJpZ2h0ID09IG51bGwpIHtcbiAgICAgIHN3aXRjaCAob3BlcmF0aW9uKSB7XG4gICAgICAgIGNhc2UgJysnOlxuICAgICAgICAgIGlmIChsZWZ0ICE9IG51bGwpIHJldHVybiBsZWZ0O1xuICAgICAgICAgIGlmIChyaWdodCAhPSBudWxsKSByZXR1cm4gcmlnaHQ7XG4gICAgICAgICAgcmV0dXJuIDA7XG4gICAgICAgIGNhc2UgJy0nOlxuICAgICAgICAgIGlmIChsZWZ0ICE9IG51bGwpIHJldHVybiBsZWZ0O1xuICAgICAgICAgIGlmIChyaWdodCAhPSBudWxsKSByZXR1cm4gMCAtIHJpZ2h0O1xuICAgICAgICAgIHJldHVybiAwO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gbnVsbDtcbiAgICB9XG5cbiAgICBzd2l0Y2ggKG9wZXJhdGlvbikge1xuICAgICAgY2FzZSAnKycgIDogcmV0dXJuIGF1dG9Db252ZXJ0QWRkKGxlZnQsIHJpZ2h0KTtcbiAgICAgIGNhc2UgJy0nICA6IHJldHVybiBsZWZ0IC0gcmlnaHQ7XG4gICAgICBjYXNlICcqJyAgOiByZXR1cm4gbGVmdCAqIHJpZ2h0O1xuICAgICAgY2FzZSAnLycgIDogcmV0dXJuIGxlZnQgLyByaWdodDtcbiAgICAgIGNhc2UgJ34vJyA6IHJldHVybiBNYXRoLmZsb29yKGxlZnQgLyByaWdodCk7XG4gICAgICBjYXNlICclJyAgOiByZXR1cm4gbGVmdCAlIHJpZ2h0O1xuICAgICAgY2FzZSAnPT0nIDogcmV0dXJuIGxlZnQgPT0gcmlnaHQ7XG4gICAgICBjYXNlICchPScgOiByZXR1cm4gbGVmdCAhPSByaWdodDtcbiAgICAgIGNhc2UgJzwnICA6IHJldHVybiBsZWZ0IDwgcmlnaHQ7XG4gICAgICBjYXNlICc+JyAgOiByZXR1cm4gbGVmdCA+IHJpZ2h0O1xuICAgICAgY2FzZSAnPD0nIDogcmV0dXJuIGxlZnQgPD0gcmlnaHQ7XG4gICAgICBjYXNlICc+PScgOiByZXR1cm4gbGVmdCA+PSByaWdodDtcbiAgICAgIGNhc2UgJ14nICA6IHJldHVybiBsZWZ0IF4gcmlnaHQ7XG4gICAgICBjYXNlICcmJyAgOiByZXR1cm4gbGVmdCAmIHJpZ2h0O1xuICAgIH1cblxuICAgIHRocm93IG5ldyBFcnJvcignSW50ZXJuYWwgZXJyb3IgWycgKyBvcGVyYXRpb24gKyAnXSBub3QgaGFuZGxlZCcpO1xuICB9O1xufVxuXG4vKipcbiAqIEBwYXJhbSB7RXhwcmVzc2lvbn0gb2JqZWN0XG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICovXG5mdW5jdGlvbiBBY2Nlc3NNZW1iZXIgKG9iamVjdCwgbmFtZSkge1xuICB0aGlzLmV2YWwgPSBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICB2YXIgaW5zdGFuY2UgPSBvYmplY3QuZXZhbChzY29wZSk7XG4gICAgcmV0dXJuIGluc3RhbmNlID09IG51bGwgPyBudWxsIDogaW5zdGFuY2VbbmFtZV07XG4gIH07XG59XG5cbi8qKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqL1xuZnVuY3Rpb24gQWNjZXNzU2NvcGUgKG5hbWUpIHtcbiAgdGhpcy5ldmFsID0gZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgcmV0dXJuIHNjb3BlW25hbWVdO1xuICB9O1xufVxuXG4vKipcbiAqIEBwYXJhbSB7U3RyaW5nfSBvcGVyYXRpb25cbiAqIEBwYXJhbSB7RXhwcmVzc2lvbn0gZXhwcmVzc2lvblxuICovXG5mdW5jdGlvbiBQcmVmaXhOb3QgKG9wZXJhdGlvbiwgZXhwcmVzc2lvbikge1xuICB0aGlzLmV2YWwgPSBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICByZXR1cm4gIWV4cHJlc3Npb24uZXZhbChzY29wZSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIExpdGVyYWxQcmltaXRpdmUgKHZhbHVlKSB7XG4gIHRoaXMuZXZhbCA9IGZ1bmN0aW9uIChzY29wZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfTtcbn1cblxuLyoqXG4gKiBAcGFyYW0ge0V4cHJlc3Npb259IGNvbmRpdGlvblxuICogQHBhcmFtIHtFeHByZXNzaW9ufSB5ZXNcbiAqIEBwYXJhbSB7RXhwcmVzc3Npb259IG5vXG4gKi9cbmZ1bmN0aW9uIENvbmRpdGlvbmFsIChjb25kaXRpb24sIHllcywgbm8pIHtcbiAgdGhpcy5ldmFsID0gZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgcmV0dXJuICghIWNvbmRpdGlvbi5ldmFsKHNjb3BlKSkgPyB5ZXMuZXZhbChzY29wZSkgOiBuby5ldmFsKHNjb3BlKTtcbiAgfTtcbn1cblxuLy8gQWRkIHRoZSB0d28gYXJndW1lbnRzIHdpdGggYXV0b21hdGljIHR5cGUgY29udmVyc2lvbi5cbmZ1bmN0aW9uIGF1dG9Db252ZXJ0QWRkKGEsIGIpIHtcbiAgaWYgKGEgIT0gbnVsbCAmJiBiICE9IG51bGwpIHtcbiAgICBpZiAodHlwZW9mIGEgPT0gJ3N0cmluZycgJiYgdHlwZW9mIGIgIT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBhICsgYi50b1N0cmluZygpO1xuICAgIH1cblxuICAgIGlmICh0eXBlb2YgYSAhPSAnc3RyaW5nJyAmJiB0eXBlb2YgYiA9PSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGEudG9TdHJpbmcoKSArIGI7XG4gICAgfVxuXG4gICAgcmV0dXJuIGEgKyBiO1xuICB9XG5cbiAgaWYgKGEgIT0gbnVsbCkge1xuICAgIHJldHVybiBhO1xuICB9XG5cbiAgaWYgKGIgIT0gbnVsbCkge1xuICAgIHJldHVybiBiO1xuICB9XG5cbiAgcmV0dXJuIDA7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBCaW5hcnk6IEJpbmFyeSxcbiAgQ29uZGl0aW9uYWw6IENvbmRpdGlvbmFsLFxuICBBY2Nlc3NNZW1iZXI6IEFjY2Vzc01lbWJlcixcbiAgQWNjZXNzU2NvcGU6IEFjY2Vzc1Njb3BlLFxuICBQcmVmaXhOb3Q6IFByZWZpeE5vdCxcbiAgTGl0ZXJhbFByaW1pdGl2ZTogTGl0ZXJhbFByaW1pdGl2ZVxufTtcbiIsIi8qKlxuICogQHBhcmFtIHtOdW1iZXJ9IGluZGV4XG4gKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICovXG5mdW5jdGlvbiBUb2tlbiAoaW5kZXgsIHRleHQpIHtcbiAgdGhpcy5pbmRleCA9IGluZGV4O1xuICB0aGlzLnRleHQgPSB0ZXh0O1xufVxuXG5Ub2tlbi5wcm90b3R5cGUgPSB7XG4gIHdpdGhPcDogZnVuY3Rpb24gKG9wKSB7XG4gICAgdGhpcy5vcEtleSA9IG9wO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuICB3aXRoR2V0dGVyU2V0dGVyOiBmdW5jdGlvbiAoa2V5KSB7XG4gICAgdGhpcy5rZXkgPSBrZXk7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG4gIHdpdGhWYWx1ZTogZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdGhpcy52YWx1ZSA9IHZhbHVlO1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuICB0b1N0cmluZzogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAnVG9rZW4oJyArIHRoaXMudGV4dCArICcpJztcbiAgfVxufTtcblxuLyoqXG4gKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICogQHJldHVybiB7QXJyYXl9IEFycmF5T2ZUb2tlbnNcbiAqL1xuZnVuY3Rpb24gbGV4ICh0ZXh0KSB7XG4gIHZhciBzY2FubmVyID0gbmV3IFNjYW5uZXIodGV4dCk7XG4gIHZhciB0b2tlbnMgPSBbXTtcbiAgdmFyIHRva2VuID0gc2Nhbm5lci5zY2FuVG9rZW4oKTtcblxuICB3aGlsZSAodG9rZW4pIHtcbiAgICB0b2tlbnMucHVzaCh0b2tlbik7XG4gICAgdG9rZW4gPSBzY2FubmVyLnNjYW5Ub2tlbigpO1xuICB9XG5cbiAgcmV0dXJuIHRva2Vucztcbn1cblxuLyoqXG4gKiBAcGFyYW0ge1N0cmluZ30gaW5wdXRcbiAqL1xuZnVuY3Rpb24gU2Nhbm5lciAoaW5wdXQpIHtcbiAgdGhpcy5pbnB1dCA9IGlucHV0O1xuICB0aGlzLmxlbmd0aCA9IGlucHV0Lmxlbmd0aDtcbiAgdGhpcy5wZWVrID0gMDtcbiAgdGhpcy5pbmRleCA9IC0xO1xuXG4gIHRoaXMuYWR2YW5jZSgpO1xufVxuXG5TY2FubmVyLnByb3RvdHlwZSA9IHtcblxuICAvKipcbiAgICogQHJldHVybiB7VG9rZW59XG4gICAqL1xuICBzY2FuVG9rZW46IGZ1bmN0aW9uICgpIHtcbiAgICAgIC8vIFNraXAgd2hpdGVzcGFjZS5cbiAgICB3aGlsZSAodGhpcy5wZWVrIDw9ICRTUEFDRSkge1xuICAgICAgaWYgKCsrdGhpcy5pbmRleCA+PSB0aGlzLmxlbmd0aCkge1xuICAgICAgICB0aGlzLnBlZWsgPSAkRU9GO1xuICAgICAgICByZXR1cm4gbnVsbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMucGVlayA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLmluZGV4KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBIYW5kbGUgaWRlbnRpZmllcnMgYW5kIG51bWJlcnMuXG4gICAgaWYgKGlzSWRlbnRpZmllclN0YXJ0KHRoaXMucGVlaykpIHtcbiAgICAgIHJldHVybiB0aGlzLnNjYW5JZGVudGlmaWVyKCk7XG4gICAgfVxuXG4gICAgaWYgKGlzRGlnaXQodGhpcy5wZWVrKSkge1xuICAgICAgcmV0dXJuIHRoaXMuc2Nhbk51bWJlcih0aGlzLmluZGV4KTtcbiAgICB9XG5cbiAgICB2YXIgc3RhcnQgPSB0aGlzLmluZGV4O1xuXG4gICAgc3dpdGNoICh0aGlzLnBlZWspIHtcbiAgICAgIGNhc2UgJFBFUklPRDpcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIHJldHVybiBpc0RpZ2l0KHRoaXMucGVlaykgPyB0aGlzLnNjYW5OdW1iZXIoc3RhcnQpIDogbmV3IFRva2VuKHN0YXJ0LCAnLicpO1xuICAgICAgY2FzZSAkTFBBUkVOOlxuICAgICAgY2FzZSAkUlBBUkVOOlxuICAgICAgY2FzZSAkTEJSQUNFOlxuICAgICAgY2FzZSAkUkJSQUNFOlxuICAgICAgY2FzZSAkTEJSQUNLRVQ6XG4gICAgICBjYXNlICRSQlJBQ0tFVDpcbiAgICAgIGNhc2UgJENPTU1BOlxuICAgICAgY2FzZSAkQ09MT046XG4gICAgICBjYXNlICRTRU1JQ09MT046XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5DaGFyYWN0ZXIoc3RhcnQsIFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy5wZWVrKSk7XG4gICAgICBjYXNlICRTUTpcbiAgICAgIGNhc2UgJERROlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuU3RyaW5nKCk7XG4gICAgICBjYXNlICRQTFVTOlxuICAgICAgY2FzZSAkTUlOVVM6XG4gICAgICBjYXNlICRTVEFSOlxuICAgICAgY2FzZSAkU0xBU0g6XG4gICAgICBjYXNlICRQRVJDRU5UOlxuICAgICAgY2FzZSAkQ0FSRVQ6XG4gICAgICBjYXNlICRRVUVTVElPTjpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2Nhbk9wZXJhdG9yKHN0YXJ0LCBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucGVlaykpO1xuICAgICAgY2FzZSAkTFQ6XG4gICAgICBjYXNlICRHVDpcbiAgICAgIGNhc2UgJEJBTkc6XG4gICAgICBjYXNlICRFUTpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhbkNvbXBsZXhPcGVyYXRvcihzdGFydCwgJEVRLCBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucGVlayksICc9Jyk7XG4gICAgICBjYXNlICRBTVBFUlNBTkQ6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Db21wbGV4T3BlcmF0b3Ioc3RhcnQsICRBTVBFUlNBTkQsICcmJywgJyYnKTtcbiAgICAgIGNhc2UgJEJBUjpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhbkNvbXBsZXhPcGVyYXRvcihzdGFydCwgJEJBUiwgJ3wnLCAnfCcpO1xuICAgICAgY2FzZSAkVElMREU6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Db21wbGV4T3BlcmF0b3Ioc3RhcnQsICRTTEFTSCwgJ34nLCAnLycpO1xuICAgICAgY2FzZSAkTkJTUDpcbiAgICAgICAgd2hpbGUgKGlzV2hpdGVzcGFjZSh0aGlzLnBlZWspKXtcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Ub2tlbigpO1xuICAgIH1cblxuICAgIHZhciBjaGFyYWN0ZXIgPSBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucGVlayk7XG4gICAgdGhpcy5lcnJvcignVW5leHBlY3RlZCBjaGFyYWN0ZXIgWycgKyBjaGFyYWN0ZXIgKyAnfV0nKTtcbiAgICByZXR1cm4gbnVsbDtcbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHN0cmluZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtUb2tlbn1cbiAgICovXG4gIHNjYW5DaGFyYWN0ZXI6IGZ1bmN0aW9uIChzdGFydCwgdGV4dCkge1xuICAgIGFzc2VydCh0aGlzLnBlZWsgPT0gdGV4dC5jaGFyQ29kZUF0KDApKTtcbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbmV3IFRva2VuKHN0YXJ0LCB0ZXh0KTtcbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHN0cmluZ1xuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcmV0dXJuIHtUb2tlbn1cbiAgICovXG4gIHNjYW5PcGVyYXRvcjogZnVuY3Rpb24gKHN0YXJ0LCB0ZXh0KSB7XG4gICAgYXNzZXJ0KHRoaXMucGVlayA9PSB0ZXh0LmNoYXJDb2RlQXQoMCkpO1xuICAgIGFzc2VydChPUEVSQVRPUlMuaW5kZXhPZih0ZXh0KSAhPSAtMSk7XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG5ldyBUb2tlbihzdGFydCwgdGV4dCkud2l0aE9wKHRleHQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge051bWJlcn0gc3RhcnRcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGNvZGVcbiAgICogQHBhcmFtIHtTdHJpbmd9IG9uZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gdHdvXG4gICAqIEByZXR1cm4ge1Rva2VufVxuICAgKi9cbiAgc2NhbkNvbXBsZXhPcGVyYXRvcjogZnVuY3Rpb24gKHN0YXJ0LCBjb2RlLCBvbmUsIHR3bykge1xuICAgIGFzc2VydCh0aGlzLnBlZWsgPT0gb25lLmNoYXJDb2RlQXQoMCkpO1xuICAgIHRoaXMuYWR2YW5jZSgpO1xuXG4gICAgdmFyIHRleHQgPSBvbmU7XG5cbiAgICBpZiAodGhpcy5wZWVrID09IGNvZGUpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgdGV4dCArPSB0d287XG4gICAgfVxuXG4gICAgYXNzZXJ0KE9QRVJBVE9SUy5pbmRleE9mKHRleHQpICE9IC0xKTtcblxuICAgIHJldHVybiBuZXcgVG9rZW4oc3RhcnQsIHRleHQpLndpdGhPcCh0ZXh0KTtcbiAgfSxcblxuICAvKipcbiAgICogQHJldHVybiB7VG9rZW59XG4gICAqL1xuICBzY2FuSWRlbnRpZmllcjogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdGFydCA9IHRoaXMuaW5kZXg7XG5cbiAgICB0aGlzLmFkdmFuY2UoKTtcblxuICAgIHdoaWxlIChpc0lkZW50aWZpZXJQYXJ0KHRoaXMucGVlaykpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIH1cblxuICAgIHZhciB0ZXh0ID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIHRoaXMuaW5kZXgpO1xuICAgIHZhciByZXN1bHQgPSBuZXcgVG9rZW4oc3RhcnQsIHRleHQpO1xuXG4gICAgLy8gVE9ETyhrYXNwZXJsKTogRGVhbCB3aXRoIG51bGwsIHVuZGVmaW5lZCwgdHJ1ZSwgYW5kIGZhbHNlIGluXG4gICAgLy8gYSBjbGVhbmVyIGFuZCBmYXN0ZXIgd2F5LlxuICAgIGlmIChPUEVSQVRPUlMuaW5kZXhPZih0ZXh0KSAhPSAtMSkge1xuICAgICAgcmVzdWx0LndpdGhPcCh0ZXh0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVzdWx0LndpdGhHZXR0ZXJTZXR0ZXIodGV4dCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IHN0YXJ0XG4gICAqIEByZXR1cm4ge1Rva2VufVxuICAgKi9cbiAgc2Nhbk51bWJlcjogZnVuY3Rpb24gKHN0YXJ0KSB7XG4gICAgdmFyIHNpbXBsZSA9ICh0aGlzLmluZGV4ID09IHN0YXJ0KTtcbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIFNraXAgaW5pdGlhbCBkaWdpdC5cblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAoaXNEaWdpdCh0aGlzLnBlZWspKSB7XG4gICAgICAgIC8vIERvIG5vdGhpbmcuXG4gICAgICB9IGVsc2UgaWYgKHRoaXMucGVlayA9PSAkUEVSSU9EKSB7XG4gICAgICAgIHNpbXBsZSA9IGZhbHNlO1xuICAgICAgfSBlbHNlIGlmIChpc0V4cG9uZW50U3RhcnQodGhpcy5wZWVrKSkge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcblxuICAgICAgICBpZiAoaXNFeHBvbmVudFNpZ24odGhpcy5wZWVrKSl7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIWlzRGlnaXQodGhpcy5wZWVrKSl7XG4gICAgICAgICAgdGhpcy5lcnJvcignSW52YWxpZCBleHBvbmVudCcsIC0xKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHNpbXBsZSA9IGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG5cbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIH1cblxuICAgIHZhciB0ZXh0ID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIHRoaXMuaW5kZXgpO1xuICAgIHZhciB2YWx1ZSA9IHNpbXBsZSA/IHBhcnNlSW50KHRleHQpIDogcGFyc2VGbG9hdCh0ZXh0KTtcbiAgICByZXR1cm4gbmV3IFRva2VuKHN0YXJ0LCB0ZXh0KS53aXRoVmFsdWUodmFsdWUpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtUb2tlbn1cbiAgICovXG4gIHNjYW5TdHJpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3RhcnQgPSB0aGlzLmluZGV4O1xuICAgIHZhciBxdW90ZSA9IHRoaXMucGVlaztcblxuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gU2tpcCBpbml0aWFsIHF1b3RlLlxuXG4gICAgdmFyIGJ1ZmZlcjtcbiAgICB2YXIgbWFya2VyID0gdGhpcy5pbmRleDtcblxuICAgIHdoaWxlICh0aGlzLnBlZWsgIT0gcXVvdGUpIHtcbiAgICAgIGlmICh0aGlzLnBlZWsgPT0gJEJBQ0tTTEFTSCkge1xuICAgICAgICBpZiAoYnVmZmVyID09IG51bGwpIHtcbiAgICAgICAgICBidWZmZXIgPSBbXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJ1ZmZlci5wdXNoKHRoaXMuaW5wdXQuc3Vic3RyaW5nKG1hcmtlciwgdGhpcy5pbmRleCkpO1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcblxuICAgICAgICB2YXIgdW5lc2NhcGVkO1xuXG4gICAgICAgIGlmICh0aGlzLnBlZWsgPT0gJHUpIHtcbiAgICAgICAgICAvLyBUT0RPKGthc3BlcmwpOiBDaGVjayBib3VuZHM/IE1ha2Ugc3VyZSB3ZSBoYXZlIHRlc3RcbiAgICAgICAgICAvLyBjb3ZlcmFnZSBmb3IgdGhpcy5cbiAgICAgICAgICB2YXIgaGV4ID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcodGhpcy5pbmRleCArIDEsIHRoaXMuaW5kZXggKyA1KTtcblxuICAgICAgICAgIGlmKCEvW0EtWjAtOV17NH0vLnRlc3QoaGV4KSl7XG4gICAgICAgICAgICB0aGlzLmVycm9yKCdJbnZhbGlkIHVuaWNvZGUgZXNjYXBlIFtcXFxcdScgKyBoZXggKyAnXScpO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHVuZXNjYXBlZCA9IHBhcnNlSW50KGhleCwgMTYpO1xuXG4gICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCA1OyBpKyspIHtcbiAgICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB1bmVzY2FwZWQgPSBkZWNvZGVVUklDb21wb25lbnQodGhpcy5wZWVrKTtcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGJ1ZmZlci5wdXNoKFN0cmluZy5mcm9tQ2hhckNvZGUodW5lc2NhcGVkKSk7XG4gICAgICAgIG1hcmtlciA9IHRoaXMuaW5kZXg7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMucGVlayA9PSAkRU9GKSB7XG4gICAgICAgIHRoaXMuZXJyb3IoJ1VudGVybWluYXRlZCBxdW90ZScpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGxhc3QgPSB0aGlzLmlucHV0LnN1YnN0cmluZyhtYXJrZXIsIHRoaXMuaW5kZXgpO1xuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gU2tpcCB0ZXJtaW5hdGluZyBxdW90ZS5cbiAgICB2YXIgdGV4dCA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmluZGV4KTtcblxuICAgIC8vIENvbXB1dGUgdGhlIHVuZXNjYXBlZCBzdHJpbmcgdmFsdWUuXG4gICAgdmFyIHVuZXNjYXBlZCA9IGxhc3Q7XG5cbiAgICBpZiAoYnVmZmVyICE9IG51bGwpIHtcbiAgICAgIGJ1ZmZlci5wdXNoKGxhc3QpO1xuICAgICAgdW5lc2NhcGVkID0gYnVmZmVyLmpvaW4oJycpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgVG9rZW4oc3RhcnQsIHRleHQpLndpdGhWYWx1ZSh1bmVzY2FwZWQpO1xuICB9LFxuXG4gIGFkdmFuY2U6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoKyt0aGlzLmluZGV4ID49IHRoaXMubGVuZ3RoKXtcbiAgICAgIHRoaXMucGVlayA9ICRFT0Y7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMucGVlayA9IHRoaXMuaW5wdXQuY2hhckNvZGVBdCh0aGlzLmluZGV4KTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBtZXNzYWdlXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBvZmZzZXRcbiAgICovXG4gIGVycm9yOiBmdW5jdGlvbiAobWVzc2FnZSwgb2Zmc2V0KSB7XG4gICAgb2Zmc2V0ID0gb2Zmc2V0IHx8IDA7XG4gICAgdmFyIHBvc2l0aW9uID0gdGhpcy5pbmRleCArIG9mZnNldDtcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0xleGVyIEVycm9yOiAnICsgbWVzc2FnZSArICcgYXQgY29sdW1uICcgKyBwb3NpdGlvbiArICcgaW4gZXhwcmVzc2lvbiBbJyArIHRoaXMuaW5wdXQgKyAnXScpO1xuICB9XG59O1xuXG52YXIgJEVPRiAgICAgICA9IDA7XG52YXIgJFRBQiAgICAgICA9IDk7XG52YXIgJExGICAgICAgICA9IDEwO1xudmFyICRWVEFCICAgICAgPSAxMTtcbnZhciAkRkYgICAgICAgID0gMTI7XG52YXIgJENSICAgICAgICA9IDEzO1xudmFyICRTUEFDRSAgICAgPSAzMjtcbnZhciAkQkFORyAgICAgID0gMzM7XG52YXIgJERRICAgICAgICA9IDM0O1xudmFyICQkICAgICAgICAgPSAzNjtcbnZhciAkUEVSQ0VOVCAgID0gMzc7XG52YXIgJEFNUEVSU0FORCA9IDM4O1xudmFyICRTUSAgICAgICAgPSAzOTtcbnZhciAkTFBBUkVOICAgID0gNDA7XG52YXIgJFJQQVJFTiAgICA9IDQxO1xudmFyICRTVEFSICAgICAgPSA0MjtcbnZhciAkUExVUyAgICAgID0gNDM7XG52YXIgJENPTU1BICAgICA9IDQ0O1xudmFyICRNSU5VUyAgICAgPSA0NTtcbnZhciAkUEVSSU9EICAgID0gNDY7XG52YXIgJFNMQVNIICAgICA9IDQ3O1xudmFyICRDT0xPTiAgICAgPSA1ODtcbnZhciAkU0VNSUNPTE9OID0gNTk7XG52YXIgJExUICAgICAgICA9IDYwO1xudmFyICRFUSAgICAgICAgPSA2MTtcbnZhciAkR1QgICAgICAgID0gNjI7XG52YXIgJFFVRVNUSU9OICA9IDYzO1xuXG52YXIgJDAgPSA0ODtcbnZhciAkOSA9IDU3O1xuXG52YXIgJEEgPSA2NTtcbnZhciAkRSA9IDY5O1xudmFyICRaID0gOTA7XG5cbnZhciAkTEJSQUNLRVQgID0gOTE7XG52YXIgJEJBQ0tTTEFTSCA9IDkyO1xudmFyICRSQlJBQ0tFVCAgPSA5MztcbnZhciAkQ0FSRVQgICAgID0gOTQ7XG52YXIgJF8gICAgICAgICA9IDk1O1xuXG52YXIgJGEgPSA5NztcbnZhciAkZSA9IDEwMTtcbnZhciAkZiA9IDEwMjtcbnZhciAkbiA9IDExMDtcbnZhciAkciA9IDExNDtcbnZhciAkdCA9IDExNjtcbnZhciAkdSA9IDExNztcbnZhciAkdiA9IDExODtcbnZhciAkeiA9IDEyMjtcblxudmFyICRMQlJBQ0UgPSAxMjM7XG52YXIgJEJBUiAgICA9IDEyNDtcbnZhciAkUkJSQUNFID0gMTI1O1xudmFyICRUSUxERSAgPSAxMjY7XG52YXIgJE5CU1AgICA9IDE2MDtcblxudmFyIE9QRVJBVE9SUyA9IFtcbiAgJ3VuZGVmaW5lZCcsXG4gICdudWxsJyxcbiAgJ3RydWUnLFxuICAnZmFsc2UnLFxuICAnKycsXG4gICctJyxcbiAgJyonLFxuICAnLycsXG4gICd+LycsXG4gICclJyxcbiAgJ14nLFxuICAnPScsXG4gICc9PScsXG4gICchPScsXG4gICc8JyxcbiAgJz4nLFxuICAnPD0nLFxuICAnPj0nLFxuICAnJiYnLFxuICAnfHwnLFxuICAnJicsXG4gICd8JyxcbiAgJyEnLFxuICAnPydcbl07XG5cbmZ1bmN0aW9uIGlzV2hpdGVzcGFjZShjb2RlKSB7XG4gIHJldHVybiAoY29kZSA+PSAkVEFCICYmIGNvZGUgPD0gJFNQQUNFKSB8fCAoY29kZSA9PSAkTkJTUCk7XG59XG5cbmZ1bmN0aW9uIGlzSWRlbnRpZmllclN0YXJ0KGNvZGUpIHtcbiAgcmV0dXJuICgkYSA8PSBjb2RlICYmIGNvZGUgPD0gJHopXG4gICAgICB8fCAoJEEgPD0gY29kZSAmJiBjb2RlIDw9ICRaKVxuICAgICAgfHwgKGNvZGUgPT0gJF8pXG4gICAgICB8fCAoY29kZSA9PSAkJCk7XG59XG5cbmZ1bmN0aW9uIGlzSWRlbnRpZmllclBhcnQoY29kZSkge1xuICByZXR1cm4gKCRhIDw9IGNvZGUgJiYgY29kZSA8PSAkeilcbiAgICAgIHx8ICgkQSA8PSBjb2RlICYmIGNvZGUgPD0gJFopXG4gICAgICB8fCAoJDAgPD0gY29kZSAmJiBjb2RlIDw9ICQ5KVxuICAgICAgfHwgKGNvZGUgPT0gJF8pXG4gICAgICB8fCAoY29kZSA9PSAkJCk7XG59XG5cbmZ1bmN0aW9uIGlzRGlnaXQoY29kZSkge1xuICByZXR1cm4gKCQwIDw9IGNvZGUgJiYgY29kZSA8PSAkOSk7XG59XG5cbmZ1bmN0aW9uIGlzRXhwb25lbnRTdGFydChjb2RlKSB7XG4gIHJldHVybiAoY29kZSA9PSAkZSB8fCBjb2RlID09ICRFKTtcbn1cblxuZnVuY3Rpb24gaXNFeHBvbmVudFNpZ24oY29kZSkge1xuICByZXR1cm4gKGNvZGUgPT0gJE1JTlVTIHx8IGNvZGUgPT0gJFBMVVMpO1xufVxuXG5mdW5jdGlvbiB1bmVzY2FwZShjb2RlKSB7XG4gIHN3aXRjaChjb2RlKSB7XG4gICAgY2FzZSAkbjogcmV0dXJuICRMRjtcbiAgICBjYXNlICRmOiByZXR1cm4gJEZGO1xuICAgIGNhc2UgJHI6IHJldHVybiAkQ1I7XG4gICAgY2FzZSAkdDogcmV0dXJuICRUQUI7XG4gICAgY2FzZSAkdjogcmV0dXJuICRWVEFCO1xuICAgIGRlZmF1bHQ6IHJldHVybiBjb2RlO1xuICB9XG59XG5cbmZ1bmN0aW9uIGFzc2VydChjb25kaXRpb24sIG1lc3NhZ2UpIHtcbiAgaWYgKCFjb25kaXRpb24pIHtcbiAgICB0aHJvdyBtZXNzYWdlIHx8IFwiQXNzZXJ0aW9uIGZhaWxlZFwiO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBUb2tlbjogVG9rZW4sXG4gIGxleDogbGV4XG59O1xuIiwidmFyIExleGVyID0gcmVxdWlyZSgnLi9sZXhlcicpO1xudmFyIEV4cHJlc3Npb25zID0gcmVxdWlyZSgnLi9hc3QnKTtcblxudmFyIEJpbmFyeSA9IEV4cHJlc3Npb25zLkJpbmFyeTtcbnZhciBBY2Nlc3NNZW1iZXIgPSBFeHByZXNzaW9ucy5BY2Nlc3NNZW1iZXI7XG52YXIgQWNjZXNzU2NvcGUgPSBFeHByZXNzaW9ucy5BY2Nlc3NTY29wZTtcbnZhciBQcmVmaXhOb3QgPSBFeHByZXNzaW9ucy5QcmVmaXhOb3Q7XG52YXIgTGl0ZXJhbFByaW1pdGl2ZSA9IEV4cHJlc3Npb25zLkxpdGVyYWxQcmltaXRpdmU7XG52YXIgQ29uZGl0aW9uYWwgPSBFeHByZXNzaW9ucy5Db25kaXRpb25hbDtcblxuZnVuY3Rpb24gUGFyc2VyICgpIHtcbiAgdGhpcy5jYWNoZSA9IHt9O1xufVxuXG5QYXJzZXIucHJvdG90eXBlID0ge1xuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IGlucHV0XG4gICAqIEByZXR1cm4ge1BhcnNlckltcGxlbWVudGF0aW9ufVxuICAgKi9cbiAgcGFyc2U6IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIGlucHV0ID0gaW5wdXQgfHwgJyc7XG5cbiAgICBpZiAoIXRoaXMuY2FjaGUuaGFzT3duUHJvcGVydHkoaW5wdXQpKSB7XG4gICAgICB0aGlzLmNhY2hlW2lucHV0XSA9IG5ldyBQYXJzZXJJbXBsZW1lbnRhdGlvbihMZXhlciwgaW5wdXQpLnBhcnNlKCk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHRoaXMuY2FjaGVbaW5wdXRdO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXRcbiAgICogQHJldHVybiB7T2JqZWN0fVxuICAgKi9cbiAgcGFyc2VPYmplY3Q6IGZ1bmN0aW9uIChpbnB1dCkge1xuICAgIHZhciBvYmogPSB7fTtcbiAgICB2YXIgYWNjZXNzU2NvcGVOYW1lcyA9IFtdO1xuXG4gICAgLy8gVE9ETzogdGhlcmUgYXJlIGVkZ2VzIGNhc2VzIGhlcmUgd2hlbiB1c2luZyBzcGxpdFxuICAgIGlucHV0LnNwbGl0KCc7JykuZm9yRWFjaChmdW5jdGlvbiAoZXhwKSB7XG4gICAgICB2YXIga2V5U2VwYXJhdG9ySW5kZXggPSBleHAuaW5kZXhPZignOicpO1xuICAgICAgdmFyIGV4cHJlc3Npb24gPSB0aGlzLnBhcnNlKGV4cC5zdWJzdHJpbmcoa2V5U2VwYXJhdG9ySW5kZXggKyAxKS50cmltKCkpO1xuICAgICAgYWNjZXNzU2NvcGVOYW1lcyA9IGFjY2Vzc1Njb3BlTmFtZXMuY29uY2F0KGV4cHJlc3Npb24uYWNjZXNzU2NvcGVOYW1lcyk7XG4gICAgICBvYmpbZXhwLnN1YnN0cmluZygwLCBrZXlTZXBhcmF0b3JJbmRleCldID0gZXhwcmVzc2lvbjtcbiAgICB9LmJpbmQodGhpcykpO1xuXG4gICAgcmV0dXJuIHtcbiAgICAgIGlucHV0OiBpbnB1dCxcbiAgICAgIGFjY2Vzc1Njb3BlTmFtZXM6IGFjY2Vzc1Njb3BlTmFtZXMsXG4gICAgICBldmFsOiBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICAgICAgdmFyIHJldHVybk9iaiA9IHt9O1xuXG4gICAgICAgIE9iamVjdC5rZXlzKG9iaikuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICAgICAgcmV0dXJuT2JqW2tleV0gPSBvYmpba2V5XS5ldmFsKHNjb3BlKTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgcmV0dXJuIHJldHVybk9iajtcbiAgICAgIH1cbiAgICB9O1xuICB9XG59XG5cbnZhciBFT0YgPSBuZXcgTGV4ZXIuVG9rZW4oLTEsIG51bGwpO1xuXG4vKipcbiAqIEBwYXJhbSB7T2JqZWN0fSBsZXhlclxuICogQHBhcmFtIHtTdHJpbmd9IGlucHV0XG4gKi9cbmZ1bmN0aW9uIFBhcnNlckltcGxlbWVudGF0aW9uKGxleGVyLCBpbnB1dCkge1xuICB0aGlzLmluZGV4ID0gMDtcbiAgdGhpcy5pbnB1dCA9IGlucHV0O1xuICB0aGlzLmFjY2Vzc1Njb3BlTmFtZXMgPSBbXTtcbiAgdGhpcy50b2tlbnMgPSBsZXhlci5sZXgoaW5wdXQpO1xufVxuXG5QYXJzZXJJbXBsZW1lbnRhdGlvbi5wcm90b3R5cGUgPSB7XG5cbiAgcGVlazogZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkgPyB0aGlzLnRva2Vuc1t0aGlzLmluZGV4XSA6IEVPRjtcbiAgfSxcblxuICBwYXJzZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciBleHByZXNzaW9uID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICAvLyBleHBvc2UgdXNlZnVsIGluZm9ybWF0aW9uXG4gICAgZXhwcmVzc2lvbi5pbnB1dCA9IHRoaXMuaW5wdXQ7XG4gICAgZXhwcmVzc2lvbi5hY2Nlc3NTY29wZU5hbWVzID0gdGhpcy5hY2Nlc3NTY29wZU5hbWVzO1xuICAgIHJldHVybiBleHByZXNzaW9uO1xuICB9LFxuXG4gIHBhcnNlRXhwcmVzc2lvbjogZnVuY3Rpb24gKCkgIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZUNvbmRpdGlvbmFsKCk7XG5cbiAgICB3aGlsZSAodGhpcy5vcHRpb25hbCgnKScpKSB7XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgcGFyc2VDb25kaXRpb25hbDogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdGFydCA9IHRoaXMucGVlaygpLmluZGV4LFxuICAgICAgcmVzdWx0ID0gdGhpcy5wYXJzZUxvZ2ljYWxPcigpO1xuXG4gICAgaWYgKHRoaXMub3B0aW9uYWwoJz8nKSkge1xuICAgICAgdmFyIHllcyA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG5cbiAgICAgIGlmICghdGhpcy5vcHRpb25hbCgnOicpKSB7XG4gICAgICAgIHZhciBlbmQgPSAodGhpcy5pbmRleCA8IHRoaXMudG9rZW5zLmxlbmd0aCkgPyB0aGlzLnBlZWsoKS5pbmRleCA6IHRoaXMuaW5wdXQubGVuZ3RoO1xuICAgICAgICB2YXIgZXhwcmVzc2lvbiA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCBlbmQpO1xuXG4gICAgICAgIHRoaXMuZXJyb3IoJ0NvbmRpdGlvbmFsIGV4cHJlc3Npb24nICsgZXhwcmVzc2lvbiArICdyZXF1aXJlcyBhbGwgMyBleHByZXNzaW9ucycpO1xuICAgICAgfVxuXG4gICAgICB2YXIgbm8gPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgICAgcmVzdWx0ID0gbmV3IENvbmRpdGlvbmFsKHJlc3VsdCwgeWVzLCBubyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICBwYXJzZUxvZ2ljYWxPcjogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlTG9naWNhbEFuZCgpO1xuXG4gICAgd2hpbGUgKHRoaXMub3B0aW9uYWwoJ3x8JykpIHtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJ3x8JywgcmVzdWx0LCB0aGlzLnBhcnNlTG9naWNhbEFuZCgpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuXG4gIHBhcnNlTG9naWNhbEFuZDogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlRXF1YWxpdHkoKTtcblxuICAgIHdoaWxlICh0aGlzLm9wdGlvbmFsKCcmJicpKSB7XG4gICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCcmJicsIHJlc3VsdCwgdGhpcy5wYXJzZUVxdWFsaXR5KCkpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgcGFyc2VFcXVhbGl0eTogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlUmVsYXRpb25hbCgpO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbmFsKCc9PScpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJz09JywgcmVzdWx0LCB0aGlzLnBhcnNlUmVsYXRpb25hbCgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnIT0nKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCchPScsIHJlc3VsdCwgdGhpcy5wYXJzZVJlbGF0aW9uYWwoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwYXJzZVJlbGF0aW9uYWw6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZUFkZGl0aXZlKCk7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMub3B0aW9uYWwoJzwnKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCc8JywgcmVzdWx0LCB0aGlzLnBhcnNlQWRkaXRpdmUoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJz4nKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCc+JywgcmVzdWx0LCB0aGlzLnBhcnNlQWRkaXRpdmUoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJzw9JykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnPD0nLCByZXN1bHQsIHRoaXMucGFyc2VBZGRpdGl2ZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnPj0nKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCc+PScsIHJlc3VsdCwgdGhpcy5wYXJzZUFkZGl0aXZlKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgcGFyc2VBZGRpdGl2ZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25hbCgnKycpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJysnLCByZXN1bHQsIHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnLScpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJy0nLCByZXN1bHQsIHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHBhcnNlTXVsdGlwbGljYXRpdmU6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZVByZWZpeCgpO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbmFsKCcqJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnKicsIHJlc3VsdCwgdGhpcy5wYXJzZVByZWZpeCgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnJScpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJyUnLCByZXN1bHQsIHRoaXMucGFyc2VQcmVmaXgoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJy8nKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCcvJywgcmVzdWx0LCB0aGlzLnBhcnNlUHJlZml4KCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCd+LycpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJ34vJywgcmVzdWx0LCB0aGlzLnBhcnNlUHJlZml4KCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgcGFyc2VQcmVmaXg6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5vcHRpb25hbCgnKycpKSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZVByZWZpeCgpOyAvLyBUT0RPKGthc3BlcmwpOiBUaGlzIGlzIGRpZmZlcmVudCB0aGFuIHRoZSBvcmlnaW5hbCBwYXJzZXIuXG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCctJykpIHtcbiAgICAgIHJldHVybiBuZXcgQmluYXJ5KCctJywgbmV3IExpdGVyYWxQcmltaXRpdmUoMCksIHRoaXMucGFyc2VQcmVmaXgoKSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCchJykpIHtcbiAgICAgIHJldHVybiBuZXcgUHJlZml4Tm90KCchJywgdGhpcy5wYXJzZVByZWZpeCgpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VBY2Nlc3NNZW1iZXIoKTtcbiAgICB9XG4gIH0sXG5cbiAgcGFyc2VBY2Nlc3NNZW1iZXI6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZVByaW1hcnkoKTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25hbCgnLicpKSB7XG4gICAgICAgIHZhciBuYW1lID0gdGhpcy5wZWVrKCkudGV4dDtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBBY2Nlc3NNZW1iZXIocmVzdWx0LCBuYW1lKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHBhcnNlUHJpbWFyeTogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbmFsKCcoJykpIHtcbiAgICAgIC8vIFRPRE9cbiAgICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnbnVsbCcpIHx8IHRoaXMub3B0aW9uYWwoJ3VuZGVmaW5lZCcpKSB7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUobnVsbCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCd0cnVlJykpIHtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0cnVlKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJ2ZhbHNlJykpIHtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZShmYWxzZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnBlZWsoKS5rZXkgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VBY2Nlc3NTY29wZSgpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wZWVrKCkudmFsdWUgIT0gbnVsbCkge1xuICAgICAgdmFyIHZhbHVlID0gdGhpcy5wZWVrKCkudmFsdWU7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh2YWx1ZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmluZGV4ID49IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBleHByZXNzaW9uOiAnICsgdGhpcy5pbnB1dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZXJyb3IoJ1VuZXhwZWN0ZWQgdG9rZW4gJyArIHRoaXMucGVlaygpLnRleHQpO1xuICAgIH1cblxuICB9LFxuXG4gIHBhcnNlQWNjZXNzU2NvcGU6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbmFtZSA9IHRoaXMucGVlaygpLmtleTtcblxuICAgIHRoaXMuYWR2YW5jZSgpO1xuXG4gICAgaWYgKHRoaXMuYWNjZXNzU2NvcGVOYW1lcy5pbmRleE9mKG5hbWUpID09PSAtMSkge1xuICAgICAgdGhpcy5hY2Nlc3NTY29wZU5hbWVzLnB1c2gobmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBBY2Nlc3NTY29wZShuYW1lKTtcbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICovXG4gIG9wdGlvbmFsOiBmdW5jdGlvbiAodGV4dCkge1xuICAgIGlmICh0aGlzLnBlZWsoKS50ZXh0ID09IHRleHQpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuXG4gIGFkdmFuY2U6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmluZGV4Kys7XG4gIH0sXG5cbiAgZXJyb3I6IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgdmFyIGxvY2F0aW9uID0gKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID9cbiAgICAgICdhdCBjb2x1bW4gJyArIHRoaXMudG9rZW5zW3RoaXMuaW5kZXhdLmluZGV4ICsgMSArICcgaW4nIDpcbiAgICAgICdhdCB0aGUgZW5kIG9mIHRoZSBleHByZXNzaW9uJztcblxuICAgIHRocm93IG5ldyBFcnJvcignUGFyc2VyIEVycm9yOiAnICsgbWVzc2FnZSArICcgJyArIGxvY2F0aW9uICsgJyBbJyArIHRoaXMuaW5wdXQgKyAnXScpO1xuICB9XG5cbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIFBhcnNlcjogUGFyc2VyLFxuICBQYXJzZXJJbXBsZW1lbnRhdGlvbjogUGFyc2VySW1wbGVtZW50YXRpb25cbn07XG4iLCJ2YXIgU3RhdGVmdWxGb3JtRWxlbWVudCA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtZm9ybS1lbGVtZW50Jyk7XG5cbnZhciBDbHMgPSBmdW5jdGlvbiBTdGF0ZWZ1bENoZWNrYm94ICgpIHtcbiAgU3RhdGVmdWxGb3JtRWxlbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxudmFyIFByb3RvID0gQ2xzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxGb3JtRWxlbWVudC5wcm90b3R5cGUpO1xuXG5Qcm90by5iaW5kRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMudXBkYXRlVmFsdWUuYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by51cGRhdGVWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zZXRTdGF0ZSh7IHZhbHVlOiB0aGlzLmdldFZhbHVlKCksIHByaXN0aW5lOiBmYWxzZSwgdG91Y2hlZDogdHJ1ZSB9KTtcbn07XG5cblByb3RvLmlzVmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmVsLmhhc0F0dHJpYnV0ZSgncmVxdWlyZWQnKSkge1xuICAgIHJldHVybiB0aGlzLmVsLmNoZWNrZWQ7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5Qcm90by5nZXRWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZWwuY2hlY2tlZDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xzO1xuIiwidmFyIFN0YXRlZnVsT2JqZWN0ID0gcmVxdWlyZSgnLi4vc3RhdGVmdWwtb2JqZWN0Jyk7XG52YXIgcmVmbGVjdFN0YXRlID0gcmVxdWlyZSgnLi4vdXRpbHMnKS5yZWZsZWN0U3RhdGU7XG5cbmZ1bmN0aW9uIFN0YXRlZnVsRm9ybUVsZW1lbnQgKGVsKSB7XG4gIHRoaXMuZWwgPSBlbDtcbiAgdGhpcy5uYW1lID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ25hbWUnKTtcbiAgU3RhdGVmdWxPYmplY3QuY2FsbCh0aGlzKTtcbiAgdGhpcy5vblN0YXRlQ2hhbmdlKHJlZmxlY3RTdGF0ZS5iaW5kKG51bGwsIHRoaXMuZWwpKTtcbiAgdGhpcy5iaW5kRXZlbnRzKCk7XG4gIHRoaXMudHJpZ2dlclN0YXRlQ2hhbmdlKCk7XG59XG5cbnZhciBQcm90byA9IFN0YXRlZnVsRm9ybUVsZW1lbnQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bE9iamVjdC5wcm90b3R5cGUpO1xuXG5Qcm90by5nZXREZWZhdWx0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHtcbiAgICB2YWxpZDogdGhpcy5pc1ZhbGlkKCksXG4gICAgcHJpc3RpbmU6IHRydWUsXG4gICAgdG91Y2hlZDogZmFsc2UsXG4gICAgdmFsdWU6IHRoaXMuZ2V0VmFsdWUoKVxuICB9O1xuXG4gIHJldHVybiBzdGF0ZTtcbn07XG5cblByb3RvLmdldFZhbHVlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5lbC52YWx1ZTtcbn07XG5cblByb3RvLmNvbXB1dGVkU3RhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgc3RhdGUudmFsaWQgPSB0aGlzLmlzVmFsaWQoKTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihzdGF0ZSwge1xuICAgIGludmFsaWQ6ICFzdGF0ZS52YWxpZCxcbiAgICBkaXJ0eTogIXN0YXRlLnByaXN0aW5lLFxuICAgIHVudG91Y2hlZDogIXN0YXRlLnRvdWNoZWRcbiAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsRm9ybUVsZW1lbnQ7XG4iLCJ2YXIgU3RhdGVmdWxPYmplY3QgPSByZXF1aXJlKCcuLi9zdGF0ZWZ1bC1vYmplY3QnKTtcblxudmFyIENscyA9IGZ1bmN0aW9uIFN0YXRlZnVsUmFkaW9Hcm91cCAobmFtZSkge1xuICB0aGlzLm5hbWUgPSBuYW1lO1xuICB0aGlzLnJhZGlvcyA9IFtdO1xuICB0aGlzLnJlcXVpcmVkID0gZmFsc2U7XG4gIHRoaXMuaGFuZGxlUmFkaW9TdGF0ZUNoYW5nZSA9IHRoaXMuaGFuZGxlUmFkaW9TdGF0ZUNoYW5nZS5iaW5kKHRoaXMpO1xuICBTdGF0ZWZ1bE9iamVjdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxudmFyIFByb3RvID0gQ2xzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxPYmplY3QucHJvdG90eXBlKTtcblxuLyoqXG4gKiBAcGFyYW0ge1N0YXRlZnVsUmFkaW99IHJhZGlvXG4gKi9cblByb3RvLmFkZFJhZGlvID0gZnVuY3Rpb24gKHJhZGlvKSB7XG4gIHJhZGlvLmluZGV4ID0gdGhpcy5yYWRpb3MubGVuZ3RoO1xuICB0aGlzLnJlcXVpcmVkID0gdGhpcy5yZXF1aXJlZCB8fCByYWRpby5lbC5oYXNBdHRyaWJ1dGUoJ3JlcXVpcmVkJyk7XG4gIHRoaXMucmFkaW9zLnB1c2gocmFkaW8pO1xuICByYWRpby5vblN0YXRlQ2hhbmdlKHRoaXMuaGFuZGxlUmFkaW9TdGF0ZUNoYW5nZSk7XG59XG5cblByb3RvLnRyaWdnZXJSYWRpb3NTdGF0ZUNoYW5nZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5yYWRpb3MuZm9yRWFjaChmdW5jdGlvbiAocmFkaW8pIHtcbiAgICByYWRpby50cmlnZ2VyU3RhdGVDaGFuZ2UoKTtcbiAgfSk7XG59O1xuXG5Qcm90by5nZXREZWZhdWx0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIC8vIFRoaXMgaXMgYWN0dWFsbHkgbm90IHNvIGltcG9ydGFudCBzaW5jZSBhbGwgY2hpbGRyZW4gd2lsbCBiZVxuICByZXR1cm4ge1xuICAgIHByaXN0aW5lOiB0cnVlLFxuICAgIHZhbGlkOiBmYWxzZSxcbiAgICB0b3VjaGVkOiBmYWxzZVxuICB9O1xufTtcblxuUHJvdG8uaGFuZGxlUmFkaW9TdGF0ZUNoYW5nZSA9IGZ1bmN0aW9uIChzdGF0ZSwgcGFydGlhbFN0YXRlLCBrZXksIG9iaikge1xuICB2YXIgaXNWYWxpZCA9ICF0aGlzLnJlcXVpcmVkIHx8ICh0aGlzLnN0YXRlLnZhbGlkIHx8IHN0YXRlLnZhbGlkKTtcbiAgdmFyIGlzUHJpc3RpbmUgPSB0aGlzLnN0YXRlLnByaXN0aW5lICYmIHN0YXRlLnByaXN0aW5lO1xuICB2YXIgaXNUb3VjaGVkID0gdGhpcy5zdGF0ZS50b3VjaGVkIHx8IHN0YXRlLnRvdWNoZWQ7XG5cbiAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgdmFsaWQ6IGlzVmFsaWQsXG4gICAgaW52YWxpZDogIWlzVmFsaWQsXG4gICAgcHJpc3RpbmU6IGlzUHJpc3RpbmUsXG4gICAgZGlydHk6ICFpc1ByaXN0aW5lLFxuICAgIHRvdWNoZWQ6IGlzVG91Y2hlZCxcbiAgICB1bnRvdWNoZWQ6ICFpc1RvdWNoZWRcbiAgfSwgdGhpcy5uYW1lKTtcbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSBDbHM7XG4iLCJ2YXIgU3RhdGVmdWxGb3JtRWxlbWVudCA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtZm9ybS1lbGVtZW50Jyk7XG5cbnZhciBDbHMgPSBmdW5jdGlvbiBTdGF0ZWZ1bFJhZGlvICgpIHtcbiAgU3RhdGVmdWxGb3JtRWxlbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxudmFyIFByb3RvID0gQ2xzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxGb3JtRWxlbWVudC5wcm90b3R5cGUpO1xuXG5Qcm90by5iaW5kRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMudXBkYXRlVmFsdWUuYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by51cGRhdGVWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zZXRTdGF0ZSh7IHZhbHVlOiB0aGlzLmdldFZhbHVlKCksIHByaXN0aW5lOiBmYWxzZSwgdG91Y2hlZDogdHJ1ZSB9KTtcbn07XG5cblByb3RvLmlzVmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmdldFZhbHVlKCk7XG59O1xuXG5Qcm90by5nZXRWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZWwuY2hlY2tlZDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xzO1xuIiwidmFyIFN0YXRlZnVsRm9ybUVsZW1lbnQgPSByZXF1aXJlKCcuL3N0YXRlZnVsLWZvcm0tZWxlbWVudCcpO1xuXG5mdW5jdGlvbiBTdGF0ZWZ1bFNlbGVjdCAoKSB7XG4gIFN0YXRlZnVsRm9ybUVsZW1lbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxudmFyIFByb3RvID0gU3RhdGVmdWxTZWxlY3QucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bEZvcm1FbGVtZW50LnByb3RvdHlwZSk7XG5cblByb3RvLmJpbmRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy51cGRhdGVWYWx1ZS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLnVwZGF0ZVZhbHVlID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnNldFN0YXRlKHsgdmFsdWU6IHRoaXMuZ2V0VmFsdWUoKSwgcHJpc3RpbmU6IGZhbHNlLCB0b3VjaGVkOiB0cnVlIH0pO1xufTtcblxuUHJvdG8uaXNWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuICEhdGhpcy5lbC52YWx1ZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVmdWxTZWxlY3Q7XG4iLCJ2YXIgU3RhdGVmdWxGb3JtRWxlbWVudCA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtZm9ybS1lbGVtZW50Jyk7XG5cbmZ1bmN0aW9uIFN0YXRlZnVsVGV4dElucHV0ICgpIHtcbiAgU3RhdGVmdWxGb3JtRWxlbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG52YXIgUHJvdG8gPSBTdGF0ZWZ1bFRleHRJbnB1dC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0YXRlZnVsRm9ybUVsZW1lbnQucHJvdG90eXBlKTtcblxuUHJvdG8uYmluZEV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHVwZGF0ZVZhbHVlID0gdGhpcy51cGRhdGVWYWx1ZS5iaW5kKHRoaXMpO1xuXG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB1cGRhdGVWYWx1ZSk7XG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdXBkYXRlVmFsdWUpO1xuXG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignYmx1cicsIGZ1bmN0aW9uIG9uQmx1ciAoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZSh7IHRvdWNoZWQ6IHRydWUgfSk7XG4gIH0uYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by51cGRhdGVWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zZXRTdGF0ZSh7IHZhbHVlOiB0aGlzLmdldFZhbHVlKCksIHByaXN0aW5lOiBmYWxzZSB9KTtcbn07XG5cblByb3RvLmNvbXB1dGVkU3RhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgc3RhdGUudmFsaWQgPSB0aGlzLmlzVmFsaWQoKTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihzdGF0ZSwge1xuICAgIGludmFsaWQ6ICFzdGF0ZS52YWxpZCxcbiAgICBkaXJ0eTogIXN0YXRlLnByaXN0aW5lLFxuICAgIHVudG91Y2hlZDogIXN0YXRlLnRvdWNoZWRcbiAgfSk7XG59O1xuXG5Qcm90by5nZXRWYWxpZGF0aW9uUnVsZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBydWxlcyA9IFtdO1xuICB2YXIgcmVxdWlyZWQgPSB0aGlzLmVsLmhhc0F0dHJpYnV0ZSgncmVxdWlyZWQnKTtcbiAgdmFyIG1pbiA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdtaW4nKTtcbiAgdmFyIG1heCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdtYXgnKTtcbiAgdmFyIG1heGxlbmd0aCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdtYXhsZW5ndGgnKTtcbiAgdmFyIG1pbmxlbmd0aCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdtaW5sZW5ndGgnKTtcbiAgdmFyIHBhdHRlcm4gPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgncGF0dGVybicpO1xuXG4gIGlmIChyZXF1aXJlZCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gcmVxdWlyZWQgKHZhbCkge1xuICAgICAgcmV0dXJuIHZhbC5sZW5ndGggPiAwO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1pbiAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gbWluICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwgPj0gbWluO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1heCAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gbWF4ICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwgPD0gbWF4O1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1pbmxlbmd0aCAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gbWlubGVuZ3RoICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwubGVuZ3RoID49IG1pbmxlbmd0aDtcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtYXhsZW5ndGggIT09IG51bGwpIHtcbiAgICBydWxlcy5wdXNoKGZ1bmN0aW9uIG1heGxlbmd0aCAodmFsKSB7XG4gICAgICByZXR1cm4gdmFsLmxlbmd0aCA8PSBtYXhsZW5ndGg7XG4gICAgfSk7XG4gIH1cblxuICBpZiAocGF0dGVybiAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gcGF0dGVybiAodmFsKSB7XG4gICAgICByZXR1cm4gdmFsLm1hdGNoKG5ldyBSZWdFeHAocGF0dGVybikpO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHJ1bGVzO1xufTtcblxuUHJvdG8uaXNWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHZhbCA9IHRoaXMuZWwudmFsdWUudHJpbSgpO1xuICAvLyBHZXQgdmFsaWRhdGlvbiBydWxlcyBpcyBhbHdheXMgY2FsbGVkIHRvIGFsbG93IGNoYW5naW5nIG9mIHByb3BlcnRpZXNcbiAgdmFyIHJ1bGVzID0gdGhpcy5nZXRWYWxpZGF0aW9uUnVsZXMoKTtcbiAgdmFyIGlzVmFsaWQgPSB0cnVlO1xuXG4gIGlmICh0aGlzLmVsLmdldEF0dHJpYnV0ZSgndHlwZScpID09PSAnZW1haWwnKSB7XG4gICAgaXNWYWxpZCA9ICh2YWwuaW5kZXhPZignQCcpID4gMCkgJiYgdmFsLmxlbmd0aCA+IDI7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgaXNWYWxpZCA9IHJ1bGVzW2ldKHZhbCkgJiYgaXNWYWxpZDtcbiAgICBpZiAoIWlzVmFsaWQpIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBpc1ZhbGlkO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZWZ1bFRleHRJbnB1dDtcbiIsInZhciBTdGF0ZWZ1bE9iamVjdCA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtb2JqZWN0Jyk7XG52YXIgU3RhdGVmdWxUZXh0SW5wdXQgPSByZXF1aXJlKCcuL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtdGV4dC1pbnB1dCcpO1xudmFyIFN0YXRlZnVsU2VsZWN0ID0gcmVxdWlyZSgnLi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXNlbGVjdCcpO1xudmFyIFN0YXRlZnVsQ2hlY2tib3ggPSByZXF1aXJlKCcuL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtY2hlY2tib3gnKTtcbnZhciBTdGF0ZWZ1bFJhZGlvID0gcmVxdWlyZSgnLi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXJhZGlvJyk7XG52YXIgU3RhdGVmdWxSYWRpb0dyb3VwID0gcmVxdWlyZSgnLi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXJhZGlvLWdyb3VwJyk7XG5cbmZ1bmN0aW9uIFN0YXRlZnVsRm9ybSAoZWwpIHtcbiAgdGhpcy5lbCA9IGVsO1xuICB0aGlzLmhhbmRsZUZvcm1FbGVtZW50U3RhdGVDaGFuZ2UgPSB0aGlzLmhhbmRsZUZvcm1FbGVtZW50U3RhdGVDaGFuZ2UuYmluZCh0aGlzKVxuICB0aGlzLmluaXQoKTtcbiAgU3RhdGVmdWxPYmplY3QuY2FsbCh0aGlzKTtcbiAgdGhpcy5iaW5kRXZlbnRzKCk7XG59XG5cbnZhciBQcm90byA9IFN0YXRlZnVsRm9ybS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0YXRlZnVsT2JqZWN0LnByb3RvdHlwZSk7XG5cbi8qKlxuICogSGFuZGxlIHN0YXRlIGNoYW5nZXMgYnkgZm9ybSBlbGVtZW50c1xuICovXG5Qcm90by5oYW5kbGVGb3JtRWxlbWVudFN0YXRlQ2hhbmdlID0gZnVuY3Rpb24gKHN0YXRlLCBwYXJ0aWFsU3RhdGUsIGtleSkge1xuICB2YXIgbmV3U3RhdGUgPSB7fTtcbiAgbmV3U3RhdGVba2V5XSA9IHN0YXRlO1xuICB0aGlzLnNldFN0YXRlKG5ld1N0YXRlLCBrZXkpO1xufTtcblxuUHJvdG8uc2V0Rm9ybVN0YXRlID0gZnVuY3Rpb24gKG5ld1N0YXRlKSB7XG4gIHRoaXMuc2V0U3RhdGUoeyBmb3JtOiBPYmplY3QuYXNzaWduKHt9LCB0aGlzLnN0YXRlLmZvcm0sIG5ld1N0YXRlKSB9LCAnZm9ybScpO1xufTtcblxuUHJvdG8uY29tcHV0ZWRTdGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICB2YXIgaXNWYWxpZCA9IHRydWU7XG4gIHZhciBpc1ByaXN0aW5lID0gc3RhdGUuZm9ybS5wcmlzdGluZTtcbiAgdmFyIGlzVG91Y2hlZCA9IHN0YXRlLmZvcm0udG91Y2hlZDtcblxuICBPYmplY3Qua2V5cyhzdGF0ZSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgaWYgKGtleSA9PT0gJ2Zvcm0nKSByZXR1cm47XG4gICAgaWYgKGtleSA9PT0gJ3JlcXVlc3QnKSByZXR1cm47XG4gICAgaWYgKGtleSA9PT0gJ3Jlc3BvbnNlJykgcmV0dXJuO1xuXG4gICAgdmFyIHByb3AgPSBzdGF0ZVtrZXldO1xuXG4gICAgaWYgKGlzVmFsaWQgJiYgcHJvcC5oYXNPd25Qcm9wZXJ0eSgndmFsaWQnKSkge1xuICAgICAgaXNWYWxpZCA9IHByb3AudmFsaWQ7XG4gICAgfVxuXG4gICAgaWYgKGlzUHJpc3RpbmUgJiYgcHJvcC5oYXNPd25Qcm9wZXJ0eSgncHJpc3RpbmUnKSkge1xuICAgICAgaXNQcmlzdGluZSA9IHByb3AucHJpc3RpbmU7XG4gICAgfVxuXG4gICAgaWYgKHByb3AuaGFzT3duUHJvcGVydHkoJ3RvdWNoZWQnKSkge1xuICAgICAgaXNUb3VjaGVkID0gaXNUb3VjaGVkIHx8IHByb3AudG91Y2hlZDtcbiAgICB9XG4gIH0pO1xuXG4gIE9iamVjdC5hc3NpZ24oc3RhdGUuZm9ybSwge1xuICAgIHZhbGlkOiBpc1ZhbGlkLFxuICAgIHByaXN0aW5lOiBpc1ByaXN0aW5lLFxuICAgIHRvdWNoZWQ6IGlzVG91Y2hlZCxcbiAgICBpbnZhbGlkOiAhaXNWYWxpZCxcbiAgICBkaXJ0eTogIWlzUHJpc3RpbmUsXG4gICAgdW50b3VjaGVkOiAhaXNUb3VjaGVkXG4gIH0pO1xuXG4gIHJldHVybiBzdGF0ZTtcbn07XG5cblByb3RvLmluaXQgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZm9ybUVsZW1lbnRzID0gW107XG4gIHRoaXMucmFkaW9Hcm91cHMgPSB7fTtcblxuICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHRoaXMuZWwuZWxlbWVudHMsIGZ1bmN0aW9uIChmaWVsZCkge1xuICAgIHZhciBuYW1lID0gZmllbGQubmFtZTtcbiAgICB2YXIgdHlwZSA9IGZpZWxkLnR5cGU7XG5cbiAgICBpZiAoIW5hbWUpIHJldHVybjtcbiAgICBpZiAoZmllbGQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PSAnZmllbGRzZXQnKSByZXR1cm47XG4gICAgaWYgKHR5cGUgPT0gJ3N1Ym1pdCcpIHJldHVybjtcbiAgICBpZiAodHlwZSA9PSAncmVzZXQnKSByZXR1cm47XG4gICAgaWYgKHR5cGUgPT0gJ2J1dHRvbicpIHJldHVybjtcbiAgICBpZiAodHlwZSA9PSAnZmlsZScpIHJldHVybjtcblxuICAgIHZhciBmb3JtRWxlbWVudCA9IGNyZWF0ZVN0YXRlZnVsRm9ybUVsZW1lbnQoZmllbGQpO1xuXG4gICAgaWYgKGZvcm1FbGVtZW50IGluc3RhbmNlb2YgU3RhdGVmdWxSYWRpbykge1xuICAgICAgaWYgKHRoaXMucmFkaW9Hcm91cHMuaGFzT3duUHJvcGVydHkobmFtZSkpIHtcbiAgICAgICAgdGhpcy5yYWRpb0dyb3Vwc1tuYW1lXS5hZGRSYWRpbyhmb3JtRWxlbWVudCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnJhZGlvR3JvdXBzW25hbWVdID0gbmV3IFN0YXRlZnVsUmFkaW9Hcm91cChuYW1lKTtcbiAgICAgICAgdGhpcy5yYWRpb0dyb3Vwc1tuYW1lXS5hZGRSYWRpbyhmb3JtRWxlbWVudCk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChmb3JtRWxlbWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZvcm1FbGVtZW50cy5wdXNoKGZvcm1FbGVtZW50KTtcbiAgICB9XG4gIH0uYmluZCh0aGlzKSk7XG5cbiAgT2JqZWN0LmtleXModGhpcy5yYWRpb0dyb3VwcykuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuICAgIHRoaXMucmFkaW9Hcm91cHNbbmFtZV0udHJpZ2dlclJhZGlvc1N0YXRlQ2hhbmdlKCk7XG4gICAgdGhpcy5mb3JtRWxlbWVudHMucHVzaCh0aGlzLnJhZGlvR3JvdXBzW25hbWVdKTtcbiAgfS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLmdldERlZmF1bHRTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHN0YXRlID0ge307XG4gIHZhciBpc1ZhbGlkID0gdHJ1ZTtcblxuICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHRoaXMuZm9ybUVsZW1lbnRzLCBmdW5jdGlvbiAoZm9ybUVsZW1lbnQpIHtcbiAgICBmb3JtRWxlbWVudC5vblN0YXRlQ2hhbmdlKHRoaXMuaGFuZGxlRm9ybUVsZW1lbnRTdGF0ZUNoYW5nZSk7XG4gICAgc3RhdGVbZm9ybUVsZW1lbnQubmFtZV0gPSBmb3JtRWxlbWVudC5zdGF0ZTtcbiAgICBpc1ZhbGlkID0gZm9ybUVsZW1lbnQuc3RhdGUudmFsaWQgJiYgaXNWYWxpZDtcbiAgfS5iaW5kKHRoaXMpKTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbih7XG4gICAgZm9ybToge1xuICAgICAgc3VibWl0dGVkOiBmYWxzZSxcbiAgICAgIHByaXN0aW5lOiB0cnVlLFxuICAgICAgdmFsaWQ6IGlzVmFsaWRcbiAgICB9XG4gIH0sIHN0YXRlKTtcbn07XG5cblByb3RvLmJpbmRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5zdWJtaXQoKTtcbiAgfS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLnN1Ym1pdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGFjdGlvbiA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdhY3Rpb24nKTtcbiAgdGhpcy5zZXRGb3JtU3RhdGUoeyBzdWJtaXR0ZWQ6IHRydWUgfSk7XG5cbiAgaWYgKHRoaXMuc3RhdGUuZm9ybS5pbnZhbGlkKSByZXR1cm47XG5cbiAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgcmVxdWVzdC5vcGVuKCdQT1NUJywgYWN0aW9uLCB0cnVlKTtcbiAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04Jyk7XG5cbiAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHJlcXVlc3Quc3RhdHVzID49IDIwMCAmJiByZXF1ZXN0LnN0YXR1cyA8IDQwMCkge1xuXG4gICAgICB2YXIganNvbiA9IHt9O1xuICAgICAgdHJ5IHtcbiAgICAgICAganNvbiA9IEpTT04ucGFyc2UocmVxdWVzdC5yZXNwb25zZVRleHQpO1xuICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBqc29uID0ge307XG4gICAgICB9XG5cbiAgICAgIHRoaXMuc2V0U3RhdGUoe1xuICAgICAgICByZXF1ZXN0OiB7XG4gICAgICAgICAgc3VjY2VzczogdHJ1ZSxcbiAgICAgICAgICBmYWlsZWQ6IGZhbHNlLFxuICAgICAgICAgIHN0YXR1czogcmVxdWVzdC5zdGF0dXNcbiAgICAgICAgfSxcbiAgICAgICAgcmVzcG9uc2U6IHtcbiAgICAgICAgICBqc29uOiBqc29uLFxuICAgICAgICAgIHRleHQ6IHJlcXVlc3QucmVzcG9uc2VUZXh0XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgcmVxdWVzdDoge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGZhaWxlZDogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHJlcXVlc3Quc3RhdHVzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gV2UgcmVhY2hlZCBvdXIgdGFyZ2V0IHNlcnZlciwgYnV0IGl0IHJldHVybmVkIGFuIGVycm9yXG4gICAgICBjb25zb2xlLmxvZygnZXJyb3InKTtcbiAgICB9XG4gIH0uYmluZCh0aGlzKTtcblxuICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBUaGVyZSB3YXMgYSBjb25uZWN0aW9uIGVycm9yIG9mIHNvbWUgc29ydFxuICAgIGNvbnNvbGUubG9nKCdlcnJvcicpO1xuICB9O1xuXG4gIHJlcXVlc3Quc2VuZCh0aGlzLnN0YXRlKTtcbn07XG5cbi8vIFByaXZhdGVcblxuZnVuY3Rpb24gY3JlYXRlU3RhdGVmdWxGb3JtRWxlbWVudCAoZmllbGQpIHtcbiAgdmFyIHR5cGUgPSBmaWVsZC5nZXRBdHRyaWJ1dGUoJ3NmLWVsZW1lbnQnKVxuICAgICAgICAgIHx8IGZpZWxkLnR5cGVcbiAgICAgICAgICB8fCBmaWVsZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpO1xuXG4gIHN3aXRjaCAodHlwZSkge1xuICAgIGNhc2UgJ3RleHRhcmVhJzpcbiAgICBjYXNlICdwYXNzd29yZCc6XG4gICAgY2FzZSAndGV4dCc6XG4gICAgY2FzZSAnZW1haWwnOlxuICAgIGNhc2UgJ3Bob25lJzpcbiAgICBjYXNlICd0ZWwnOlxuICAgIGNhc2UgJ2hpZGRlbic6XG4gICAgICByZXR1cm4gbmV3IFN0YXRlZnVsVGV4dElucHV0KGZpZWxkKTtcbiAgICBjYXNlICdjaGVja2JveCc6IHJldHVybiBuZXcgU3RhdGVmdWxDaGVja2JveChmaWVsZCk7XG4gICAgY2FzZSAncmFkaW8nOiByZXR1cm4gbmV3IFN0YXRlZnVsUmFkaW8oZmllbGQpO1xuICAgIGNhc2UgJ3NlbGVjdC1vbmUnOlxuICAgIGNhc2UgJ3NlbGVjdCc6XG4gICAgICByZXR1cm4gbmV3IFN0YXRlZnVsU2VsZWN0KGZpZWxkKTtcbiAgICBkZWZhdWx0OlxuICAgICAgY29uc29sZS5lcnJvcignRm9ybSBlbGVtZW50IHR5cGUgYCcgKyB0eXBlICsgJ2Agbm90IHN1cHBvcnRlZCBieSBTdGF0ZWZ1bCBGb3JtcycsIGZpZWxkKTtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsRm9ybTtcbiIsImZ1bmN0aW9uIFN0YXRlZnVsT2JqZWN0ICgpIHtcbiAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcbiAgdGhpcy5zZXRTdGF0ZSh0aGlzLmdldERlZmF1bHRTdGF0ZSgpKTtcbn1cblxudmFyIFByb3RvID0gU3RhdGVmdWxPYmplY3QucHJvdG90eXBlO1xuXG5Qcm90by5vblN0YXRlQ2hhbmdlID0gZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG4gIHRoaXMubGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICByZXR1cm4gdGhpcztcbn07XG5cblByb3RvLnRyaWdnZXJTdGF0ZUNoYW5nZSA9IGZ1bmN0aW9uIChwYXJ0aWFsTmV3U3RhdGUsIGtleSkge1xuICB0aGlzLmxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChsaXN0ZW5lcikge1xuICAgIGxpc3RlbmVyKHRoaXMuc3RhdGUsIHBhcnRpYWxOZXdTdGF0ZSwga2V5LCB0aGlzKTtcbiAgfS5iaW5kKHRoaXMpKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYXJ0aWFsTmV3U3RhdGVcbiAqIEBwYXJhbSB7P1N0cmluZ30ga2V5XG4gKi9cblByb3RvLnNldFN0YXRlID0gZnVuY3Rpb24gKHBhcnRpYWxOZXdTdGF0ZSwga2V5KSB7XG4gIHZhciBuYW1lID0ga2V5IHx8IHRoaXMubmFtZTtcbiAgdmFyIG9sZFN0YXRlID0gdGhpcy5zdGF0ZSB8fCB7fTtcbiAgdGhpcy5zdGF0ZSA9IHRoaXMuY29tcHV0ZWRTdGF0ZShPYmplY3QuYXNzaWduKHt9LCB0aGlzLnN0YXRlLCBwYXJ0aWFsTmV3U3RhdGUpKTtcbiAgaWYgKEpTT04uc3RyaW5naWZ5KG9sZFN0YXRlW2tleV0pICE9PSBKU09OLnN0cmluZ2lmeShwYXJ0aWFsTmV3U3RhdGUpKSB7XG4gICAgdGhpcy50cmlnZ2VyU3RhdGVDaGFuZ2UocGFydGlhbE5ld1N0YXRlLCBuYW1lKTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cblByb3RvLmNvbXB1dGVkU3RhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgcmV0dXJuIHN0YXRlO1xufTtcblxuUHJvdG8uZ2V0RGVmYXVsdFN0YXRlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge307XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsT2JqZWN0O1xuIiwiLy8gSUU4K1xuZnVuY3Rpb24gcmVtb3ZlQ2xhc3MgKGVsLCBjbGFzc05hbWUpIHtcbiAgaWYgKGVsLmNsYXNzTGlzdCkge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShuZXcgUmVnRXhwKCcoXnxcXFxcYiknICsgY2xhc3NOYW1lLnNwbGl0KCcgJykuam9pbignfCcpICsgJyhcXFxcYnwkKScsICdnaScpLCAnICcpO1xuICB9XG59XG5cbi8vIElFOCtcbmZ1bmN0aW9uIGFkZENsYXNzIChlbCwgY2xhc3NOYW1lKSB7XG4gIGlmIChlbC5jbGFzc0xpc3QpIHtcbiAgICBlbC5jbGFzc0xpc3QuYWRkKGNsYXNzTmFtZSk7XG4gIH0gZWxzZSB7XG4gICAgZWwuY2xhc3NOYW1lICs9ICcgJyArIGNsYXNzTmFtZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVDbGFzcyAoZWwsIGNsYXNzTmFtZSwgaXNBcHBsaWVkKSB7XG4gIGlmIChpc0FwcGxpZWQpIHtcbiAgICBhZGRDbGFzcyhlbCwgY2xhc3NOYW1lKTtcbiAgfSBlbHNlIHtcbiAgICByZW1vdmVDbGFzcyhlbCwgY2xhc3NOYW1lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVBdHRyaWJ1dGUgKGVsLCBhdHRyTmFtZSwgaXNBcHBsaWVkKSB7XG4gIGlmIChpc0FwcGxpZWQpIHtcbiAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJOYW1lKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5yZW1vdmVBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHJlZmxlY3RTdGF0ZSAoZWwsIHN0YXRlKSB7XG4gIE9iamVjdC5rZXlzKHN0YXRlKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAodHlwZW9mIHN0YXRlW2tleV0gPT09ICdib29sZWFuJykge1xuICAgICAgdG9nZ2xlQ2xhc3MoZWwsICdpcy0nICsga2V5LCAhIXN0YXRlW2tleV0pO1xuICAgIH0gZWxzZSBpZiAoa2V5ID09PSAndmFsdWUnKSB7XG4gICAgICB0b2dnbGVDbGFzcyhlbCwgJ2hhcy12YWx1ZScsICEhc3RhdGVba2V5XSk7XG4gICAgfVxuICB9KTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHRvZ2dsZUNsYXNzOiB0b2dnbGVDbGFzcyxcbiAgcmVmbGVjdFN0YXRlOiByZWZsZWN0U3RhdGUsXG4gIHJlbW92ZUNsYXNzOiByZW1vdmVDbGFzcyxcbiAgYWRkQ2xhc3M6IGFkZENsYXNzLFxuICB0b2dnbGVBdHRyaWJ1dGU6IHRvZ2dsZUF0dHJpYnV0ZVxufTtcbiIsIi8vIFNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgT2JqZWN0LmNyZWF0ZVxuaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAndW5kZWZpbmVkJykge1xuXHRPYmplY3QuY3JlYXRlID0gZnVuY3Rpb24ocHJvdG90eXBlKSB7XG5cdFx0ZnVuY3Rpb24gQygpIHt9XG5cdFx0Qy5wcm90b3R5cGUgPSBwcm90b3R5cGU7XG5cdFx0cmV0dXJuIG5ldyBDKCk7XG5cdH1cbn1cbiIsIid1c2Ugc3RyaWN0Jztcbi8qKlxuICogU3RhdGVmdWwgZm9ybXNcbiAqIC0tLVxuICogQXV0aG9yOiBKZXJvZW4gUmFuc2lqblxuICogTGljZW5zZTogTUlUXG4gKi9cbnJlcXVpcmUoJy4vcG9seWZpbGxzL29iamVjdC1jcmVhdGUnKTtcbnZhciBTdGF0ZWZ1bEZvcm0gPSByZXF1aXJlKCcuL2xpYi9zdGF0ZWZ1bC1mb3JtJyk7XG52YXIgRGlyZWN0aXZlc01hbmFnZXIgPSByZXF1aXJlKCcuL2xpYi9kaXJlY3RpdmVzL2RpcmVjdGl2ZXMtbWFuYWdlcicpO1xuXG5nbG9iYWwuY3JlYXRlU3RhdGVmdWxGb3JtcyA9IGZ1bmN0aW9uIGNyZWF0ZVN0YXRlZnVsRm9ybXMgKCkge1xuICB2YXIgZm9ybXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdmb3JtW3N0YXRlZnVsXScpO1xuXG4gIC8vIElFOSsgTm9kZUxpc3QgaXRlcmF0aW9uXG4gIHJldHVybiBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoZm9ybXMsIGZ1bmN0aW9uIChmb3JtKSB7XG4gICAgdmFyIG1hbmFnZXIgPSBuZXcgRGlyZWN0aXZlc01hbmFnZXIoZm9ybSk7XG4gICAgcmV0dXJuIG5ldyBTdGF0ZWZ1bEZvcm0oZm9ybSkub25TdGF0ZUNoYW5nZShmdW5jdGlvbiAoc3RhdGUsIHBhcnRpYWxTdGF0ZSwga2V5KSB7XG4gICAgICBjb25zb2xlLmxvZygnZm9ybTpzdGF0ZUNoYW5nZScsIGtleSwgc3RhdGUpO1xuICAgICAgaWYgKGtleSkge1xuICAgICAgICBtYW5hZ2VyLnBhdGNoKGtleSwgc3RhdGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFuYWdlci51cGRhdGUoc3RhdGUpO1xuICAgICAgfVxuICAgIH0pLnRyaWdnZXJTdGF0ZUNoYW5nZSgpO1xuICB9KTtcbn1cbiJdfQ==

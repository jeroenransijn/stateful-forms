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

},{"../expressions/parser":5,"../utils":12}],3:[function(require,module,exports){
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

function StatefulFormElement (el) {
  this.el = el;
  this.name = this.el.getAttribute('name');
  StatefulObject.call(this);
  this.bindEvents();
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

},{"../stateful-object":11}],8:[function(require,module,exports){
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

},{"./stateful-form-element":7}],9:[function(require,module,exports){
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

},{"./stateful-form-element":7}],10:[function(require,module,exports){
var StatefulObject = require('./stateful-object');
var StatefulTextInput = require('./form-elements/stateful-text-input');
var StatefulSelect = require('./form-elements/stateful-select');
var StatefulCheckbox = require('./form-elements/stateful-checkbox');

function StatefulForm (el) {
  this.el = el;
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
    if (formElement !== undefined) {
      this.formElements.push(formElement);
    }
  }.bind(this));
};

Proto.getDefaultState = function () {
  var state = {};
  var isValid = true;

  Array.prototype.forEach.call(this.formElements, function (formElement) {
    formElement.onStateChange(this.handleFormElementStateChange.bind(this));
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


  console.log(this.state);
  if (this.state.form.invalid) return;

  var request = new XMLHttpRequest();
  request.open('POST', action, true);
  request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');

  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {
      this.setState({
        request: {
          success: true,
          failed: false,
          status: request.status
        },
        response: {
          json: JSON.parse(request.responseText),
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
  switch (field.type) {
    case 'textarea': return new StatefulTextInput(field);
    case 'text': return new StatefulTextInput(field);
    case 'email': return new StatefulTextInput(field);
    case 'checkbox': return new StatefulCheckbox(field);
    default:
      if (field.nodeName.toLowerCase() === 'select') {
        return new StatefulSelect(field);
      }
  }
}

module.exports = StatefulForm;

},{"./form-elements/stateful-checkbox":6,"./form-elements/stateful-select":8,"./form-elements/stateful-text-input":9,"./stateful-object":11}],11:[function(require,module,exports){
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

},{}],12:[function(require,module,exports){
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

module.exports = {
  toggleClass: toggleClass,
  removeClass: removeClass,
  addClass: addClass,
  toggleAttribute: toggleAttribute
};

},{}],13:[function(require,module,exports){
// Some browsers do not support Object.create
if (typeof Object.create === 'undefined') {
	Object.create = function(prototype) {
		function C() {}
		C.prototype = prototype;
		return new C();
	}
}

},{}],14:[function(require,module,exports){
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
      // console.log('form:stateChange', key, state);
      if (key) {
        manager.patch(key, state);
      } else {
        manager.update(state);
      }
    }).triggerStateChange();
  });
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./lib/directives/directives-manager":1,"./lib/stateful-form":10,"./polyfills/object-create":13}]},{},[14])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbGliL2RpcmVjdGl2ZXMvZGlyZWN0aXZlcy1tYW5hZ2VyLmpzIiwic3JjL2xpYi9kaXJlY3RpdmVzL2RpcmVjdGl2ZXMuanMiLCJzcmMvbGliL2V4cHJlc3Npb25zL2FzdC5qcyIsInNyYy9saWIvZXhwcmVzc2lvbnMvbGV4ZXIuanMiLCJzcmMvbGliL2V4cHJlc3Npb25zL3BhcnNlci5qcyIsInNyYy9saWIvZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1jaGVja2JveC5qcyIsInNyYy9saWIvZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1mb3JtLWVsZW1lbnQuanMiLCJzcmMvbGliL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtc2VsZWN0LmpzIiwic3JjL2xpYi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXRleHQtaW5wdXQuanMiLCJzcmMvbGliL3N0YXRlZnVsLWZvcm0uanMiLCJzcmMvbGliL3N0YXRlZnVsLW9iamVjdC5qcyIsInNyYy9saWIvdXRpbHMuanMiLCJzcmMvcG9seWZpbGxzL29iamVjdC1jcmVhdGUuanMiLCJzcmMvc3RhdGVmdWwtZm9ybXMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDbERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5Y0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxU0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlLQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUN4Q0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7QUNSQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uIGUodCxuLHIpe2Z1bmN0aW9uIHMobyx1KXtpZighbltvXSl7aWYoIXRbb10pe3ZhciBhPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7aWYoIXUmJmEpcmV0dXJuIGEobywhMCk7aWYoaSlyZXR1cm4gaShvLCEwKTt2YXIgZj1uZXcgRXJyb3IoXCJDYW5ub3QgZmluZCBtb2R1bGUgJ1wiK28rXCInXCIpO3Rocm93IGYuY29kZT1cIk1PRFVMRV9OT1RfRk9VTkRcIixmfXZhciBsPW5bb109e2V4cG9ydHM6e319O3Rbb11bMF0uY2FsbChsLmV4cG9ydHMsZnVuY3Rpb24oZSl7dmFyIG49dFtvXVsxXVtlXTtyZXR1cm4gcyhuP246ZSl9LGwsbC5leHBvcnRzLGUsdCxuLHIpfXJldHVybiBuW29dLmV4cG9ydHN9dmFyIGk9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtmb3IodmFyIG89MDtvPHIubGVuZ3RoO28rKylzKHJbb10pO3JldHVybiBzfSkiLCJ2YXIgRGlyZWN0aXZlcyA9IHJlcXVpcmUoJy4vZGlyZWN0aXZlcycpO1xuXG5mdW5jdGlvbiBEaXJlY3RpdmVzTWFuYWdlciAoZWwpIHtcbiAgdGhpcy5lbCA9IGVsO1xuICB0aGlzLmRpcmVjdGl2ZXMgPSB7fTtcbiAgdGhpcy5wYXRjaEluZGV4ID0ge307XG5cbiAgdGhpcy5xdWVyeU1hcChEaXJlY3RpdmVzLlNob3dEaXJlY3RpdmUpO1xuICB0aGlzLnF1ZXJ5TWFwKERpcmVjdGl2ZXMuVGV4dERpcmVjdGl2ZSk7XG4gIHRoaXMucXVlcnlNYXAoRGlyZWN0aXZlcy5DbGFzc0RpcmVjdGl2ZSk7XG4gIHRoaXMucXVlcnlNYXAoRGlyZWN0aXZlcy5BdHRyaWJ1dGVzRGlyZWN0aXZlKTtcbn1cblxudmFyIFByb3RvID0gRGlyZWN0aXZlc01hbmFnZXIucHJvdG90eXBlO1xuXG5Qcm90by5xdWVyeU1hcCA9IGZ1bmN0aW9uIChjbHMpIHtcbiAgdmFyIGF0dHIgPSBjbHMucHJvdG90eXBlLmF0dHJpYnV0ZTtcbiAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbChcbiAgICB0aGlzLmVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1snICsgYXR0ciArICddJyksIGZ1bmN0aW9uIChlbCkge1xuICAgICAgdmFyIGRpcmVjdGl2ZSA9IG5ldyBjbHMoZWwpO1xuXG4gICAgICB0aGlzLmRpcmVjdGl2ZXNbYXR0cl0gPSB0aGlzLmRpcmVjdGl2ZXNbYXR0cl0gfHwgW107XG4gICAgICB0aGlzLmRpcmVjdGl2ZXNbYXR0cl0ucHVzaChkaXJlY3RpdmUpO1xuXG4gICAgICBkaXJlY3RpdmUuZ2V0TmFtZXMoKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHRoaXMucGF0Y2hJbmRleFtuYW1lXSA9IHRoaXMucGF0Y2hJbmRleFtuYW1lXSB8fCBbXTtcbiAgICAgICAgdGhpcy5wYXRjaEluZGV4W25hbWVdLnB1c2goZGlyZWN0aXZlKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLnBhdGNoID0gZnVuY3Rpb24gKGtleSwgc3RhdGUpIHtcbiAgLy8gY29uc29sZS5sb2coJ3BhdGNoJywga2V5LCBzdGF0ZSk7XG4gIGlmICh0aGlzLnBhdGNoSW5kZXguaGFzT3duUHJvcGVydHkoa2V5KSkge1xuICAgIHRoaXMucGF0Y2hJbmRleFtrZXldLmZvckVhY2goZnVuY3Rpb24gKGRpcmVjdGl2ZSkge1xuICAgICAgZGlyZWN0aXZlLnVwZGF0ZShzdGF0ZSk7XG4gICAgfSk7XG4gIH1cbn07XG5cblByb3RvLnVwZGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAvLyBjb25zb2xlLmxvZygndXBkYXRlJywgdGhpcy5kaXJlY3RpdmVzKTtcbiAgT2JqZWN0LmtleXModGhpcy5kaXJlY3RpdmVzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICB0aGlzLmRpcmVjdGl2ZXNba2V5XS5mb3JFYWNoKGZ1bmN0aW9uIChkaXJlY3RpdmUpIHtcbiAgICAgIGRpcmVjdGl2ZS51cGRhdGUoc3RhdGUpO1xuICAgIH0pO1xuICB9LmJpbmQodGhpcykpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBEaXJlY3RpdmVzTWFuYWdlcjtcbiIsInZhciBQYXJzZXIgPSByZXF1aXJlKCcuLi9leHByZXNzaW9ucy9wYXJzZXInKS5QYXJzZXI7XG52YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xuXG4vLyBVc2Ugb25lIHBhcnNlciBhY3Jvc3MgZGlyZWN0aXZlcyB0byBtYWtlIHVzZSBvZiB0aGUgY2FjaGVcbnZhciBwYXJzZXIgPSBuZXcgUGFyc2VyKCk7XG5wYXJzZXIucGFyc2UgPSBwYXJzZXIucGFyc2UuYmluZChwYXJzZXIpO1xucGFyc2VyLnBhcnNlT2JqZWN0ID0gcGFyc2VyLnBhcnNlT2JqZWN0LmJpbmQocGFyc2VyKTtcblxuZnVuY3Rpb24gRGlyZWN0aXZlIChlbCkge1xuICB0aGlzLmVsID0gZWw7XG4gIHRoaXMuYXR0cmlidXRlVmFsdWUgPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSh0aGlzLmF0dHJpYnV0ZSk7XG4gIHRoaXMuZXhwcmVzc2lvbiA9IHRoaXMucGFyc2UodGhpcy5hdHRyaWJ1dGVWYWx1ZSk7XG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge0FycmF5W1N0cmluZ119IG5hbWVzIG9mIGFjY2VzcyBtZW1iZXJzXG4gICAqL1xuICB0aGlzLmdldE5hbWVzID0gZnVuY3Rpb24gKCkge1xuICAgIHJldHVybiB0aGlzLmV4cHJlc3Npb24uYWNjZXNzU2NvcGVOYW1lcztcbiAgfVxufVxuXG5mdW5jdGlvbiBPYmplY3REaXJlY3RpdmUgKCkge1xuICB0aGlzLnBhcnNlID0gcGFyc2VyLnBhcnNlT2JqZWN0O1xuICBEaXJlY3RpdmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcblxuICB0aGlzLnVwZGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICAgIHZhciBtYXRjaGVkT2JqZWN0ID0gdGhpcy5leHByZXNzaW9uLmV2YWwoc3RhdGUpO1xuXG4gICAgT2JqZWN0LmtleXMobWF0Y2hlZE9iamVjdCkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICB0aGlzLnRvZ2dsZU1ldGhvZCh0aGlzLmVsLCBrZXksIG1hdGNoZWRPYmplY3Rba2V5XSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gQXR0cmlidXRlc0RpcmVjdGl2ZSAoKSB7XG4gIHRoaXMudG9nZ2xlTWV0aG9kID0gdXRpbHMudG9nZ2xlQXR0cmlidXRlO1xuICBPYmplY3REaXJlY3RpdmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cbkF0dHJpYnV0ZXNEaXJlY3RpdmUucHJvdG90eXBlLmF0dHJpYnV0ZSA9ICdzZi1hdHRyaWJ1dGVzJztcblxuZnVuY3Rpb24gQ2xhc3NEaXJlY3RpdmUgKCkge1xuICB0aGlzLnRvZ2dsZU1ldGhvZCA9IHV0aXMudG9nZ2xlQ2xhc3M7XG4gIE9iamVjdERpcmVjdGl2ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuT2JqZWN0RGlyZWN0aXZlLnByb3RvdHlwZS5hdHRyaWJ1dGUgPSAnc2YtY2xhc3MnO1xuXG5mdW5jdGlvbiBTaG93RGlyZWN0aXZlICgpIHtcbiAgdGhpcy5wYXJzZSA9IHBhcnNlci5wYXJzZTtcbiAgRGlyZWN0aXZlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgdGhpcy51cGRhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICBpZiAoISF0aGlzLmV4cHJlc3Npb24uZXZhbChzdGF0ZSkpIHtcbiAgICAgIHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICcnO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVsLnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG4gICAgfVxuICB9O1xufVxuU2hvd0RpcmVjdGl2ZS5wcm90b3R5cGUuYXR0cmlidXRlID0gJ3NmLXNob3cnO1xuXG5mdW5jdGlvbiBUZXh0RGlyZWN0aXZlICgpIHtcbiAgdGhpcy5wYXJzZSA9IHBhcnNlci5wYXJzZTtcbiAgRGlyZWN0aXZlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgdGhpcy51cGRhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICB0aGlzLmVsLmlubmVySFRNTCA9IHRoaXMuZXhwcmVzc2lvbi5ldmFsKHN0YXRlKTtcbiAgfVxufVxuVGV4dERpcmVjdGl2ZS5wcm90b3R5cGUuYXR0cmlidXRlID0gJ3NmLXRleHQnO1xuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgRGlyZWN0aXZlOiBEaXJlY3RpdmUsXG4gIE9iamVjdERpcmVjdGl2ZTogT2JqZWN0RGlyZWN0aXZlLFxuICBBdHRyaWJ1dGVzRGlyZWN0aXZlOiBBdHRyaWJ1dGVzRGlyZWN0aXZlLFxuICBDbGFzc0RpcmVjdGl2ZTogQ2xhc3NEaXJlY3RpdmUsXG4gIFNob3dEaXJlY3RpdmU6IFNob3dEaXJlY3RpdmUsXG4gIFRleHREaXJlY3RpdmU6IFRleHREaXJlY3RpdmUsXG59O1xuIiwiLyoqXG4gKiBAcGFyYW0ge1N0cmluZ30gb3BlcmF0aW9uXG4gKiBAcGFyYW0ge0V4cHJlc3Npb259IGxlZnRFeHBcbiAqIEBwYXJhbSB7RXhwcmVzc2lvbn0gcmlnaHRFeHBcbiAqL1xuZnVuY3Rpb24gQmluYXJ5IChvcGVyYXRpb24sIGxlZnRFeHAsIHJpZ2h0RXhwKSB7XG4gIHRoaXMuZXZhbCA9IGZ1bmN0aW9uIChzY29wZSkge1xuICAgIHZhciBsZWZ0ID0gbGVmdEV4cC5ldmFsKHNjb3BlKTtcblxuICAgIHN3aXRjaCAob3BlcmF0aW9uKSB7XG4gICAgICBjYXNlICcmJic6IHJldHVybiAhIWxlZnQgJiYgISFyaWdodEV4cC5ldmFsKHNjb3BlKTtcbiAgICAgIGNhc2UgJ3x8JzogcmV0dXJuICEhbGVmdCB8fCAhIXJpZ2h0RXhwLmV2YWwoc2NvcGUpO1xuICAgIH1cblxuICAgIHZhciByaWdodCA9IHJpZ2h0RXhwLmV2YWwoc2NvcGUpO1xuXG4gICAgLy8gTnVsbCBjaGVjayBmb3IgdGhlIG9wZXJhdGlvbnMuXG4gICAgaWYgKGxlZnQgPT0gbnVsbCB8fCByaWdodCA9PSBudWxsKSB7XG4gICAgICBzd2l0Y2ggKG9wZXJhdGlvbikge1xuICAgICAgICBjYXNlICcrJzpcbiAgICAgICAgICBpZiAobGVmdCAhPSBudWxsKSByZXR1cm4gbGVmdDtcbiAgICAgICAgICBpZiAocmlnaHQgIT0gbnVsbCkgcmV0dXJuIHJpZ2h0O1xuICAgICAgICAgIHJldHVybiAwO1xuICAgICAgICBjYXNlICctJzpcbiAgICAgICAgICBpZiAobGVmdCAhPSBudWxsKSByZXR1cm4gbGVmdDtcbiAgICAgICAgICBpZiAocmlnaHQgIT0gbnVsbCkgcmV0dXJuIDAgLSByaWdodDtcbiAgICAgICAgICByZXR1cm4gMDtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIG51bGw7XG4gICAgfVxuXG4gICAgc3dpdGNoIChvcGVyYXRpb24pIHtcbiAgICAgIGNhc2UgJysnICA6IHJldHVybiBhdXRvQ29udmVydEFkZChsZWZ0LCByaWdodCk7XG4gICAgICBjYXNlICctJyAgOiByZXR1cm4gbGVmdCAtIHJpZ2h0O1xuICAgICAgY2FzZSAnKicgIDogcmV0dXJuIGxlZnQgKiByaWdodDtcbiAgICAgIGNhc2UgJy8nICA6IHJldHVybiBsZWZ0IC8gcmlnaHQ7XG4gICAgICBjYXNlICd+LycgOiByZXR1cm4gTWF0aC5mbG9vcihsZWZ0IC8gcmlnaHQpO1xuICAgICAgY2FzZSAnJScgIDogcmV0dXJuIGxlZnQgJSByaWdodDtcbiAgICAgIGNhc2UgJz09JyA6IHJldHVybiBsZWZ0ID09IHJpZ2h0O1xuICAgICAgY2FzZSAnIT0nIDogcmV0dXJuIGxlZnQgIT0gcmlnaHQ7XG4gICAgICBjYXNlICc8JyAgOiByZXR1cm4gbGVmdCA8IHJpZ2h0O1xuICAgICAgY2FzZSAnPicgIDogcmV0dXJuIGxlZnQgPiByaWdodDtcbiAgICAgIGNhc2UgJzw9JyA6IHJldHVybiBsZWZ0IDw9IHJpZ2h0O1xuICAgICAgY2FzZSAnPj0nIDogcmV0dXJuIGxlZnQgPj0gcmlnaHQ7XG4gICAgICBjYXNlICdeJyAgOiByZXR1cm4gbGVmdCBeIHJpZ2h0O1xuICAgICAgY2FzZSAnJicgIDogcmV0dXJuIGxlZnQgJiByaWdodDtcbiAgICB9XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ0ludGVybmFsIGVycm9yIFsnICsgb3BlcmF0aW9uICsgJ10gbm90IGhhbmRsZWQnKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBAcGFyYW0ge0V4cHJlc3Npb259IG9iamVjdFxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqL1xuZnVuY3Rpb24gQWNjZXNzTWVtYmVyIChvYmplY3QsIG5hbWUpIHtcbiAgdGhpcy5ldmFsID0gZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgdmFyIGluc3RhbmNlID0gb2JqZWN0LmV2YWwoc2NvcGUpO1xuICAgIHJldHVybiBpbnN0YW5jZSA9PSBudWxsID8gbnVsbCA6IGluc3RhbmNlW25hbWVdO1xuICB9O1xufVxuXG4vKipcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKi9cbmZ1bmN0aW9uIEFjY2Vzc1Njb3BlIChuYW1lKSB7XG4gIHRoaXMuZXZhbCA9IGZ1bmN0aW9uIChzY29wZSkge1xuICAgIHJldHVybiBzY29wZVtuYW1lXTtcbiAgfTtcbn1cblxuLyoqXG4gKiBAcGFyYW0ge1N0cmluZ30gb3BlcmF0aW9uXG4gKiBAcGFyYW0ge0V4cHJlc3Npb259IGV4cHJlc3Npb25cbiAqL1xuZnVuY3Rpb24gUHJlZml4Tm90IChvcGVyYXRpb24sIGV4cHJlc3Npb24pIHtcbiAgdGhpcy5ldmFsID0gZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgcmV0dXJuICFleHByZXNzaW9uLmV2YWwoc2NvcGUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBMaXRlcmFsUHJpbWl0aXZlICh2YWx1ZSkge1xuICB0aGlzLmV2YWwgPSBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH07XG59XG5cbi8qKlxuICogQHBhcmFtIHtFeHByZXNzaW9ufSBjb25kaXRpb25cbiAqIEBwYXJhbSB7RXhwcmVzc2lvbn0geWVzXG4gKiBAcGFyYW0ge0V4cHJlc3NzaW9ufSBub1xuICovXG5mdW5jdGlvbiBDb25kaXRpb25hbCAoY29uZGl0aW9uLCB5ZXMsIG5vKSB7XG4gIHRoaXMuZXZhbCA9IGZ1bmN0aW9uIChzY29wZSkge1xuICAgIHJldHVybiAoISFjb25kaXRpb24uZXZhbChzY29wZSkpID8geWVzLmV2YWwoc2NvcGUpIDogbm8uZXZhbChzY29wZSk7XG4gIH07XG59XG5cbi8vIEFkZCB0aGUgdHdvIGFyZ3VtZW50cyB3aXRoIGF1dG9tYXRpYyB0eXBlIGNvbnZlcnNpb24uXG5mdW5jdGlvbiBhdXRvQ29udmVydEFkZChhLCBiKSB7XG4gIGlmIChhICE9IG51bGwgJiYgYiAhPSBudWxsKSB7XG4gICAgaWYgKHR5cGVvZiBhID09ICdzdHJpbmcnICYmIHR5cGVvZiBiICE9ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gYSArIGIudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICBpZiAodHlwZW9mIGEgIT0gJ3N0cmluZycgJiYgdHlwZW9mIGIgPT0gJ3N0cmluZycpIHtcbiAgICAgIHJldHVybiBhLnRvU3RyaW5nKCkgKyBiO1xuICAgIH1cblxuICAgIHJldHVybiBhICsgYjtcbiAgfVxuXG4gIGlmIChhICE9IG51bGwpIHtcbiAgICByZXR1cm4gYTtcbiAgfVxuXG4gIGlmIChiICE9IG51bGwpIHtcbiAgICByZXR1cm4gYjtcbiAgfVxuXG4gIHJldHVybiAwO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgQmluYXJ5OiBCaW5hcnksXG4gIENvbmRpdGlvbmFsOiBDb25kaXRpb25hbCxcbiAgQWNjZXNzTWVtYmVyOiBBY2Nlc3NNZW1iZXIsXG4gIEFjY2Vzc1Njb3BlOiBBY2Nlc3NTY29wZSxcbiAgUHJlZml4Tm90OiBQcmVmaXhOb3QsXG4gIExpdGVyYWxQcmltaXRpdmU6IExpdGVyYWxQcmltaXRpdmVcbn07XG4iLCIvKipcbiAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleFxuICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAqL1xuZnVuY3Rpb24gVG9rZW4gKGluZGV4LCB0ZXh0KSB7XG4gIHRoaXMuaW5kZXggPSBpbmRleDtcbiAgdGhpcy50ZXh0ID0gdGV4dDtcbn1cblxuVG9rZW4ucHJvdG90eXBlID0ge1xuICB3aXRoT3A6IGZ1bmN0aW9uIChvcCkge1xuICAgIHRoaXMub3BLZXkgPSBvcDtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcbiAgd2l0aEdldHRlclNldHRlcjogZnVuY3Rpb24gKGtleSkge1xuICAgIHRoaXMua2V5ID0ga2V5O1xuICAgIHJldHVybiB0aGlzO1xuICB9LFxuICB3aXRoVmFsdWU6IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcbiAgdG9TdHJpbmc6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gJ1Rva2VuKCcgKyB0aGlzLnRleHQgKyAnKSc7XG4gIH1cbn07XG5cbi8qKlxuICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAqIEByZXR1cm4ge0FycmF5fSBBcnJheU9mVG9rZW5zXG4gKi9cbmZ1bmN0aW9uIGxleCAodGV4dCkge1xuICB2YXIgc2Nhbm5lciA9IG5ldyBTY2FubmVyKHRleHQpO1xuICB2YXIgdG9rZW5zID0gW107XG4gIHZhciB0b2tlbiA9IHNjYW5uZXIuc2NhblRva2VuKCk7XG5cbiAgd2hpbGUgKHRva2VuKSB7XG4gICAgdG9rZW5zLnB1c2godG9rZW4pO1xuICAgIHRva2VuID0gc2Nhbm5lci5zY2FuVG9rZW4oKTtcbiAgfVxuXG4gIHJldHVybiB0b2tlbnM7XG59XG5cbi8qKlxuICogQHBhcmFtIHtTdHJpbmd9IGlucHV0XG4gKi9cbmZ1bmN0aW9uIFNjYW5uZXIgKGlucHV0KSB7XG4gIHRoaXMuaW5wdXQgPSBpbnB1dDtcbiAgdGhpcy5sZW5ndGggPSBpbnB1dC5sZW5ndGg7XG4gIHRoaXMucGVlayA9IDA7XG4gIHRoaXMuaW5kZXggPSAtMTtcblxuICB0aGlzLmFkdmFuY2UoKTtcbn1cblxuU2Nhbm5lci5wcm90b3R5cGUgPSB7XG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1Rva2VufVxuICAgKi9cbiAgc2NhblRva2VuOiBmdW5jdGlvbiAoKSB7XG4gICAgICAvLyBTa2lwIHdoaXRlc3BhY2UuXG4gICAgd2hpbGUgKHRoaXMucGVlayA8PSAkU1BBQ0UpIHtcbiAgICAgIGlmICgrK3RoaXMuaW5kZXggPj0gdGhpcy5sZW5ndGgpIHtcbiAgICAgICAgdGhpcy5wZWVrID0gJEVPRjtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLnBlZWsgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5pbmRleCk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gSGFuZGxlIGlkZW50aWZpZXJzIGFuZCBudW1iZXJzLlxuICAgIGlmIChpc0lkZW50aWZpZXJTdGFydCh0aGlzLnBlZWspKSB7XG4gICAgICByZXR1cm4gdGhpcy5zY2FuSWRlbnRpZmllcigpO1xuICAgIH1cblxuICAgIGlmIChpc0RpZ2l0KHRoaXMucGVlaykpIHtcbiAgICAgIHJldHVybiB0aGlzLnNjYW5OdW1iZXIodGhpcy5pbmRleCk7XG4gICAgfVxuXG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5pbmRleDtcblxuICAgIHN3aXRjaCAodGhpcy5wZWVrKSB7XG4gICAgICBjYXNlICRQRVJJT0Q6XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICByZXR1cm4gaXNEaWdpdCh0aGlzLnBlZWspID8gdGhpcy5zY2FuTnVtYmVyKHN0YXJ0KSA6IG5ldyBUb2tlbihzdGFydCwgJy4nKTtcbiAgICAgIGNhc2UgJExQQVJFTjpcbiAgICAgIGNhc2UgJFJQQVJFTjpcbiAgICAgIGNhc2UgJExCUkFDRTpcbiAgICAgIGNhc2UgJFJCUkFDRTpcbiAgICAgIGNhc2UgJExCUkFDS0VUOlxuICAgICAgY2FzZSAkUkJSQUNLRVQ6XG4gICAgICBjYXNlICRDT01NQTpcbiAgICAgIGNhc2UgJENPTE9OOlxuICAgICAgY2FzZSAkU0VNSUNPTE9OOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ2hhcmFjdGVyKHN0YXJ0LCBTdHJpbmcuZnJvbUNoYXJDb2RlKHRoaXMucGVlaykpO1xuICAgICAgY2FzZSAkU1E6XG4gICAgICBjYXNlICREUTpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhblN0cmluZygpO1xuICAgICAgY2FzZSAkUExVUzpcbiAgICAgIGNhc2UgJE1JTlVTOlxuICAgICAgY2FzZSAkU1RBUjpcbiAgICAgIGNhc2UgJFNMQVNIOlxuICAgICAgY2FzZSAkUEVSQ0VOVDpcbiAgICAgIGNhc2UgJENBUkVUOlxuICAgICAgY2FzZSAkUVVFU1RJT046XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5PcGVyYXRvcihzdGFydCwgU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnBlZWspKTtcbiAgICAgIGNhc2UgJExUOlxuICAgICAgY2FzZSAkR1Q6XG4gICAgICBjYXNlICRCQU5HOlxuICAgICAgY2FzZSAkRVE6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Db21wbGV4T3BlcmF0b3Ioc3RhcnQsICRFUSwgU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnBlZWspLCAnPScpO1xuICAgICAgY2FzZSAkQU1QRVJTQU5EOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ29tcGxleE9wZXJhdG9yKHN0YXJ0LCAkQU1QRVJTQU5ELCAnJicsICcmJyk7XG4gICAgICBjYXNlICRCQVI6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5Db21wbGV4T3BlcmF0b3Ioc3RhcnQsICRCQVIsICd8JywgJ3wnKTtcbiAgICAgIGNhc2UgJFRJTERFOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ29tcGxleE9wZXJhdG9yKHN0YXJ0LCAkU0xBU0gsICd+JywgJy8nKTtcbiAgICAgIGNhc2UgJE5CU1A6XG4gICAgICAgIHdoaWxlIChpc1doaXRlc3BhY2UodGhpcy5wZWVrKSl7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuVG9rZW4oKTtcbiAgICB9XG5cbiAgICB2YXIgY2hhcmFjdGVyID0gU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnBlZWspO1xuICAgIHRoaXMuZXJyb3IoJ1VuZXhwZWN0ZWQgY2hhcmFjdGVyIFsnICsgY2hhcmFjdGVyICsgJ31dJyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBzdHJpbmdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7VG9rZW59XG4gICAqL1xuICBzY2FuQ2hhcmFjdGVyOiBmdW5jdGlvbiAoc3RhcnQsIHRleHQpIHtcbiAgICBhc3NlcnQodGhpcy5wZWVrID09IHRleHQuY2hhckNvZGVBdCgwKSk7XG4gICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgcmV0dXJuIG5ldyBUb2tlbihzdGFydCwgdGV4dCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBzdHJpbmdcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7VG9rZW59XG4gICAqL1xuICBzY2FuT3BlcmF0b3I6IGZ1bmN0aW9uIChzdGFydCwgdGV4dCkge1xuICAgIGFzc2VydCh0aGlzLnBlZWsgPT0gdGV4dC5jaGFyQ29kZUF0KDApKTtcbiAgICBhc3NlcnQoT1BFUkFUT1JTLmluZGV4T2YodGV4dCkgIT0gLTEpO1xuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuZXcgVG9rZW4oc3RhcnQsIHRleHQpLndpdGhPcCh0ZXh0KTtcbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHN0YXJ0XG4gICAqIEBwYXJhbSB7TnVtYmVyfSBjb2RlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBvbmVcbiAgICogQHBhcmFtIHtTdHJpbmd9IHR3b1xuICAgKiBAcmV0dXJuIHtUb2tlbn1cbiAgICovXG4gIHNjYW5Db21wbGV4T3BlcmF0b3I6IGZ1bmN0aW9uIChzdGFydCwgY29kZSwgb25lLCB0d28pIHtcbiAgICBhc3NlcnQodGhpcy5wZWVrID09IG9uZS5jaGFyQ29kZUF0KDApKTtcbiAgICB0aGlzLmFkdmFuY2UoKTtcblxuICAgIHZhciB0ZXh0ID0gb25lO1xuXG4gICAgaWYgKHRoaXMucGVlayA9PSBjb2RlKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHRleHQgKz0gdHdvO1xuICAgIH1cblxuICAgIGFzc2VydChPUEVSQVRPUlMuaW5kZXhPZih0ZXh0KSAhPSAtMSk7XG5cbiAgICByZXR1cm4gbmV3IFRva2VuKHN0YXJ0LCB0ZXh0KS53aXRoT3AodGV4dCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1Rva2VufVxuICAgKi9cbiAgc2NhbklkZW50aWZpZXI6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3RhcnQgPSB0aGlzLmluZGV4O1xuXG4gICAgdGhpcy5hZHZhbmNlKCk7XG5cbiAgICB3aGlsZSAoaXNJZGVudGlmaWVyUGFydCh0aGlzLnBlZWspKSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICB9XG5cbiAgICB2YXIgdGV4dCA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmluZGV4KTtcbiAgICB2YXIgcmVzdWx0ID0gbmV3IFRva2VuKHN0YXJ0LCB0ZXh0KTtcblxuICAgIC8vIFRPRE8oa2FzcGVybCk6IERlYWwgd2l0aCBudWxsLCB1bmRlZmluZWQsIHRydWUsIGFuZCBmYWxzZSBpblxuICAgIC8vIGEgY2xlYW5lciBhbmQgZmFzdGVyIHdheS5cbiAgICBpZiAoT1BFUkFUT1JTLmluZGV4T2YodGV4dCkgIT0gLTEpIHtcbiAgICAgIHJlc3VsdC53aXRoT3AodGV4dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJlc3VsdC53aXRoR2V0dGVyU2V0dGVyKHRleHQpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBzdGFydFxuICAgKiBAcmV0dXJuIHtUb2tlbn1cbiAgICovXG4gIHNjYW5OdW1iZXI6IGZ1bmN0aW9uIChzdGFydCkge1xuICAgIHZhciBzaW1wbGUgPSAodGhpcy5pbmRleCA9PSBzdGFydCk7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBTa2lwIGluaXRpYWwgZGlnaXQuXG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKGlzRGlnaXQodGhpcy5wZWVrKSkge1xuICAgICAgICAvLyBEbyBub3RoaW5nLlxuICAgICAgfSBlbHNlIGlmICh0aGlzLnBlZWsgPT0gJFBFUklPRCkge1xuICAgICAgICBzaW1wbGUgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSBpZiAoaXNFeHBvbmVudFN0YXJ0KHRoaXMucGVlaykpIHtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG5cbiAgICAgICAgaWYgKGlzRXhwb25lbnRTaWduKHRoaXMucGVlaykpe1xuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCFpc0RpZ2l0KHRoaXMucGVlaykpe1xuICAgICAgICAgIHRoaXMuZXJyb3IoJ0ludmFsaWQgZXhwb25lbnQnLCAtMSk7XG4gICAgICAgIH1cblxuICAgICAgICBzaW1wbGUgPSBmYWxzZTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICB9XG5cbiAgICB2YXIgdGV4dCA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHN0YXJ0LCB0aGlzLmluZGV4KTtcbiAgICB2YXIgdmFsdWUgPSBzaW1wbGUgPyBwYXJzZUludCh0ZXh0KSA6IHBhcnNlRmxvYXQodGV4dCk7XG4gICAgcmV0dXJuIG5ldyBUb2tlbihzdGFydCwgdGV4dCkud2l0aFZhbHVlKHZhbHVlKTtcbiAgfSxcblxuICAvKipcbiAgICogQHJldHVybiB7VG9rZW59XG4gICAqL1xuICBzY2FuU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5pbmRleDtcbiAgICB2YXIgcXVvdGUgPSB0aGlzLnBlZWs7XG5cbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIFNraXAgaW5pdGlhbCBxdW90ZS5cblxuICAgIHZhciBidWZmZXI7XG4gICAgdmFyIG1hcmtlciA9IHRoaXMuaW5kZXg7XG5cbiAgICB3aGlsZSAodGhpcy5wZWVrICE9IHF1b3RlKSB7XG4gICAgICBpZiAodGhpcy5wZWVrID09ICRCQUNLU0xBU0gpIHtcbiAgICAgICAgaWYgKGJ1ZmZlciA9PSBudWxsKSB7XG4gICAgICAgICAgYnVmZmVyID0gW107XG4gICAgICAgIH1cblxuICAgICAgICBidWZmZXIucHVzaCh0aGlzLmlucHV0LnN1YnN0cmluZyhtYXJrZXIsIHRoaXMuaW5kZXgpKTtcbiAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG5cbiAgICAgICAgdmFyIHVuZXNjYXBlZDtcblxuICAgICAgICBpZiAodGhpcy5wZWVrID09ICR1KSB7XG4gICAgICAgICAgLy8gVE9ETyhrYXNwZXJsKTogQ2hlY2sgYm91bmRzPyBNYWtlIHN1cmUgd2UgaGF2ZSB0ZXN0XG4gICAgICAgICAgLy8gY292ZXJhZ2UgZm9yIHRoaXMuXG4gICAgICAgICAgdmFyIGhleCA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKHRoaXMuaW5kZXggKyAxLCB0aGlzLmluZGV4ICsgNSk7XG5cbiAgICAgICAgICBpZighL1tBLVowLTldezR9Ly50ZXN0KGhleCkpe1xuICAgICAgICAgICAgdGhpcy5lcnJvcignSW52YWxpZCB1bmljb2RlIGVzY2FwZSBbXFxcXHUnICsgaGV4ICsgJ10nKTtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICB1bmVzY2FwZWQgPSBwYXJzZUludChoZXgsIDE2KTtcblxuICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwgNTsgaSsrKSB7XG4gICAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgdW5lc2NhcGVkID0gZGVjb2RlVVJJQ29tcG9uZW50KHRoaXMucGVlayk7XG4gICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgIH1cblxuICAgICAgICBidWZmZXIucHVzaChTdHJpbmcuZnJvbUNoYXJDb2RlKHVuZXNjYXBlZCkpO1xuICAgICAgICBtYXJrZXIgPSB0aGlzLmluZGV4O1xuICAgICAgfSBlbHNlIGlmICh0aGlzLnBlZWsgPT0gJEVPRikge1xuICAgICAgICB0aGlzLmVycm9yKCdVbnRlcm1pbmF0ZWQgcXVvdGUnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIHZhciBsYXN0ID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcobWFya2VyLCB0aGlzLmluZGV4KTtcbiAgICB0aGlzLmFkdmFuY2UoKTsgIC8vIFNraXAgdGVybWluYXRpbmcgcXVvdGUuXG4gICAgdmFyIHRleHQgPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgdGhpcy5pbmRleCk7XG5cbiAgICAvLyBDb21wdXRlIHRoZSB1bmVzY2FwZWQgc3RyaW5nIHZhbHVlLlxuICAgIHZhciB1bmVzY2FwZWQgPSBsYXN0O1xuXG4gICAgaWYgKGJ1ZmZlciAhPSBudWxsKSB7XG4gICAgICBidWZmZXIucHVzaChsYXN0KTtcbiAgICAgIHVuZXNjYXBlZCA9IGJ1ZmZlci5qb2luKCcnKTtcbiAgICB9XG5cbiAgICByZXR1cm4gbmV3IFRva2VuKHN0YXJ0LCB0ZXh0KS53aXRoVmFsdWUodW5lc2NhcGVkKTtcbiAgfSxcblxuICBhZHZhbmNlOiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKCsrdGhpcy5pbmRleCA+PSB0aGlzLmxlbmd0aCl7XG4gICAgICB0aGlzLnBlZWsgPSAkRU9GO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnBlZWsgPSB0aGlzLmlucHV0LmNoYXJDb2RlQXQodGhpcy5pbmRleCk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gbWVzc2FnZVxuICAgKiBAcGFyYW0ge051bWJlcn0gb2Zmc2V0XG4gICAqL1xuICBlcnJvcjogZnVuY3Rpb24gKG1lc3NhZ2UsIG9mZnNldCkge1xuICAgIG9mZnNldCA9IG9mZnNldCB8fCAwO1xuICAgIHZhciBwb3NpdGlvbiA9IHRoaXMuaW5kZXggKyBvZmZzZXQ7XG4gICAgdGhyb3cgbmV3IEVycm9yKCdMZXhlciBFcnJvcjogJyArIG1lc3NhZ2UgKyAnIGF0IGNvbHVtbiAnICsgcG9zaXRpb24gKyAnIGluIGV4cHJlc3Npb24gWycgKyB0aGlzLmlucHV0ICsgJ10nKTtcbiAgfVxufTtcblxudmFyICRFT0YgICAgICAgPSAwO1xudmFyICRUQUIgICAgICAgPSA5O1xudmFyICRMRiAgICAgICAgPSAxMDtcbnZhciAkVlRBQiAgICAgID0gMTE7XG52YXIgJEZGICAgICAgICA9IDEyO1xudmFyICRDUiAgICAgICAgPSAxMztcbnZhciAkU1BBQ0UgICAgID0gMzI7XG52YXIgJEJBTkcgICAgICA9IDMzO1xudmFyICREUSAgICAgICAgPSAzNDtcbnZhciAkJCAgICAgICAgID0gMzY7XG52YXIgJFBFUkNFTlQgICA9IDM3O1xudmFyICRBTVBFUlNBTkQgPSAzODtcbnZhciAkU1EgICAgICAgID0gMzk7XG52YXIgJExQQVJFTiAgICA9IDQwO1xudmFyICRSUEFSRU4gICAgPSA0MTtcbnZhciAkU1RBUiAgICAgID0gNDI7XG52YXIgJFBMVVMgICAgICA9IDQzO1xudmFyICRDT01NQSAgICAgPSA0NDtcbnZhciAkTUlOVVMgICAgID0gNDU7XG52YXIgJFBFUklPRCAgICA9IDQ2O1xudmFyICRTTEFTSCAgICAgPSA0NztcbnZhciAkQ09MT04gICAgID0gNTg7XG52YXIgJFNFTUlDT0xPTiA9IDU5O1xudmFyICRMVCAgICAgICAgPSA2MDtcbnZhciAkRVEgICAgICAgID0gNjE7XG52YXIgJEdUICAgICAgICA9IDYyO1xudmFyICRRVUVTVElPTiAgPSA2MztcblxudmFyICQwID0gNDg7XG52YXIgJDkgPSA1NztcblxudmFyICRBID0gNjU7XG52YXIgJEUgPSA2OTtcbnZhciAkWiA9IDkwO1xuXG52YXIgJExCUkFDS0VUICA9IDkxO1xudmFyICRCQUNLU0xBU0ggPSA5MjtcbnZhciAkUkJSQUNLRVQgID0gOTM7XG52YXIgJENBUkVUICAgICA9IDk0O1xudmFyICRfICAgICAgICAgPSA5NTtcblxudmFyICRhID0gOTc7XG52YXIgJGUgPSAxMDE7XG52YXIgJGYgPSAxMDI7XG52YXIgJG4gPSAxMTA7XG52YXIgJHIgPSAxMTQ7XG52YXIgJHQgPSAxMTY7XG52YXIgJHUgPSAxMTc7XG52YXIgJHYgPSAxMTg7XG52YXIgJHogPSAxMjI7XG5cbnZhciAkTEJSQUNFID0gMTIzO1xudmFyICRCQVIgICAgPSAxMjQ7XG52YXIgJFJCUkFDRSA9IDEyNTtcbnZhciAkVElMREUgID0gMTI2O1xudmFyICROQlNQICAgPSAxNjA7XG5cbnZhciBPUEVSQVRPUlMgPSBbXG4gICd1bmRlZmluZWQnLFxuICAnbnVsbCcsXG4gICd0cnVlJyxcbiAgJ2ZhbHNlJyxcbiAgJysnLFxuICAnLScsXG4gICcqJyxcbiAgJy8nLFxuICAnfi8nLFxuICAnJScsXG4gICdeJyxcbiAgJz0nLFxuICAnPT0nLFxuICAnIT0nLFxuICAnPCcsXG4gICc+JyxcbiAgJzw9JyxcbiAgJz49JyxcbiAgJyYmJyxcbiAgJ3x8JyxcbiAgJyYnLFxuICAnfCcsXG4gICchJyxcbiAgJz8nXG5dO1xuXG5mdW5jdGlvbiBpc1doaXRlc3BhY2UoY29kZSkge1xuICByZXR1cm4gKGNvZGUgPj0gJFRBQiAmJiBjb2RlIDw9ICRTUEFDRSkgfHwgKGNvZGUgPT0gJE5CU1ApO1xufVxuXG5mdW5jdGlvbiBpc0lkZW50aWZpZXJTdGFydChjb2RlKSB7XG4gIHJldHVybiAoJGEgPD0gY29kZSAmJiBjb2RlIDw9ICR6KVxuICAgICAgfHwgKCRBIDw9IGNvZGUgJiYgY29kZSA8PSAkWilcbiAgICAgIHx8IChjb2RlID09ICRfKVxuICAgICAgfHwgKGNvZGUgPT0gJCQpO1xufVxuXG5mdW5jdGlvbiBpc0lkZW50aWZpZXJQYXJ0KGNvZGUpIHtcbiAgcmV0dXJuICgkYSA8PSBjb2RlICYmIGNvZGUgPD0gJHopXG4gICAgICB8fCAoJEEgPD0gY29kZSAmJiBjb2RlIDw9ICRaKVxuICAgICAgfHwgKCQwIDw9IGNvZGUgJiYgY29kZSA8PSAkOSlcbiAgICAgIHx8IChjb2RlID09ICRfKVxuICAgICAgfHwgKGNvZGUgPT0gJCQpO1xufVxuXG5mdW5jdGlvbiBpc0RpZ2l0KGNvZGUpIHtcbiAgcmV0dXJuICgkMCA8PSBjb2RlICYmIGNvZGUgPD0gJDkpO1xufVxuXG5mdW5jdGlvbiBpc0V4cG9uZW50U3RhcnQoY29kZSkge1xuICByZXR1cm4gKGNvZGUgPT0gJGUgfHwgY29kZSA9PSAkRSk7XG59XG5cbmZ1bmN0aW9uIGlzRXhwb25lbnRTaWduKGNvZGUpIHtcbiAgcmV0dXJuIChjb2RlID09ICRNSU5VUyB8fCBjb2RlID09ICRQTFVTKTtcbn1cblxuZnVuY3Rpb24gdW5lc2NhcGUoY29kZSkge1xuICBzd2l0Y2goY29kZSkge1xuICAgIGNhc2UgJG46IHJldHVybiAkTEY7XG4gICAgY2FzZSAkZjogcmV0dXJuICRGRjtcbiAgICBjYXNlICRyOiByZXR1cm4gJENSO1xuICAgIGNhc2UgJHQ6IHJldHVybiAkVEFCO1xuICAgIGNhc2UgJHY6IHJldHVybiAkVlRBQjtcbiAgICBkZWZhdWx0OiByZXR1cm4gY29kZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBhc3NlcnQoY29uZGl0aW9uLCBtZXNzYWdlKSB7XG4gIGlmICghY29uZGl0aW9uKSB7XG4gICAgdGhyb3cgbWVzc2FnZSB8fCBcIkFzc2VydGlvbiBmYWlsZWRcIjtcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgVG9rZW46IFRva2VuLFxuICBsZXg6IGxleFxufTtcbiIsInZhciBMZXhlciA9IHJlcXVpcmUoJy4vbGV4ZXInKTtcbnZhciBFeHByZXNzaW9ucyA9IHJlcXVpcmUoJy4vYXN0Jyk7XG5cbnZhciBCaW5hcnkgPSBFeHByZXNzaW9ucy5CaW5hcnk7XG52YXIgQWNjZXNzTWVtYmVyID0gRXhwcmVzc2lvbnMuQWNjZXNzTWVtYmVyO1xudmFyIEFjY2Vzc1Njb3BlID0gRXhwcmVzc2lvbnMuQWNjZXNzU2NvcGU7XG52YXIgUHJlZml4Tm90ID0gRXhwcmVzc2lvbnMuUHJlZml4Tm90O1xudmFyIExpdGVyYWxQcmltaXRpdmUgPSBFeHByZXNzaW9ucy5MaXRlcmFsUHJpbWl0aXZlO1xudmFyIENvbmRpdGlvbmFsID0gRXhwcmVzc2lvbnMuQ29uZGl0aW9uYWw7XG5cbmZ1bmN0aW9uIFBhcnNlciAoKSB7XG4gIHRoaXMuY2FjaGUgPSB7fTtcbn1cblxuUGFyc2VyLnByb3RvdHlwZSA9IHtcbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dFxuICAgKiBAcmV0dXJuIHtQYXJzZXJJbXBsZW1lbnRhdGlvbn1cbiAgICovXG4gIHBhcnNlOiBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICBpbnB1dCA9IGlucHV0IHx8ICcnO1xuXG4gICAgaWYgKCF0aGlzLmNhY2hlLmhhc093blByb3BlcnR5KGlucHV0KSkge1xuICAgICAgdGhpcy5jYWNoZVtpbnB1dF0gPSBuZXcgUGFyc2VySW1wbGVtZW50YXRpb24oTGV4ZXIsIGlucHV0KS5wYXJzZSgpO1xuICAgIH1cblxuICAgIHJldHVybiB0aGlzLmNhY2hlW2lucHV0XTtcbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IGlucHV0XG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG4gIHBhcnNlT2JqZWN0OiBmdW5jdGlvbiAoaW5wdXQpIHtcbiAgICB2YXIgb2JqID0ge307XG4gICAgdmFyIGFjY2Vzc1Njb3BlTmFtZXMgPSBbXTtcblxuICAgIC8vIFRPRE86IHRoZXJlIGFyZSBlZGdlcyBjYXNlcyBoZXJlIHdoZW4gdXNpbmcgc3BsaXRcbiAgICBpbnB1dC5zcGxpdCgnOycpLmZvckVhY2goZnVuY3Rpb24gKGV4cCkge1xuICAgICAgdmFyIGtleVNlcGFyYXRvckluZGV4ID0gZXhwLmluZGV4T2YoJzonKTtcbiAgICAgIHZhciBleHByZXNzaW9uID0gdGhpcy5wYXJzZShleHAuc3Vic3RyaW5nKGtleVNlcGFyYXRvckluZGV4ICsgMSkudHJpbSgpKTtcbiAgICAgIGFjY2Vzc1Njb3BlTmFtZXMgPSBhY2Nlc3NTY29wZU5hbWVzLmNvbmNhdChleHByZXNzaW9uLmFjY2Vzc1Njb3BlTmFtZXMpO1xuICAgICAgb2JqW2V4cC5zdWJzdHJpbmcoMCwga2V5U2VwYXJhdG9ySW5kZXgpXSA9IGV4cHJlc3Npb247XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIHJldHVybiB7XG4gICAgICBpbnB1dDogaW5wdXQsXG4gICAgICBhY2Nlc3NTY29wZU5hbWVzOiBhY2Nlc3NTY29wZU5hbWVzLFxuICAgICAgZXZhbDogZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgICAgIHZhciByZXR1cm5PYmogPSB7fTtcblxuICAgICAgICBPYmplY3Qua2V5cyhvYmopLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgICAgIHJldHVybk9ialtrZXldID0gb2JqW2tleV0uZXZhbChzY29wZSk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiByZXR1cm5PYmo7XG4gICAgICB9XG4gICAgfTtcbiAgfVxufVxuXG52YXIgRU9GID0gbmV3IExleGVyLlRva2VuKC0xLCBudWxsKTtcblxuLyoqXG4gKiBAcGFyYW0ge09iamVjdH0gbGV4ZXJcbiAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dFxuICovXG5mdW5jdGlvbiBQYXJzZXJJbXBsZW1lbnRhdGlvbihsZXhlciwgaW5wdXQpIHtcbiAgdGhpcy5pbmRleCA9IDA7XG4gIHRoaXMuaW5wdXQgPSBpbnB1dDtcbiAgdGhpcy5hY2Nlc3NTY29wZU5hbWVzID0gW107XG4gIHRoaXMudG9rZW5zID0gbGV4ZXIubGV4KGlucHV0KTtcbn1cblxuUGFyc2VySW1wbGVtZW50YXRpb24ucHJvdG90eXBlID0ge1xuXG4gIHBlZWs6IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID8gdGhpcy50b2tlbnNbdGhpcy5pbmRleF0gOiBFT0Y7XG4gIH0sXG5cbiAgcGFyc2U6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgZXhwcmVzc2lvbiA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgLy8gZXhwb3NlIHVzZWZ1bCBpbmZvcm1hdGlvblxuICAgIGV4cHJlc3Npb24uaW5wdXQgPSB0aGlzLmlucHV0O1xuICAgIGV4cHJlc3Npb24uYWNjZXNzU2NvcGVOYW1lcyA9IHRoaXMuYWNjZXNzU2NvcGVOYW1lcztcbiAgICByZXR1cm4gZXhwcmVzc2lvbjtcbiAgfSxcblxuICBwYXJzZUV4cHJlc3Npb246IGZ1bmN0aW9uICgpICB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VDb25kaXRpb25hbCgpO1xuXG4gICAgd2hpbGUgKHRoaXMub3B0aW9uYWwoJyknKSkge1xuICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuXG4gIHBhcnNlQ29uZGl0aW9uYWw6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgc3RhcnQgPSB0aGlzLnBlZWsoKS5pbmRleCxcbiAgICAgIHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsT3IoKTtcblxuICAgIGlmICh0aGlzLm9wdGlvbmFsKCc/JykpIHtcbiAgICAgIHZhciB5ZXMgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuXG4gICAgICBpZiAoIXRoaXMub3B0aW9uYWwoJzonKSkge1xuICAgICAgICB2YXIgZW5kID0gKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID8gdGhpcy5wZWVrKCkuaW5kZXggOiB0aGlzLmlucHV0Lmxlbmd0aDtcbiAgICAgICAgdmFyIGV4cHJlc3Npb24gPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgZW5kKTtcblxuICAgICAgICB0aGlzLmVycm9yKCdDb25kaXRpb25hbCBleHByZXNzaW9uJyArIGV4cHJlc3Npb24gKyAncmVxdWlyZXMgYWxsIDMgZXhwcmVzc2lvbnMnKTtcbiAgICAgIH1cblxuICAgICAgdmFyIG5vID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICAgIHJlc3VsdCA9IG5ldyBDb25kaXRpb25hbChyZXN1bHQsIHllcywgbm8pO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgcGFyc2VMb2dpY2FsT3I6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKTtcblxuICAgIHdoaWxlICh0aGlzLm9wdGlvbmFsKCd8fCcpKSB7XG4gICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCd8fCcsIHJlc3VsdCwgdGhpcy5wYXJzZUxvZ2ljYWxBbmQoKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICBwYXJzZUxvZ2ljYWxBbmQ6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZUVxdWFsaXR5KCk7XG5cbiAgICB3aGlsZSAodGhpcy5vcHRpb25hbCgnJiYnKSkge1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnJiYnLCByZXN1bHQsIHRoaXMucGFyc2VFcXVhbGl0eSgpKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuXG4gIHBhcnNlRXF1YWxpdHk6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZVJlbGF0aW9uYWwoKTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25hbCgnPT0nKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCc9PScsIHJlc3VsdCwgdGhpcy5wYXJzZVJlbGF0aW9uYWwoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJyE9JykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnIT0nLCByZXN1bHQsIHRoaXMucGFyc2VSZWxhdGlvbmFsKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgcGFyc2VSZWxhdGlvbmFsOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VBZGRpdGl2ZSgpO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbmFsKCc8JykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnPCcsIHJlc3VsdCwgdGhpcy5wYXJzZUFkZGl0aXZlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCc+JykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnPicsIHJlc3VsdCwgdGhpcy5wYXJzZUFkZGl0aXZlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCc8PScpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJzw9JywgcmVzdWx0LCB0aGlzLnBhcnNlQWRkaXRpdmUoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJz49JykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnPj0nLCByZXN1bHQsIHRoaXMucGFyc2VBZGRpdGl2ZSgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHBhcnNlQWRkaXRpdmU6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCk7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMub3B0aW9uYWwoJysnKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCcrJywgcmVzdWx0LCB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJy0nKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCctJywgcmVzdWx0LCB0aGlzLnBhcnNlTXVsdGlwbGljYXRpdmUoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwYXJzZU11bHRpcGxpY2F0aXZlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VQcmVmaXgoKTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25hbCgnKicpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJyonLCByZXN1bHQsIHRoaXMucGFyc2VQcmVmaXgoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJyUnKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCclJywgcmVzdWx0LCB0aGlzLnBhcnNlUHJlZml4KCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCcvJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnLycsIHJlc3VsdCwgdGhpcy5wYXJzZVByZWZpeCgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnfi8nKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCd+LycsIHJlc3VsdCwgdGhpcy5wYXJzZVByZWZpeCgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHBhcnNlUHJlZml4OiBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMub3B0aW9uYWwoJysnKSkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VQcmVmaXgoKTsgLy8gVE9ETyhrYXNwZXJsKTogVGhpcyBpcyBkaWZmZXJlbnQgdGhhbiB0aGUgb3JpZ2luYWwgcGFyc2VyLlxuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnLScpKSB7XG4gICAgICByZXR1cm4gbmV3IEJpbmFyeSgnLScsIG5ldyBMaXRlcmFsUHJpbWl0aXZlKDApLCB0aGlzLnBhcnNlUHJlZml4KCkpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnIScpKSB7XG4gICAgICByZXR1cm4gbmV3IFByZWZpeE5vdCgnIScsIHRoaXMucGFyc2VQcmVmaXgoKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlQWNjZXNzTWVtYmVyKCk7XG4gICAgfVxuICB9LFxuXG4gIHBhcnNlQWNjZXNzTWVtYmVyOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VQcmltYXJ5KCk7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMub3B0aW9uYWwoJy4nKSkge1xuICAgICAgICB2YXIgbmFtZSA9IHRoaXMucGVlaygpLnRleHQ7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICByZXN1bHQgPSBuZXcgQWNjZXNzTWVtYmVyKHJlc3VsdCwgbmFtZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwYXJzZVByaW1hcnk6IGZ1bmN0aW9uICgpIHtcbiAgICBpZiAodGhpcy5vcHRpb25hbCgnKCcpKSB7XG4gICAgICAvLyBUT0RPXG4gICAgICB2YXIgcmVzdWx0ID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcbiAgICAgIHJldHVybiByZXN1bHRcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJ251bGwnKSB8fCB0aGlzLm9wdGlvbmFsKCd1bmRlZmluZWQnKSkge1xuICAgICAgcmV0dXJuIG5ldyBMaXRlcmFsUHJpbWl0aXZlKG51bGwpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgndHJ1ZScpKSB7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodHJ1ZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCdmYWxzZScpKSB7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUoZmFsc2UpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wZWVrKCkua2V5ICE9IG51bGwpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlQWNjZXNzU2NvcGUoKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMucGVlaygpLnZhbHVlICE9IG51bGwpIHtcbiAgICAgIHZhciB2YWx1ZSA9IHRoaXMucGVlaygpLnZhbHVlO1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUodmFsdWUpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5pbmRleCA+PSB0aGlzLnRva2Vucy5sZW5ndGgpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcignVW5leHBlY3RlZCBlbmQgb2YgZXhwcmVzc2lvbjogJyArIHRoaXMuaW5wdXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmVycm9yKCdVbmV4cGVjdGVkIHRva2VuICcgKyB0aGlzLnBlZWsoKS50ZXh0KTtcbiAgICB9XG5cbiAgfSxcblxuICBwYXJzZUFjY2Vzc1Njb3BlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG5hbWUgPSB0aGlzLnBlZWsoKS5rZXk7XG5cbiAgICB0aGlzLmFkdmFuY2UoKTtcblxuICAgIGlmICh0aGlzLmFjY2Vzc1Njb3BlTmFtZXMuaW5kZXhPZihuYW1lKSA9PT0gLTEpIHtcbiAgICAgIHRoaXMuYWNjZXNzU2NvcGVOYW1lcy5wdXNoKG5hbWUpO1xuICAgIH1cblxuICAgIHJldHVybiBuZXcgQWNjZXNzU2NvcGUobmFtZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge0Jvb2xlYW59XG4gICAqL1xuICBvcHRpb25hbDogZnVuY3Rpb24gKHRleHQpIHtcbiAgICBpZiAodGhpcy5wZWVrKCkudGV4dCA9PSB0ZXh0KSB7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuICAgIHJldHVybiBmYWxzZTtcbiAgfSxcblxuICBhZHZhbmNlOiBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5pbmRleCsrO1xuICB9LFxuXG4gIGVycm9yOiBmdW5jdGlvbiAobWVzc2FnZSkge1xuICAgIHZhciBsb2NhdGlvbiA9ICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSA/XG4gICAgICAnYXQgY29sdW1uICcgKyB0aGlzLnRva2Vuc1t0aGlzLmluZGV4XS5pbmRleCArIDEgKyAnIGluJyA6XG4gICAgICAnYXQgdGhlIGVuZCBvZiB0aGUgZXhwcmVzc2lvbic7XG5cbiAgICB0aHJvdyBuZXcgRXJyb3IoJ1BhcnNlciBFcnJvcjogJyArIG1lc3NhZ2UgKyAnICcgKyBsb2NhdGlvbiArICcgWycgKyB0aGlzLmlucHV0ICsgJ10nKTtcbiAgfVxuXG59O1xuXG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBQYXJzZXI6IFBhcnNlcixcbiAgUGFyc2VySW1wbGVtZW50YXRpb246IFBhcnNlckltcGxlbWVudGF0aW9uXG59O1xuIiwidmFyIFN0YXRlZnVsRm9ybUVsZW1lbnQgPSByZXF1aXJlKCcuL3N0YXRlZnVsLWZvcm0tZWxlbWVudCcpO1xuXG52YXIgQ2xzID0gZnVuY3Rpb24gU3RhdGVmdWxDaGVja2JveCAoKSB7XG4gIFN0YXRlZnVsRm9ybUVsZW1lbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn07XG5cbnZhciBQcm90byA9IENscy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0YXRlZnVsRm9ybUVsZW1lbnQucHJvdG90eXBlKTtcblxuUHJvdG8uYmluZEV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLnVwZGF0ZVZhbHVlLmJpbmQodGhpcykpO1xufTtcblxuUHJvdG8udXBkYXRlVmFsdWUgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuc2V0U3RhdGUoeyB2YWx1ZTogdGhpcy5nZXRWYWx1ZSgpLCBwcmlzdGluZTogZmFsc2UsIHRvdWNoZWQ6IHRydWUgfSk7XG59O1xuXG5Qcm90by5pc1ZhbGlkID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5lbC5oYXNBdHRyaWJ1dGUoJ3JlcXVpcmVkJykpIHtcbiAgICByZXR1cm4gdGhpcy5lbC5jaGVja2VkO1xuICB9XG4gIHJldHVybiB0cnVlO1xufTtcblxuUHJvdG8uZ2V0VmFsdWUgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB0aGlzLmVsLmNoZWNrZWQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENscztcbiIsInZhciBTdGF0ZWZ1bE9iamVjdCA9IHJlcXVpcmUoJy4uL3N0YXRlZnVsLW9iamVjdCcpO1xuXG5mdW5jdGlvbiBTdGF0ZWZ1bEZvcm1FbGVtZW50IChlbCkge1xuICB0aGlzLmVsID0gZWw7XG4gIHRoaXMubmFtZSA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCduYW1lJyk7XG4gIFN0YXRlZnVsT2JqZWN0LmNhbGwodGhpcyk7XG4gIHRoaXMuYmluZEV2ZW50cygpO1xufVxuXG52YXIgUHJvdG8gPSBTdGF0ZWZ1bEZvcm1FbGVtZW50LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxPYmplY3QucHJvdG90eXBlKTtcblxuUHJvdG8uZ2V0RGVmYXVsdFN0YXRlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB7XG4gICAgdmFsaWQ6IHRoaXMuaXNWYWxpZCgpLFxuICAgIHByaXN0aW5lOiB0cnVlLFxuICAgIHRvdWNoZWQ6IGZhbHNlLFxuICAgIHZhbHVlOiB0aGlzLmdldFZhbHVlKClcbiAgfTtcblxuICByZXR1cm4gc3RhdGU7XG59O1xuXG5Qcm90by5nZXRWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZWwudmFsdWU7XG59O1xuXG5Qcm90by5jb21wdXRlZFN0YXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHN0YXRlLnZhbGlkID0gdGhpcy5pc1ZhbGlkKCk7XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oc3RhdGUsIHtcbiAgICBpbnZhbGlkOiAhc3RhdGUudmFsaWQsXG4gICAgZGlydHk6ICFzdGF0ZS5wcmlzdGluZSxcbiAgICB1bnRvdWNoZWQ6ICFzdGF0ZS50b3VjaGVkXG4gIH0pO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZWZ1bEZvcm1FbGVtZW50O1xuIiwidmFyIFN0YXRlZnVsRm9ybUVsZW1lbnQgPSByZXF1aXJlKCcuL3N0YXRlZnVsLWZvcm0tZWxlbWVudCcpO1xuXG5mdW5jdGlvbiBTdGF0ZWZ1bFNlbGVjdCAoKSB7XG4gIFN0YXRlZnVsRm9ybUVsZW1lbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxudmFyIFByb3RvID0gU3RhdGVmdWxTZWxlY3QucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bEZvcm1FbGVtZW50LnByb3RvdHlwZSk7XG5cblByb3RvLmJpbmRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy51cGRhdGVWYWx1ZS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLnVwZGF0ZVZhbHVlID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnNldFN0YXRlKHsgdmFsdWU6IHRoaXMuZ2V0VmFsdWUoKSwgcHJpc3RpbmU6IGZhbHNlLCB0b3VjaGVkOiB0cnVlIH0pO1xufTtcblxuUHJvdG8uaXNWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuICEhdGhpcy5lbC52YWx1ZTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVmdWxTZWxlY3Q7XG4iLCJ2YXIgU3RhdGVmdWxGb3JtRWxlbWVudCA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtZm9ybS1lbGVtZW50Jyk7XG5cbmZ1bmN0aW9uIFN0YXRlZnVsVGV4dElucHV0ICgpIHtcbiAgU3RhdGVmdWxGb3JtRWxlbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG52YXIgUHJvdG8gPSBTdGF0ZWZ1bFRleHRJbnB1dC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0YXRlZnVsRm9ybUVsZW1lbnQucHJvdG90eXBlKTtcblxuUHJvdG8uYmluZEV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHVwZGF0ZVZhbHVlID0gdGhpcy51cGRhdGVWYWx1ZS5iaW5kKHRoaXMpO1xuXG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcigna2V5dXAnLCB1cGRhdGVWYWx1ZSk7XG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdXBkYXRlVmFsdWUpO1xuXG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignYmx1cicsIGZ1bmN0aW9uIG9uQmx1ciAoKSB7XG4gICAgdGhpcy5zZXRTdGF0ZSh7IHRvdWNoZWQ6IHRydWUgfSk7XG4gIH0uYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by51cGRhdGVWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zZXRTdGF0ZSh7IHZhbHVlOiB0aGlzLmdldFZhbHVlKCksIHByaXN0aW5lOiBmYWxzZSB9KTtcbn07XG5cblByb3RvLmNvbXB1dGVkU3RhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgc3RhdGUudmFsaWQgPSB0aGlzLmlzVmFsaWQoKTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihzdGF0ZSwge1xuICAgIGludmFsaWQ6ICFzdGF0ZS52YWxpZCxcbiAgICBkaXJ0eTogIXN0YXRlLnByaXN0aW5lLFxuICAgIHVudG91Y2hlZDogIXN0YXRlLnRvdWNoZWRcbiAgfSk7XG59O1xuXG5Qcm90by5nZXRWYWxpZGF0aW9uUnVsZXMgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBydWxlcyA9IFtdO1xuICB2YXIgcmVxdWlyZWQgPSB0aGlzLmVsLmhhc0F0dHJpYnV0ZSgncmVxdWlyZWQnKTtcbiAgdmFyIG1pbiA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdtaW4nKTtcbiAgdmFyIG1heCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdtYXgnKTtcbiAgdmFyIG1heGxlbmd0aCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdtYXhsZW5ndGgnKTtcbiAgdmFyIG1pbmxlbmd0aCA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdtaW5sZW5ndGgnKTtcbiAgdmFyIHBhdHRlcm4gPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgncGF0dGVybicpO1xuXG4gIGlmIChyZXF1aXJlZCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gcmVxdWlyZWQgKHZhbCkge1xuICAgICAgcmV0dXJuIHZhbC5sZW5ndGggPiAwO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1pbiAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gbWluICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwgPj0gbWluO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1heCAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gbWF4ICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwgPD0gbWF4O1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1pbmxlbmd0aCAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gbWlubGVuZ3RoICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwubGVuZ3RoID49IG1pbmxlbmd0aDtcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChtYXhsZW5ndGggIT09IG51bGwpIHtcbiAgICBydWxlcy5wdXNoKGZ1bmN0aW9uIG1heGxlbmd0aCAodmFsKSB7XG4gICAgICByZXR1cm4gdmFsLmxlbmd0aCA8PSBtYXhsZW5ndGg7XG4gICAgfSk7XG4gIH1cblxuICBpZiAocGF0dGVybiAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gcGF0dGVybiAodmFsKSB7XG4gICAgICByZXR1cm4gdmFsLm1hdGNoKG5ldyBSZWdFeHAocGF0dGVybikpO1xuICAgIH0pO1xuICB9XG5cbiAgcmV0dXJuIHJ1bGVzO1xufTtcblxuUHJvdG8uaXNWYWxpZCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHZhbCA9IHRoaXMuZWwudmFsdWUudHJpbSgpO1xuICAvLyBHZXQgdmFsaWRhdGlvbiBydWxlcyBpcyBhbHdheXMgY2FsbGVkIHRvIGFsbG93IGNoYW5naW5nIG9mIHByb3BlcnRpZXNcbiAgdmFyIHJ1bGVzID0gdGhpcy5nZXRWYWxpZGF0aW9uUnVsZXMoKTtcbiAgdmFyIGlzVmFsaWQgPSB0cnVlO1xuXG4gIGlmICh0aGlzLmVsLmdldEF0dHJpYnV0ZSgndHlwZScpID09PSAnZW1haWwnKSB7XG4gICAgaXNWYWxpZCA9ICh2YWwuaW5kZXhPZignQCcpID4gMCkgJiYgdmFsLmxlbmd0aCA+IDI7XG4gIH1cblxuICBmb3IgKHZhciBpID0gMDsgaSA8IHJ1bGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgaXNWYWxpZCA9IHJ1bGVzW2ldKHZhbCkgJiYgaXNWYWxpZDtcbiAgICBpZiAoIWlzVmFsaWQpIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHJldHVybiBpc1ZhbGlkO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZWZ1bFRleHRJbnB1dDtcbiIsInZhciBTdGF0ZWZ1bE9iamVjdCA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtb2JqZWN0Jyk7XG52YXIgU3RhdGVmdWxUZXh0SW5wdXQgPSByZXF1aXJlKCcuL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtdGV4dC1pbnB1dCcpO1xudmFyIFN0YXRlZnVsU2VsZWN0ID0gcmVxdWlyZSgnLi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXNlbGVjdCcpO1xudmFyIFN0YXRlZnVsQ2hlY2tib3ggPSByZXF1aXJlKCcuL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtY2hlY2tib3gnKTtcblxuZnVuY3Rpb24gU3RhdGVmdWxGb3JtIChlbCkge1xuICB0aGlzLmVsID0gZWw7XG4gIHRoaXMuaW5pdCgpO1xuICBTdGF0ZWZ1bE9iamVjdC5jYWxsKHRoaXMpO1xuICB0aGlzLmJpbmRFdmVudHMoKTtcbn1cblxudmFyIFByb3RvID0gU3RhdGVmdWxGb3JtLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxPYmplY3QucHJvdG90eXBlKTtcblxuLyoqXG4gKiBIYW5kbGUgc3RhdGUgY2hhbmdlcyBieSBmb3JtIGVsZW1lbnRzXG4gKi9cblByb3RvLmhhbmRsZUZvcm1FbGVtZW50U3RhdGVDaGFuZ2UgPSBmdW5jdGlvbiAoc3RhdGUsIHBhcnRpYWxTdGF0ZSwga2V5KSB7XG4gIHZhciBuZXdTdGF0ZSA9IHt9O1xuICBuZXdTdGF0ZVtrZXldID0gc3RhdGU7XG4gIHRoaXMuc2V0U3RhdGUobmV3U3RhdGUsIGtleSk7XG59O1xuXG5Qcm90by5zZXRGb3JtU3RhdGUgPSBmdW5jdGlvbiAobmV3U3RhdGUpIHtcbiAgdGhpcy5zZXRTdGF0ZSh7IGZvcm06IE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RhdGUuZm9ybSwgbmV3U3RhdGUpIH0sICdmb3JtJyk7XG59O1xuXG5Qcm90by5jb21wdXRlZFN0YXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gIHZhciBpc1ZhbGlkID0gdHJ1ZTtcbiAgdmFyIGlzUHJpc3RpbmUgPSBzdGF0ZS5mb3JtLnByaXN0aW5lO1xuICB2YXIgaXNUb3VjaGVkID0gc3RhdGUuZm9ybS50b3VjaGVkO1xuXG4gIE9iamVjdC5rZXlzKHN0YXRlKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAoa2V5ID09PSAnZm9ybScpIHJldHVybjtcbiAgICBpZiAoa2V5ID09PSAncmVxdWVzdCcpIHJldHVybjtcbiAgICBpZiAoa2V5ID09PSAncmVzcG9uc2UnKSByZXR1cm47XG5cbiAgICB2YXIgcHJvcCA9IHN0YXRlW2tleV07XG5cbiAgICBpZiAoaXNWYWxpZCAmJiBwcm9wLmhhc093blByb3BlcnR5KCd2YWxpZCcpKSB7XG4gICAgICBpc1ZhbGlkID0gcHJvcC52YWxpZDtcbiAgICB9XG5cbiAgICBpZiAoaXNQcmlzdGluZSAmJiBwcm9wLmhhc093blByb3BlcnR5KCdwcmlzdGluZScpKSB7XG4gICAgICBpc1ByaXN0aW5lID0gcHJvcC5wcmlzdGluZTtcbiAgICB9XG5cbiAgICBpZiAocHJvcC5oYXNPd25Qcm9wZXJ0eSgndG91Y2hlZCcpKSB7XG4gICAgICBpc1RvdWNoZWQgPSBpc1RvdWNoZWQgfHwgcHJvcC50b3VjaGVkO1xuICAgIH1cbiAgfSk7XG5cbiAgT2JqZWN0LmFzc2lnbihzdGF0ZS5mb3JtLCB7XG4gICAgdmFsaWQ6IGlzVmFsaWQsXG4gICAgcHJpc3RpbmU6IGlzUHJpc3RpbmUsXG4gICAgdG91Y2hlZDogaXNUb3VjaGVkLFxuICAgIGludmFsaWQ6ICFpc1ZhbGlkLFxuICAgIGRpcnR5OiAhaXNQcmlzdGluZSxcbiAgICB1bnRvdWNoZWQ6ICFpc1RvdWNoZWRcbiAgfSk7XG5cbiAgcmV0dXJuIHN0YXRlO1xufTtcblxuUHJvdG8uaW5pdCA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5mb3JtRWxlbWVudHMgPSBbXTtcblxuICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHRoaXMuZWwuZWxlbWVudHMsIGZ1bmN0aW9uIChmaWVsZCkge1xuICAgIHZhciBuYW1lID0gZmllbGQubmFtZTtcbiAgICB2YXIgdHlwZSA9IGZpZWxkLnR5cGU7XG5cbiAgICBpZiAoIW5hbWUpIHJldHVybjtcbiAgICBpZiAoZmllbGQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PSAnZmllbGRzZXQnKSByZXR1cm47XG4gICAgaWYgKHR5cGUgPT0gJ3N1Ym1pdCcpIHJldHVybjtcbiAgICBpZiAodHlwZSA9PSAncmVzZXQnKSByZXR1cm47XG4gICAgaWYgKHR5cGUgPT0gJ2J1dHRvbicpIHJldHVybjtcbiAgICBpZiAodHlwZSA9PSAnZmlsZScpIHJldHVybjtcblxuICAgIHZhciBmb3JtRWxlbWVudCA9IGNyZWF0ZVN0YXRlZnVsRm9ybUVsZW1lbnQoZmllbGQpO1xuICAgIGlmIChmb3JtRWxlbWVudCAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICB0aGlzLmZvcm1FbGVtZW50cy5wdXNoKGZvcm1FbGVtZW50KTtcbiAgICB9XG4gIH0uYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by5nZXREZWZhdWx0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHt9O1xuICB2YXIgaXNWYWxpZCA9IHRydWU7XG5cbiAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCh0aGlzLmZvcm1FbGVtZW50cywgZnVuY3Rpb24gKGZvcm1FbGVtZW50KSB7XG4gICAgZm9ybUVsZW1lbnQub25TdGF0ZUNoYW5nZSh0aGlzLmhhbmRsZUZvcm1FbGVtZW50U3RhdGVDaGFuZ2UuYmluZCh0aGlzKSk7XG4gICAgc3RhdGVbZm9ybUVsZW1lbnQubmFtZV0gPSBmb3JtRWxlbWVudC5zdGF0ZTtcbiAgICBpc1ZhbGlkID0gZm9ybUVsZW1lbnQuc3RhdGUudmFsaWQgJiYgaXNWYWxpZDtcbiAgfS5iaW5kKHRoaXMpKTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbih7XG4gICAgZm9ybToge1xuICAgICAgc3VibWl0dGVkOiBmYWxzZSxcbiAgICAgIHByaXN0aW5lOiB0cnVlLFxuICAgICAgdmFsaWQ6IGlzVmFsaWRcbiAgICB9XG4gIH0sIHN0YXRlKTtcbn07XG5cblByb3RvLmJpbmRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgZnVuY3Rpb24gKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgdGhpcy5zdWJtaXQoKTtcbiAgfS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLnN1Ym1pdCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGFjdGlvbiA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdhY3Rpb24nKTtcbiAgdGhpcy5zZXRGb3JtU3RhdGUoeyBzdWJtaXR0ZWQ6IHRydWUgfSk7XG5cblxuICBjb25zb2xlLmxvZyh0aGlzLnN0YXRlKTtcbiAgaWYgKHRoaXMuc3RhdGUuZm9ybS5pbnZhbGlkKSByZXR1cm47XG5cbiAgdmFyIHJlcXVlc3QgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcbiAgcmVxdWVzdC5vcGVuKCdQT1NUJywgYWN0aW9uLCB0cnVlKTtcbiAgcmVxdWVzdC5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24veC13d3ctZm9ybS11cmxlbmNvZGVkOyBjaGFyc2V0PVVURi04Jyk7XG5cbiAgcmVxdWVzdC5vbmxvYWQgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHJlcXVlc3Quc3RhdHVzID49IDIwMCAmJiByZXF1ZXN0LnN0YXR1cyA8IDQwMCkge1xuICAgICAgdGhpcy5zZXRTdGF0ZSh7XG4gICAgICAgIHJlcXVlc3Q6IHtcbiAgICAgICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgICAgIGZhaWxlZDogZmFsc2UsXG4gICAgICAgICAgc3RhdHVzOiByZXF1ZXN0LnN0YXR1c1xuICAgICAgICB9LFxuICAgICAgICByZXNwb25zZToge1xuICAgICAgICAgIGpzb246IEpTT04ucGFyc2UocmVxdWVzdC5yZXNwb25zZVRleHQpLFxuICAgICAgICAgIHRleHQ6IHJlcXVlc3QucmVzcG9uc2VUZXh0XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldFN0YXRlKHtcbiAgICAgICAgcmVxdWVzdDoge1xuICAgICAgICAgIHN1Y2Nlc3M6IGZhbHNlLFxuICAgICAgICAgIGZhaWxlZDogdHJ1ZSxcbiAgICAgICAgICBzdGF0dXM6IHJlcXVlc3Quc3RhdHVzXG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgICAgLy8gV2UgcmVhY2hlZCBvdXIgdGFyZ2V0IHNlcnZlciwgYnV0IGl0IHJldHVybmVkIGFuIGVycm9yXG4gICAgICBjb25zb2xlLmxvZygnZXJyb3InKTtcbiAgICB9XG4gIH0uYmluZCh0aGlzKTtcblxuICByZXF1ZXN0Lm9uZXJyb3IgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBUaGVyZSB3YXMgYSBjb25uZWN0aW9uIGVycm9yIG9mIHNvbWUgc29ydFxuICAgIGNvbnNvbGUubG9nKCdlcnJvcicpO1xuICB9O1xuXG4gIHJlcXVlc3Quc2VuZCh0aGlzLnN0YXRlKTtcbn07XG5cblxuLy8gUHJpdmF0ZVxuXG5mdW5jdGlvbiBjcmVhdGVTdGF0ZWZ1bEZvcm1FbGVtZW50IChmaWVsZCkge1xuICBzd2l0Y2ggKGZpZWxkLnR5cGUpIHtcbiAgICBjYXNlICd0ZXh0YXJlYSc6IHJldHVybiBuZXcgU3RhdGVmdWxUZXh0SW5wdXQoZmllbGQpO1xuICAgIGNhc2UgJ3RleHQnOiByZXR1cm4gbmV3IFN0YXRlZnVsVGV4dElucHV0KGZpZWxkKTtcbiAgICBjYXNlICdlbWFpbCc6IHJldHVybiBuZXcgU3RhdGVmdWxUZXh0SW5wdXQoZmllbGQpO1xuICAgIGNhc2UgJ2NoZWNrYm94JzogcmV0dXJuIG5ldyBTdGF0ZWZ1bENoZWNrYm94KGZpZWxkKTtcbiAgICBkZWZhdWx0OlxuICAgICAgaWYgKGZpZWxkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzZWxlY3QnKSB7XG4gICAgICAgIHJldHVybiBuZXcgU3RhdGVmdWxTZWxlY3QoZmllbGQpO1xuICAgICAgfVxuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVmdWxGb3JtO1xuIiwiZnVuY3Rpb24gU3RhdGVmdWxPYmplY3QgKCkge1xuICB0aGlzLmxpc3RlbmVycyA9IFtdO1xuICB0aGlzLnNldFN0YXRlKHRoaXMuZ2V0RGVmYXVsdFN0YXRlKCkpO1xufVxuXG52YXIgUHJvdG8gPSBTdGF0ZWZ1bE9iamVjdC5wcm90b3R5cGU7XG5cblByb3RvLm9uU3RhdGVDaGFuZ2UgPSBmdW5jdGlvbiAobGlzdGVuZXIpIHtcbiAgdGhpcy5saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG4gIHJldHVybiB0aGlzO1xufTtcblxuUHJvdG8udHJpZ2dlclN0YXRlQ2hhbmdlID0gZnVuY3Rpb24gKHBhcnRpYWxOZXdTdGF0ZSwga2V5KSB7XG4gIHRoaXMubGlzdGVuZXJzLmZvckVhY2goZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG4gICAgbGlzdGVuZXIodGhpcy5zdGF0ZSwgcGFydGlhbE5ld1N0YXRlLCBrZXksIHRoaXMpO1xuICB9LmJpbmQodGhpcykpO1xuICByZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQHBhcmFtIHtPYmplY3R9IHBhcnRpYWxOZXdTdGF0ZVxuICogQHBhcmFtIHs/U3RyaW5nfSBrZXlcbiAqL1xuUHJvdG8uc2V0U3RhdGUgPSBmdW5jdGlvbiAocGFydGlhbE5ld1N0YXRlLCBrZXkpIHtcbiAgdmFyIG5hbWUgPSBrZXkgfHwgdGhpcy5uYW1lO1xuICB2YXIgb2xkU3RhdGUgPSB0aGlzLnN0YXRlIHx8IHt9O1xuICB0aGlzLnN0YXRlID0gdGhpcy5jb21wdXRlZFN0YXRlKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RhdGUsIHBhcnRpYWxOZXdTdGF0ZSkpO1xuICBpZiAoSlNPTi5zdHJpbmdpZnkob2xkU3RhdGVba2V5XSkgIT09IEpTT04uc3RyaW5naWZ5KHBhcnRpYWxOZXdTdGF0ZSkpIHtcbiAgICB0aGlzLnRyaWdnZXJTdGF0ZUNoYW5nZShwYXJ0aWFsTmV3U3RhdGUsIG5hbWUpO1xuICB9XG4gIHJldHVybiB0aGlzO1xufTtcblxuUHJvdG8uY29tcHV0ZWRTdGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICByZXR1cm4gc3RhdGU7XG59O1xuXG5Qcm90by5nZXREZWZhdWx0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHJldHVybiB7fTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVmdWxPYmplY3Q7XG4iLCIvLyBJRTgrXG5mdW5jdGlvbiByZW1vdmVDbGFzcyAoZWwsIGNsYXNzTmFtZSkge1xuICBpZiAoZWwuY2xhc3NMaXN0KSB7XG4gICAgZWwuY2xhc3NMaXN0LnJlbW92ZShjbGFzc05hbWUpO1xuICB9IGVsc2Uge1xuICAgIGVsLmNsYXNzTmFtZSA9IGVsLmNsYXNzTmFtZS5yZXBsYWNlKG5ldyBSZWdFeHAoJyhefFxcXFxiKScgKyBjbGFzc05hbWUuc3BsaXQoJyAnKS5qb2luKCd8JykgKyAnKFxcXFxifCQpJywgJ2dpJyksICcgJyk7XG4gIH1cbn1cblxuLy8gSUU4K1xuZnVuY3Rpb24gYWRkQ2xhc3MgKGVsLCBjbGFzc05hbWUpIHtcbiAgaWYgKGVsLmNsYXNzTGlzdCkge1xuICAgIGVsLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5jbGFzc05hbWUgKz0gJyAnICsgY2xhc3NOYW1lO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUNsYXNzIChlbCwgY2xhc3NOYW1lLCBpc0FwcGxpZWQpIHtcbiAgaWYgKGlzQXBwbGllZCkge1xuICAgIGFkZENsYXNzKGVsLCBjbGFzc05hbWUpO1xuICB9IGVsc2Uge1xuICAgIHJlbW92ZUNsYXNzKGVsLCBjbGFzc05hbWUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUF0dHJpYnV0ZSAoZWwsIGF0dHJOYW1lLCBpc0FwcGxpZWQpIHtcbiAgaWYgKGlzQXBwbGllZCkge1xuICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0ck5hbWUpO1xuICB9IGVsc2Uge1xuICAgIGVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIHRvZ2dsZUNsYXNzOiB0b2dnbGVDbGFzcyxcbiAgcmVtb3ZlQ2xhc3M6IHJlbW92ZUNsYXNzLFxuICBhZGRDbGFzczogYWRkQ2xhc3MsXG4gIHRvZ2dsZUF0dHJpYnV0ZTogdG9nZ2xlQXR0cmlidXRlXG59O1xuIiwiLy8gU29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBPYmplY3QuY3JlYXRlXG5pZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICd1bmRlZmluZWQnKSB7XG5cdE9iamVjdC5jcmVhdGUgPSBmdW5jdGlvbihwcm90b3R5cGUpIHtcblx0XHRmdW5jdGlvbiBDKCkge31cblx0XHRDLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcblx0XHRyZXR1cm4gbmV3IEMoKTtcblx0fVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuLyoqXG4gKiBTdGF0ZWZ1bCBmb3Jtc1xuICogLS0tXG4gKiBBdXRob3I6IEplcm9lbiBSYW5zaWpuXG4gKiBMaWNlbnNlOiBNSVRcbiAqL1xucmVxdWlyZSgnLi9wb2x5ZmlsbHMvb2JqZWN0LWNyZWF0ZScpO1xudmFyIFN0YXRlZnVsRm9ybSA9IHJlcXVpcmUoJy4vbGliL3N0YXRlZnVsLWZvcm0nKTtcbnZhciBEaXJlY3RpdmVzTWFuYWdlciA9IHJlcXVpcmUoJy4vbGliL2RpcmVjdGl2ZXMvZGlyZWN0aXZlcy1tYW5hZ2VyJyk7XG5cbmdsb2JhbC5jcmVhdGVTdGF0ZWZ1bEZvcm1zID0gZnVuY3Rpb24gY3JlYXRlU3RhdGVmdWxGb3JtcyAoKSB7XG4gIHZhciBmb3JtcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoJ2Zvcm1bc3RhdGVmdWxdJyk7XG5cbiAgLy8gSUU5KyBOb2RlTGlzdCBpdGVyYXRpb25cbiAgcmV0dXJuIEFycmF5LnByb3RvdHlwZS5tYXAuY2FsbChmb3JtcywgZnVuY3Rpb24gKGZvcm0pIHtcbiAgICB2YXIgbWFuYWdlciA9IG5ldyBEaXJlY3RpdmVzTWFuYWdlcihmb3JtKTtcbiAgICByZXR1cm4gbmV3IFN0YXRlZnVsRm9ybShmb3JtKS5vblN0YXRlQ2hhbmdlKGZ1bmN0aW9uIChzdGF0ZSwgcGFydGlhbFN0YXRlLCBrZXkpIHtcbiAgICAgIC8vIGNvbnNvbGUubG9nKCdmb3JtOnN0YXRlQ2hhbmdlJywga2V5LCBzdGF0ZSk7XG4gICAgICBpZiAoa2V5KSB7XG4gICAgICAgIG1hbmFnZXIucGF0Y2goa2V5LCBzdGF0ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBtYW5hZ2VyLnVwZGF0ZShzdGF0ZSk7XG4gICAgICB9XG4gICAgfSkudHJpZ2dlclN0YXRlQ2hhbmdlKCk7XG4gIH0pO1xufVxuIl19

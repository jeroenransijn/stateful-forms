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

      console.log('directive', directive);
      console.log('directive.getNames()', directive.getNames());

      directive.getNames().forEach(function (name) {
        this.patchIndex[name] = this.patchIndex[name] || [];
        this.patchIndex[name].push(directive);
      }.bind(this));
    }.bind(this));

    console.log(this.patchIndex);
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

  // Premature optimizations ;)
  registerAccessMemberName: function (name) {
    if (this.accessMemberNames.indexOf(name) === -1) {
      this.accessMemberNames.push(name);
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
  for (var prop in state) {
    if (state.hasOwnProperty(prop) && prop !== 'form') {
      state.form.pristine = state[prop].pristine && state.form.pristine;
      state.form.valid = state[prop].valid && state.form.valid;
      state.form.touched = state[prop].touched && state.form.touched;
    }
  }

  Object.assign(state.form, {
    invalid: !state.form.valid,
    dirty: !state.form.pristine,
    untouched: !state.form.touched
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
  doRequest(action, this.serialize());
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

function doRequest (action, data) {
  var request = new XMLHttpRequest();
  request.open('POST', action, true);
  request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
  request.send(data);
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

},{"./lib/directives/directives-manager":1,"./lib/stateful-form":10,"./polyfills/object-create":13}]},{},[14])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbGliL2RpcmVjdGl2ZXMvZGlyZWN0aXZlcy1tYW5hZ2VyLmpzIiwic3JjL2xpYi9kaXJlY3RpdmVzL2RpcmVjdGl2ZXMuanMiLCJzcmMvbGliL2V4cHJlc3Npb25zL2FzdC5qcyIsInNyYy9saWIvZXhwcmVzc2lvbnMvbGV4ZXIuanMiLCJzcmMvbGliL2V4cHJlc3Npb25zL3BhcnNlci5qcyIsInNyYy9saWIvZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1jaGVja2JveC5qcyIsInNyYy9saWIvZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1mb3JtLWVsZW1lbnQuanMiLCJzcmMvbGliL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtc2VsZWN0LmpzIiwic3JjL2xpYi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXRleHQtaW5wdXQuanMiLCJzcmMvbGliL3N0YXRlZnVsLWZvcm0uanMiLCJzcmMvbGliL3N0YXRlZnVsLW9iamVjdC5qcyIsInNyYy9saWIvdXRpbHMuanMiLCJzcmMvcG9seWZpbGxzL29iamVjdC1jcmVhdGUuanMiLCJzcmMvc3RhdGVmdWwtZm9ybXMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3ZEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNySUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDOWNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNqVEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM1QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciBEaXJlY3RpdmVzID0gcmVxdWlyZSgnLi9kaXJlY3RpdmVzJyk7XG5cbmZ1bmN0aW9uIERpcmVjdGl2ZXNNYW5hZ2VyIChlbCkge1xuICB0aGlzLmVsID0gZWw7XG4gIHRoaXMuZGlyZWN0aXZlcyA9IHt9O1xuICB0aGlzLnBhdGNoSW5kZXggPSB7fTtcblxuICB0aGlzLnF1ZXJ5TWFwKERpcmVjdGl2ZXMuU2hvd0RpcmVjdGl2ZSk7XG4gIHRoaXMucXVlcnlNYXAoRGlyZWN0aXZlcy5UZXh0RGlyZWN0aXZlKTtcbiAgdGhpcy5xdWVyeU1hcChEaXJlY3RpdmVzLkNsYXNzRGlyZWN0aXZlKTtcbiAgdGhpcy5xdWVyeU1hcChEaXJlY3RpdmVzLkF0dHJpYnV0ZXNEaXJlY3RpdmUpO1xufVxuXG52YXIgUHJvdG8gPSBEaXJlY3RpdmVzTWFuYWdlci5wcm90b3R5cGU7XG5cblByb3RvLnF1ZXJ5TWFwID0gZnVuY3Rpb24gKGNscykge1xuICB2YXIgYXR0ciA9IGNscy5wcm90b3R5cGUuYXR0cmlidXRlO1xuICBBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKFxuICAgIHRoaXMuZWwucXVlcnlTZWxlY3RvckFsbCgnWycgKyBhdHRyICsgJ10nKSwgZnVuY3Rpb24gKGVsKSB7XG4gICAgICB2YXIgZGlyZWN0aXZlID0gbmV3IGNscyhlbCk7XG5cbiAgICAgIHRoaXMuZGlyZWN0aXZlc1thdHRyXSA9IHRoaXMuZGlyZWN0aXZlc1thdHRyXSB8fCBbXTtcbiAgICAgIHRoaXMuZGlyZWN0aXZlc1thdHRyXS5wdXNoKGRpcmVjdGl2ZSk7XG5cbiAgICAgIGNvbnNvbGUubG9nKCdkaXJlY3RpdmUnLCBkaXJlY3RpdmUpO1xuICAgICAgY29uc29sZS5sb2coJ2RpcmVjdGl2ZS5nZXROYW1lcygpJywgZGlyZWN0aXZlLmdldE5hbWVzKCkpO1xuXG4gICAgICBkaXJlY3RpdmUuZ2V0TmFtZXMoKS5mb3JFYWNoKGZ1bmN0aW9uIChuYW1lKSB7XG4gICAgICAgIHRoaXMucGF0Y2hJbmRleFtuYW1lXSA9IHRoaXMucGF0Y2hJbmRleFtuYW1lXSB8fCBbXTtcbiAgICAgICAgdGhpcy5wYXRjaEluZGV4W25hbWVdLnB1c2goZGlyZWN0aXZlKTtcbiAgICAgIH0uYmluZCh0aGlzKSk7XG4gICAgfS5iaW5kKHRoaXMpKTtcblxuICAgIGNvbnNvbGUubG9nKHRoaXMucGF0Y2hJbmRleCk7XG59O1xuXG5Qcm90by5wYXRjaCA9IGZ1bmN0aW9uIChrZXksIHN0YXRlKSB7XG4gIC8vIGNvbnNvbGUubG9nKCdwYXRjaCcsIGtleSwgc3RhdGUpO1xuICBpZiAodGhpcy5wYXRjaEluZGV4Lmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICB0aGlzLnBhdGNoSW5kZXhba2V5XS5mb3JFYWNoKGZ1bmN0aW9uIChkaXJlY3RpdmUpIHtcbiAgICAgIGRpcmVjdGl2ZS51cGRhdGUoc3RhdGUpO1xuICAgIH0pO1xuICB9XG59O1xuXG5Qcm90by51cGRhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgLy8gY29uc29sZS5sb2coJ3VwZGF0ZScsIHRoaXMuZGlyZWN0aXZlcyk7XG4gIE9iamVjdC5rZXlzKHRoaXMuZGlyZWN0aXZlcykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgdGhpcy5kaXJlY3RpdmVzW2tleV0uZm9yRWFjaChmdW5jdGlvbiAoZGlyZWN0aXZlKSB7XG4gICAgICBkaXJlY3RpdmUudXBkYXRlKHN0YXRlKTtcbiAgICB9KTtcbiAgfS5iaW5kKHRoaXMpKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gRGlyZWN0aXZlc01hbmFnZXI7XG4iLCJ2YXIgUGFyc2VyID0gcmVxdWlyZSgnLi4vZXhwcmVzc2lvbnMvcGFyc2VyJykuUGFyc2VyO1xudmFyIHV0aWxzID0gcmVxdWlyZSgnLi4vdXRpbHMnKTtcblxuLy8gVXNlIG9uZSBwYXJzZXIgYWNyb3NzIGRpcmVjdGl2ZXMgdG8gbWFrZSB1c2Ugb2YgdGhlIGNhY2hlXG52YXIgcGFyc2VyID0gbmV3IFBhcnNlcigpO1xucGFyc2VyLnBhcnNlID0gcGFyc2VyLnBhcnNlLmJpbmQocGFyc2VyKTtcbnBhcnNlci5wYXJzZU9iamVjdCA9IHBhcnNlci5wYXJzZU9iamVjdC5iaW5kKHBhcnNlcik7XG5cbmZ1bmN0aW9uIERpcmVjdGl2ZSAoZWwpIHtcbiAgdGhpcy5lbCA9IGVsO1xuICB0aGlzLmF0dHJpYnV0ZVZhbHVlID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUodGhpcy5hdHRyaWJ1dGUpO1xuICB0aGlzLmV4cHJlc3Npb24gPSB0aGlzLnBhcnNlKHRoaXMuYXR0cmlidXRlVmFsdWUpO1xuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtBcnJheVtTdHJpbmddfSBuYW1lcyBvZiBhY2Nlc3MgbWVtYmVyc1xuICAgKi9cbiAgdGhpcy5nZXROYW1lcyA9IGZ1bmN0aW9uICgpIHtcbiAgICByZXR1cm4gdGhpcy5leHByZXNzaW9uLmFjY2Vzc1Njb3BlTmFtZXM7XG4gIH1cbn1cblxuZnVuY3Rpb24gT2JqZWN0RGlyZWN0aXZlICgpIHtcbiAgdGhpcy5wYXJzZSA9IHBhcnNlci5wYXJzZU9iamVjdDtcbiAgRGlyZWN0aXZlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG5cbiAgdGhpcy51cGRhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgICB2YXIgbWF0Y2hlZE9iamVjdCA9IHRoaXMuZXhwcmVzc2lvbi5ldmFsKHN0YXRlKTtcblxuICAgIE9iamVjdC5rZXlzKG1hdGNoZWRPYmplY3QpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuICAgICAgdGhpcy50b2dnbGVNZXRob2QodGhpcy5lbCwga2V5LCBtYXRjaGVkT2JqZWN0W2tleV0pO1xuICAgIH0uYmluZCh0aGlzKSk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIEF0dHJpYnV0ZXNEaXJlY3RpdmUgKCkge1xuICB0aGlzLnRvZ2dsZU1ldGhvZCA9IHV0aWxzLnRvZ2dsZUF0dHJpYnV0ZTtcbiAgT2JqZWN0RGlyZWN0aXZlLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5BdHRyaWJ1dGVzRGlyZWN0aXZlLnByb3RvdHlwZS5hdHRyaWJ1dGUgPSAnc2YtYXR0cmlidXRlcyc7XG5cbmZ1bmN0aW9uIENsYXNzRGlyZWN0aXZlICgpIHtcbiAgdGhpcy50b2dnbGVNZXRob2QgPSB1dGlzLnRvZ2dsZUNsYXNzO1xuICBPYmplY3REaXJlY3RpdmUuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cbk9iamVjdERpcmVjdGl2ZS5wcm90b3R5cGUuYXR0cmlidXRlID0gJ3NmLWNsYXNzJztcblxuZnVuY3Rpb24gU2hvd0RpcmVjdGl2ZSAoKSB7XG4gIHRoaXMucGFyc2UgPSBwYXJzZXIucGFyc2U7XG4gIERpcmVjdGl2ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gIHRoaXMudXBkYXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgaWYgKCEhdGhpcy5leHByZXNzaW9uLmV2YWwoc3RhdGUpKSB7XG4gICAgICB0aGlzLmVsLnN0eWxlLmRpc3BsYXkgPSAnJztcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5lbC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuICAgIH1cbiAgfTtcbn1cblNob3dEaXJlY3RpdmUucHJvdG90eXBlLmF0dHJpYnV0ZSA9ICdzZi1zaG93JztcblxuZnVuY3Rpb24gVGV4dERpcmVjdGl2ZSAoKSB7XG4gIHRoaXMucGFyc2UgPSBwYXJzZXIucGFyc2U7XG4gIERpcmVjdGl2ZS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuXG4gIHRoaXMudXBkYXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG4gICAgdGhpcy5lbC5pbm5lckhUTUwgPSB0aGlzLmV4cHJlc3Npb24uZXZhbChzdGF0ZSk7XG4gIH1cbn1cblRleHREaXJlY3RpdmUucHJvdG90eXBlLmF0dHJpYnV0ZSA9ICdzZi10ZXh0JztcblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIERpcmVjdGl2ZTogRGlyZWN0aXZlLFxuICBPYmplY3REaXJlY3RpdmU6IE9iamVjdERpcmVjdGl2ZSxcbiAgQXR0cmlidXRlc0RpcmVjdGl2ZTogQXR0cmlidXRlc0RpcmVjdGl2ZSxcbiAgQ2xhc3NEaXJlY3RpdmU6IENsYXNzRGlyZWN0aXZlLFxuICBTaG93RGlyZWN0aXZlOiBTaG93RGlyZWN0aXZlLFxuICBUZXh0RGlyZWN0aXZlOiBUZXh0RGlyZWN0aXZlLFxufTtcbiIsIi8qKlxuICogQHBhcmFtIHtTdHJpbmd9IG9wZXJhdGlvblxuICogQHBhcmFtIHtFeHByZXNzaW9ufSBsZWZ0RXhwXG4gKiBAcGFyYW0ge0V4cHJlc3Npb259IHJpZ2h0RXhwXG4gKi9cbmZ1bmN0aW9uIEJpbmFyeSAob3BlcmF0aW9uLCBsZWZ0RXhwLCByaWdodEV4cCkge1xuICB0aGlzLmV2YWwgPSBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICB2YXIgbGVmdCA9IGxlZnRFeHAuZXZhbChzY29wZSk7XG5cbiAgICBzd2l0Y2ggKG9wZXJhdGlvbikge1xuICAgICAgY2FzZSAnJiYnOiByZXR1cm4gISFsZWZ0ICYmICEhcmlnaHRFeHAuZXZhbChzY29wZSk7XG4gICAgICBjYXNlICd8fCc6IHJldHVybiAhIWxlZnQgfHwgISFyaWdodEV4cC5ldmFsKHNjb3BlKTtcbiAgICB9XG5cbiAgICB2YXIgcmlnaHQgPSByaWdodEV4cC5ldmFsKHNjb3BlKTtcblxuICAgIC8vIE51bGwgY2hlY2sgZm9yIHRoZSBvcGVyYXRpb25zLlxuICAgIGlmIChsZWZ0ID09IG51bGwgfHwgcmlnaHQgPT0gbnVsbCkge1xuICAgICAgc3dpdGNoIChvcGVyYXRpb24pIHtcbiAgICAgICAgY2FzZSAnKyc6XG4gICAgICAgICAgaWYgKGxlZnQgIT0gbnVsbCkgcmV0dXJuIGxlZnQ7XG4gICAgICAgICAgaWYgKHJpZ2h0ICE9IG51bGwpIHJldHVybiByaWdodDtcbiAgICAgICAgICByZXR1cm4gMDtcbiAgICAgICAgY2FzZSAnLSc6XG4gICAgICAgICAgaWYgKGxlZnQgIT0gbnVsbCkgcmV0dXJuIGxlZnQ7XG4gICAgICAgICAgaWYgKHJpZ2h0ICE9IG51bGwpIHJldHVybiAwIC0gcmlnaHQ7XG4gICAgICAgICAgcmV0dXJuIDA7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBudWxsO1xuICAgIH1cblxuICAgIHN3aXRjaCAob3BlcmF0aW9uKSB7XG4gICAgICBjYXNlICcrJyAgOiByZXR1cm4gYXV0b0NvbnZlcnRBZGQobGVmdCwgcmlnaHQpO1xuICAgICAgY2FzZSAnLScgIDogcmV0dXJuIGxlZnQgLSByaWdodDtcbiAgICAgIGNhc2UgJyonICA6IHJldHVybiBsZWZ0ICogcmlnaHQ7XG4gICAgICBjYXNlICcvJyAgOiByZXR1cm4gbGVmdCAvIHJpZ2h0O1xuICAgICAgY2FzZSAnfi8nIDogcmV0dXJuIE1hdGguZmxvb3IobGVmdCAvIHJpZ2h0KTtcbiAgICAgIGNhc2UgJyUnICA6IHJldHVybiBsZWZ0ICUgcmlnaHQ7XG4gICAgICBjYXNlICc9PScgOiByZXR1cm4gbGVmdCA9PSByaWdodDtcbiAgICAgIGNhc2UgJyE9JyA6IHJldHVybiBsZWZ0ICE9IHJpZ2h0O1xuICAgICAgY2FzZSAnPCcgIDogcmV0dXJuIGxlZnQgPCByaWdodDtcbiAgICAgIGNhc2UgJz4nICA6IHJldHVybiBsZWZ0ID4gcmlnaHQ7XG4gICAgICBjYXNlICc8PScgOiByZXR1cm4gbGVmdCA8PSByaWdodDtcbiAgICAgIGNhc2UgJz49JyA6IHJldHVybiBsZWZ0ID49IHJpZ2h0O1xuICAgICAgY2FzZSAnXicgIDogcmV0dXJuIGxlZnQgXiByaWdodDtcbiAgICAgIGNhc2UgJyYnICA6IHJldHVybiBsZWZ0ICYgcmlnaHQ7XG4gICAgfVxuXG4gICAgdGhyb3cgbmV3IEVycm9yKCdJbnRlcm5hbCBlcnJvciBbJyArIG9wZXJhdGlvbiArICddIG5vdCBoYW5kbGVkJyk7XG4gIH07XG59XG5cbi8qKlxuICogQHBhcmFtIHtFeHByZXNzaW9ufSBvYmplY3RcbiAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gKi9cbmZ1bmN0aW9uIEFjY2Vzc01lbWJlciAob2JqZWN0LCBuYW1lKSB7XG4gIHRoaXMuZXZhbCA9IGZ1bmN0aW9uIChzY29wZSkge1xuICAgIHZhciBpbnN0YW5jZSA9IG9iamVjdC5ldmFsKHNjb3BlKTtcbiAgICByZXR1cm4gaW5zdGFuY2UgPT0gbnVsbCA/IG51bGwgOiBpbnN0YW5jZVtuYW1lXTtcbiAgfTtcbn1cblxuLyoqXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICovXG5mdW5jdGlvbiBBY2Nlc3NTY29wZSAobmFtZSkge1xuICB0aGlzLmV2YWwgPSBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICByZXR1cm4gc2NvcGVbbmFtZV07XG4gIH07XG59XG5cbi8qKlxuICogQHBhcmFtIHtTdHJpbmd9IG9wZXJhdGlvblxuICogQHBhcmFtIHtFeHByZXNzaW9ufSBleHByZXNzaW9uXG4gKi9cbmZ1bmN0aW9uIFByZWZpeE5vdCAob3BlcmF0aW9uLCBleHByZXNzaW9uKSB7XG4gIHRoaXMuZXZhbCA9IGZ1bmN0aW9uIChzY29wZSkge1xuICAgIHJldHVybiAhZXhwcmVzc2lvbi5ldmFsKHNjb3BlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gTGl0ZXJhbFByaW1pdGl2ZSAodmFsdWUpIHtcbiAgdGhpcy5ldmFsID0gZnVuY3Rpb24gKHNjb3BlKSB7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xufVxuXG4vKipcbiAqIEBwYXJhbSB7RXhwcmVzc2lvbn0gY29uZGl0aW9uXG4gKiBAcGFyYW0ge0V4cHJlc3Npb259IHllc1xuICogQHBhcmFtIHtFeHByZXNzc2lvbn0gbm9cbiAqL1xuZnVuY3Rpb24gQ29uZGl0aW9uYWwgKGNvbmRpdGlvbiwgeWVzLCBubykge1xuICB0aGlzLmV2YWwgPSBmdW5jdGlvbiAoc2NvcGUpIHtcbiAgICByZXR1cm4gKCEhY29uZGl0aW9uLmV2YWwoc2NvcGUpKSA/IHllcy5ldmFsKHNjb3BlKSA6IG5vLmV2YWwoc2NvcGUpO1xuICB9O1xufVxuXG4vLyBBZGQgdGhlIHR3byBhcmd1bWVudHMgd2l0aCBhdXRvbWF0aWMgdHlwZSBjb252ZXJzaW9uLlxuZnVuY3Rpb24gYXV0b0NvbnZlcnRBZGQoYSwgYikge1xuICBpZiAoYSAhPSBudWxsICYmIGIgIT0gbnVsbCkge1xuICAgIGlmICh0eXBlb2YgYSA9PSAnc3RyaW5nJyAmJiB0eXBlb2YgYiAhPSAnc3RyaW5nJykge1xuICAgICAgcmV0dXJuIGEgKyBiLnRvU3RyaW5nKCk7XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBhICE9ICdzdHJpbmcnICYmIHR5cGVvZiBiID09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gYS50b1N0cmluZygpICsgYjtcbiAgICB9XG5cbiAgICByZXR1cm4gYSArIGI7XG4gIH1cblxuICBpZiAoYSAhPSBudWxsKSB7XG4gICAgcmV0dXJuIGE7XG4gIH1cblxuICBpZiAoYiAhPSBudWxsKSB7XG4gICAgcmV0dXJuIGI7XG4gIH1cblxuICByZXR1cm4gMDtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIEJpbmFyeTogQmluYXJ5LFxuICBDb25kaXRpb25hbDogQ29uZGl0aW9uYWwsXG4gIEFjY2Vzc01lbWJlcjogQWNjZXNzTWVtYmVyLFxuICBBY2Nlc3NTY29wZTogQWNjZXNzU2NvcGUsXG4gIFByZWZpeE5vdDogUHJlZml4Tm90LFxuICBMaXRlcmFsUHJpbWl0aXZlOiBMaXRlcmFsUHJpbWl0aXZlXG59O1xuIiwiLyoqXG4gKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gKi9cbmZ1bmN0aW9uIFRva2VuIChpbmRleCwgdGV4dCkge1xuICB0aGlzLmluZGV4ID0gaW5kZXg7XG4gIHRoaXMudGV4dCA9IHRleHQ7XG59XG5cblRva2VuLnByb3RvdHlwZSA9IHtcbiAgd2l0aE9wOiBmdW5jdGlvbiAob3ApIHtcbiAgICB0aGlzLm9wS2V5ID0gb3A7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG4gIHdpdGhHZXR0ZXJTZXR0ZXI6IGZ1bmN0aW9uIChrZXkpIHtcbiAgICB0aGlzLmtleSA9IGtleTtcbiAgICByZXR1cm4gdGhpcztcbiAgfSxcbiAgd2l0aFZhbHVlOiBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH0sXG4gIHRvU3RyaW5nOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICdUb2tlbignICsgdGhpcy50ZXh0ICsgJyknO1xuICB9XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gKiBAcmV0dXJuIHtBcnJheX0gQXJyYXlPZlRva2Vuc1xuICovXG5mdW5jdGlvbiBsZXggKHRleHQpIHtcbiAgdmFyIHNjYW5uZXIgPSBuZXcgU2Nhbm5lcih0ZXh0KTtcbiAgdmFyIHRva2VucyA9IFtdO1xuICB2YXIgdG9rZW4gPSBzY2FubmVyLnNjYW5Ub2tlbigpO1xuXG4gIHdoaWxlICh0b2tlbikge1xuICAgIHRva2Vucy5wdXNoKHRva2VuKTtcbiAgICB0b2tlbiA9IHNjYW5uZXIuc2NhblRva2VuKCk7XG4gIH1cblxuICByZXR1cm4gdG9rZW5zO1xufVxuXG4vKipcbiAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dFxuICovXG5mdW5jdGlvbiBTY2FubmVyIChpbnB1dCkge1xuICB0aGlzLmlucHV0ID0gaW5wdXQ7XG4gIHRoaXMubGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuICB0aGlzLnBlZWsgPSAwO1xuICB0aGlzLmluZGV4ID0gLTE7XG5cbiAgdGhpcy5hZHZhbmNlKCk7XG59XG5cblNjYW5uZXIucHJvdG90eXBlID0ge1xuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtUb2tlbn1cbiAgICovXG4gIHNjYW5Ub2tlbjogZnVuY3Rpb24gKCkge1xuICAgICAgLy8gU2tpcCB3aGl0ZXNwYWNlLlxuICAgIHdoaWxlICh0aGlzLnBlZWsgPD0gJFNQQUNFKSB7XG4gICAgICBpZiAoKyt0aGlzLmluZGV4ID49IHRoaXMubGVuZ3RoKSB7XG4gICAgICAgIHRoaXMucGVlayA9ICRFT0Y7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5wZWVrID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMuaW5kZXgpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIEhhbmRsZSBpZGVudGlmaWVycyBhbmQgbnVtYmVycy5cbiAgICBpZiAoaXNJZGVudGlmaWVyU3RhcnQodGhpcy5wZWVrKSkge1xuICAgICAgcmV0dXJuIHRoaXMuc2NhbklkZW50aWZpZXIoKTtcbiAgICB9XG5cbiAgICBpZiAoaXNEaWdpdCh0aGlzLnBlZWspKSB7XG4gICAgICByZXR1cm4gdGhpcy5zY2FuTnVtYmVyKHRoaXMuaW5kZXgpO1xuICAgIH1cblxuICAgIHZhciBzdGFydCA9IHRoaXMuaW5kZXg7XG5cbiAgICBzd2l0Y2ggKHRoaXMucGVlaykge1xuICAgICAgY2FzZSAkUEVSSU9EOlxuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgcmV0dXJuIGlzRGlnaXQodGhpcy5wZWVrKSA/IHRoaXMuc2Nhbk51bWJlcihzdGFydCkgOiBuZXcgVG9rZW4oc3RhcnQsICcuJyk7XG4gICAgICBjYXNlICRMUEFSRU46XG4gICAgICBjYXNlICRSUEFSRU46XG4gICAgICBjYXNlICRMQlJBQ0U6XG4gICAgICBjYXNlICRSQlJBQ0U6XG4gICAgICBjYXNlICRMQlJBQ0tFVDpcbiAgICAgIGNhc2UgJFJCUkFDS0VUOlxuICAgICAgY2FzZSAkQ09NTUE6XG4gICAgICBjYXNlICRDT0xPTjpcbiAgICAgIGNhc2UgJFNFTUlDT0xPTjpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhbkNoYXJhY3RlcihzdGFydCwgU3RyaW5nLmZyb21DaGFyQ29kZSh0aGlzLnBlZWspKTtcbiAgICAgIGNhc2UgJFNROlxuICAgICAgY2FzZSAkRFE6XG4gICAgICAgIHJldHVybiB0aGlzLnNjYW5TdHJpbmcoKTtcbiAgICAgIGNhc2UgJFBMVVM6XG4gICAgICBjYXNlICRNSU5VUzpcbiAgICAgIGNhc2UgJFNUQVI6XG4gICAgICBjYXNlICRTTEFTSDpcbiAgICAgIGNhc2UgJFBFUkNFTlQ6XG4gICAgICBjYXNlICRDQVJFVDpcbiAgICAgIGNhc2UgJFFVRVNUSU9OOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuT3BlcmF0b3Ioc3RhcnQsIFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy5wZWVrKSk7XG4gICAgICBjYXNlICRMVDpcbiAgICAgIGNhc2UgJEdUOlxuICAgICAgY2FzZSAkQkFORzpcbiAgICAgIGNhc2UgJEVROlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ29tcGxleE9wZXJhdG9yKHN0YXJ0LCAkRVEsIFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy5wZWVrKSwgJz0nKTtcbiAgICAgIGNhc2UgJEFNUEVSU0FORDpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhbkNvbXBsZXhPcGVyYXRvcihzdGFydCwgJEFNUEVSU0FORCwgJyYnLCAnJicpO1xuICAgICAgY2FzZSAkQkFSOlxuICAgICAgICByZXR1cm4gdGhpcy5zY2FuQ29tcGxleE9wZXJhdG9yKHN0YXJ0LCAkQkFSLCAnfCcsICd8Jyk7XG4gICAgICBjYXNlICRUSUxERTpcbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhbkNvbXBsZXhPcGVyYXRvcihzdGFydCwgJFNMQVNILCAnficsICcvJyk7XG4gICAgICBjYXNlICROQlNQOlxuICAgICAgICB3aGlsZSAoaXNXaGl0ZXNwYWNlKHRoaXMucGVlaykpe1xuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMuc2NhblRva2VuKCk7XG4gICAgfVxuXG4gICAgdmFyIGNoYXJhY3RlciA9IFN0cmluZy5mcm9tQ2hhckNvZGUodGhpcy5wZWVrKTtcbiAgICB0aGlzLmVycm9yKCdVbmV4cGVjdGVkIGNoYXJhY3RlciBbJyArIGNoYXJhY3RlciArICd9XScpO1xuICAgIHJldHVybiBudWxsO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge051bWJlcn0gc3RyaW5nXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge1Rva2VufVxuICAgKi9cbiAgc2NhbkNoYXJhY3RlcjogZnVuY3Rpb24gKHN0YXJ0LCB0ZXh0KSB7XG4gICAgYXNzZXJ0KHRoaXMucGVlayA9PSB0ZXh0LmNoYXJDb2RlQXQoMCkpO1xuICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgIHJldHVybiBuZXcgVG9rZW4oc3RhcnQsIHRleHQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge051bWJlcn0gc3RyaW5nXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gICAqIEByZXR1cm4ge1Rva2VufVxuICAgKi9cbiAgc2Nhbk9wZXJhdG9yOiBmdW5jdGlvbiAoc3RhcnQsIHRleHQpIHtcbiAgICBhc3NlcnQodGhpcy5wZWVrID09IHRleHQuY2hhckNvZGVBdCgwKSk7XG4gICAgYXNzZXJ0KE9QRVJBVE9SUy5pbmRleE9mKHRleHQpICE9IC0xKTtcbiAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICByZXR1cm4gbmV3IFRva2VuKHN0YXJ0LCB0ZXh0KS53aXRoT3AodGV4dCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBzdGFydFxuICAgKiBAcGFyYW0ge051bWJlcn0gY29kZVxuICAgKiBAcGFyYW0ge1N0cmluZ30gb25lXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0d29cbiAgICogQHJldHVybiB7VG9rZW59XG4gICAqL1xuICBzY2FuQ29tcGxleE9wZXJhdG9yOiBmdW5jdGlvbiAoc3RhcnQsIGNvZGUsIG9uZSwgdHdvKSB7XG4gICAgYXNzZXJ0KHRoaXMucGVlayA9PSBvbmUuY2hhckNvZGVBdCgwKSk7XG4gICAgdGhpcy5hZHZhbmNlKCk7XG5cbiAgICB2YXIgdGV4dCA9IG9uZTtcblxuICAgIGlmICh0aGlzLnBlZWsgPT0gY29kZSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICB0ZXh0ICs9IHR3bztcbiAgICB9XG5cbiAgICBhc3NlcnQoT1BFUkFUT1JTLmluZGV4T2YodGV4dCkgIT0gLTEpO1xuXG4gICAgcmV0dXJuIG5ldyBUb2tlbihzdGFydCwgdGV4dCkud2l0aE9wKHRleHQpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcmV0dXJuIHtUb2tlbn1cbiAgICovXG4gIHNjYW5JZGVudGlmaWVyOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5pbmRleDtcblxuICAgIHRoaXMuYWR2YW5jZSgpO1xuXG4gICAgd2hpbGUgKGlzSWRlbnRpZmllclBhcnQodGhpcy5wZWVrKSkge1xuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgfVxuXG4gICAgdmFyIHRleHQgPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgdGhpcy5pbmRleCk7XG4gICAgdmFyIHJlc3VsdCA9IG5ldyBUb2tlbihzdGFydCwgdGV4dCk7XG5cbiAgICAvLyBUT0RPKGthc3BlcmwpOiBEZWFsIHdpdGggbnVsbCwgdW5kZWZpbmVkLCB0cnVlLCBhbmQgZmFsc2UgaW5cbiAgICAvLyBhIGNsZWFuZXIgYW5kIGZhc3RlciB3YXkuXG4gICAgaWYgKE9QRVJBVE9SUy5pbmRleE9mKHRleHQpICE9IC0xKSB7XG4gICAgICByZXN1bHQud2l0aE9wKHRleHQpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXN1bHQud2l0aEdldHRlclNldHRlcih0ZXh0KTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuXG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gc3RhcnRcbiAgICogQHJldHVybiB7VG9rZW59XG4gICAqL1xuICBzY2FuTnVtYmVyOiBmdW5jdGlvbiAoc3RhcnQpIHtcbiAgICB2YXIgc2ltcGxlID0gKHRoaXMuaW5kZXggPT0gc3RhcnQpO1xuICAgIHRoaXMuYWR2YW5jZSgpOyAgLy8gU2tpcCBpbml0aWFsIGRpZ2l0LlxuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmIChpc0RpZ2l0KHRoaXMucGVlaykpIHtcbiAgICAgICAgLy8gRG8gbm90aGluZy5cbiAgICAgIH0gZWxzZSBpZiAodGhpcy5wZWVrID09ICRQRVJJT0QpIHtcbiAgICAgICAgc2ltcGxlID0gZmFsc2U7XG4gICAgICB9IGVsc2UgaWYgKGlzRXhwb25lbnRTdGFydCh0aGlzLnBlZWspKSB7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuXG4gICAgICAgIGlmIChpc0V4cG9uZW50U2lnbih0aGlzLnBlZWspKXtcbiAgICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICghaXNEaWdpdCh0aGlzLnBlZWspKXtcbiAgICAgICAgICB0aGlzLmVycm9yKCdJbnZhbGlkIGV4cG9uZW50JywgLTEpO1xuICAgICAgICB9XG5cbiAgICAgICAgc2ltcGxlID0gZmFsc2U7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgfVxuXG4gICAgdmFyIHRleHQgPSB0aGlzLmlucHV0LnN1YnN0cmluZyhzdGFydCwgdGhpcy5pbmRleCk7XG4gICAgdmFyIHZhbHVlID0gc2ltcGxlID8gcGFyc2VJbnQodGV4dCkgOiBwYXJzZUZsb2F0KHRleHQpO1xuICAgIHJldHVybiBuZXcgVG9rZW4oc3RhcnQsIHRleHQpLndpdGhWYWx1ZSh2YWx1ZSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEByZXR1cm4ge1Rva2VufVxuICAgKi9cbiAgc2NhblN0cmluZzogZnVuY3Rpb24gKCkge1xuICAgIHZhciBzdGFydCA9IHRoaXMuaW5kZXg7XG4gICAgdmFyIHF1b3RlID0gdGhpcy5wZWVrO1xuXG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBTa2lwIGluaXRpYWwgcXVvdGUuXG5cbiAgICB2YXIgYnVmZmVyO1xuICAgIHZhciBtYXJrZXIgPSB0aGlzLmluZGV4O1xuXG4gICAgd2hpbGUgKHRoaXMucGVlayAhPSBxdW90ZSkge1xuICAgICAgaWYgKHRoaXMucGVlayA9PSAkQkFDS1NMQVNIKSB7XG4gICAgICAgIGlmIChidWZmZXIgPT0gbnVsbCkge1xuICAgICAgICAgIGJ1ZmZlciA9IFtdO1xuICAgICAgICB9XG5cbiAgICAgICAgYnVmZmVyLnB1c2godGhpcy5pbnB1dC5zdWJzdHJpbmcobWFya2VyLCB0aGlzLmluZGV4KSk7XG4gICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuXG4gICAgICAgIHZhciB1bmVzY2FwZWQ7XG5cbiAgICAgICAgaWYgKHRoaXMucGVlayA9PSAkdSkge1xuICAgICAgICAgIC8vIFRPRE8oa2FzcGVybCk6IENoZWNrIGJvdW5kcz8gTWFrZSBzdXJlIHdlIGhhdmUgdGVzdFxuICAgICAgICAgIC8vIGNvdmVyYWdlIGZvciB0aGlzLlxuICAgICAgICAgIHZhciBoZXggPSB0aGlzLmlucHV0LnN1YnN0cmluZyh0aGlzLmluZGV4ICsgMSwgdGhpcy5pbmRleCArIDUpO1xuXG4gICAgICAgICAgaWYoIS9bQS1aMC05XXs0fS8udGVzdChoZXgpKXtcbiAgICAgICAgICAgIHRoaXMuZXJyb3IoJ0ludmFsaWQgdW5pY29kZSBlc2NhcGUgW1xcXFx1JyArIGhleCArICddJyk7XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgdW5lc2NhcGVkID0gcGFyc2VJbnQoaGV4LCAxNik7XG5cbiAgICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8IDU7IGkrKykge1xuICAgICAgICAgICAgdGhpcy5hZHZhbmNlKCk7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHVuZXNjYXBlZCA9IGRlY29kZVVSSUNvbXBvbmVudCh0aGlzLnBlZWspO1xuICAgICAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgICB9XG5cbiAgICAgICAgYnVmZmVyLnB1c2goU3RyaW5nLmZyb21DaGFyQ29kZSh1bmVzY2FwZWQpKTtcbiAgICAgICAgbWFya2VyID0gdGhpcy5pbmRleDtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5wZWVrID09ICRFT0YpIHtcbiAgICAgICAgdGhpcy5lcnJvcignVW50ZXJtaW5hdGVkIHF1b3RlJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICB2YXIgbGFzdCA9IHRoaXMuaW5wdXQuc3Vic3RyaW5nKG1hcmtlciwgdGhpcy5pbmRleCk7XG4gICAgdGhpcy5hZHZhbmNlKCk7ICAvLyBTa2lwIHRlcm1pbmF0aW5nIHF1b3RlLlxuICAgIHZhciB0ZXh0ID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIHRoaXMuaW5kZXgpO1xuXG4gICAgLy8gQ29tcHV0ZSB0aGUgdW5lc2NhcGVkIHN0cmluZyB2YWx1ZS5cbiAgICB2YXIgdW5lc2NhcGVkID0gbGFzdDtcblxuICAgIGlmIChidWZmZXIgIT0gbnVsbCkge1xuICAgICAgYnVmZmVyLnB1c2gobGFzdCk7XG4gICAgICB1bmVzY2FwZWQgPSBidWZmZXIuam9pbignJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBUb2tlbihzdGFydCwgdGV4dCkud2l0aFZhbHVlKHVuZXNjYXBlZCk7XG4gIH0sXG5cbiAgYWR2YW5jZTogZnVuY3Rpb24gKCkge1xuICAgIGlmICgrK3RoaXMuaW5kZXggPj0gdGhpcy5sZW5ndGgpe1xuICAgICAgdGhpcy5wZWVrID0gJEVPRjtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5wZWVrID0gdGhpcy5pbnB1dC5jaGFyQ29kZUF0KHRoaXMuaW5kZXgpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IG1lc3NhZ2VcbiAgICogQHBhcmFtIHtOdW1iZXJ9IG9mZnNldFxuICAgKi9cbiAgZXJyb3I6IGZ1bmN0aW9uIChtZXNzYWdlLCBvZmZzZXQpIHtcbiAgICBvZmZzZXQgPSBvZmZzZXQgfHwgMDtcbiAgICB2YXIgcG9zaXRpb24gPSB0aGlzLmluZGV4ICsgb2Zmc2V0O1xuICAgIHRocm93IG5ldyBFcnJvcignTGV4ZXIgRXJyb3I6ICcgKyBtZXNzYWdlICsgJyBhdCBjb2x1bW4gJyArIHBvc2l0aW9uICsgJyBpbiBleHByZXNzaW9uIFsnICsgdGhpcy5pbnB1dCArICddJyk7XG4gIH1cbn07XG5cbnZhciAkRU9GICAgICAgID0gMDtcbnZhciAkVEFCICAgICAgID0gOTtcbnZhciAkTEYgICAgICAgID0gMTA7XG52YXIgJFZUQUIgICAgICA9IDExO1xudmFyICRGRiAgICAgICAgPSAxMjtcbnZhciAkQ1IgICAgICAgID0gMTM7XG52YXIgJFNQQUNFICAgICA9IDMyO1xudmFyICRCQU5HICAgICAgPSAzMztcbnZhciAkRFEgICAgICAgID0gMzQ7XG52YXIgJCQgICAgICAgICA9IDM2O1xudmFyICRQRVJDRU5UICAgPSAzNztcbnZhciAkQU1QRVJTQU5EID0gMzg7XG52YXIgJFNRICAgICAgICA9IDM5O1xudmFyICRMUEFSRU4gICAgPSA0MDtcbnZhciAkUlBBUkVOICAgID0gNDE7XG52YXIgJFNUQVIgICAgICA9IDQyO1xudmFyICRQTFVTICAgICAgPSA0MztcbnZhciAkQ09NTUEgICAgID0gNDQ7XG52YXIgJE1JTlVTICAgICA9IDQ1O1xudmFyICRQRVJJT0QgICAgPSA0NjtcbnZhciAkU0xBU0ggICAgID0gNDc7XG52YXIgJENPTE9OICAgICA9IDU4O1xudmFyICRTRU1JQ09MT04gPSA1OTtcbnZhciAkTFQgICAgICAgID0gNjA7XG52YXIgJEVRICAgICAgICA9IDYxO1xudmFyICRHVCAgICAgICAgPSA2MjtcbnZhciAkUVVFU1RJT04gID0gNjM7XG5cbnZhciAkMCA9IDQ4O1xudmFyICQ5ID0gNTc7XG5cbnZhciAkQSA9IDY1O1xudmFyICRFID0gNjk7XG52YXIgJFogPSA5MDtcblxudmFyICRMQlJBQ0tFVCAgPSA5MTtcbnZhciAkQkFDS1NMQVNIID0gOTI7XG52YXIgJFJCUkFDS0VUICA9IDkzO1xudmFyICRDQVJFVCAgICAgPSA5NDtcbnZhciAkXyAgICAgICAgID0gOTU7XG5cbnZhciAkYSA9IDk3O1xudmFyICRlID0gMTAxO1xudmFyICRmID0gMTAyO1xudmFyICRuID0gMTEwO1xudmFyICRyID0gMTE0O1xudmFyICR0ID0gMTE2O1xudmFyICR1ID0gMTE3O1xudmFyICR2ID0gMTE4O1xudmFyICR6ID0gMTIyO1xuXG52YXIgJExCUkFDRSA9IDEyMztcbnZhciAkQkFSICAgID0gMTI0O1xudmFyICRSQlJBQ0UgPSAxMjU7XG52YXIgJFRJTERFICA9IDEyNjtcbnZhciAkTkJTUCAgID0gMTYwO1xuXG52YXIgT1BFUkFUT1JTID0gW1xuICAndW5kZWZpbmVkJyxcbiAgJ251bGwnLFxuICAndHJ1ZScsXG4gICdmYWxzZScsXG4gICcrJyxcbiAgJy0nLFxuICAnKicsXG4gICcvJyxcbiAgJ34vJyxcbiAgJyUnLFxuICAnXicsXG4gICc9JyxcbiAgJz09JyxcbiAgJyE9JyxcbiAgJzwnLFxuICAnPicsXG4gICc8PScsXG4gICc+PScsXG4gICcmJicsXG4gICd8fCcsXG4gICcmJyxcbiAgJ3wnLFxuICAnIScsXG4gICc/J1xuXTtcblxuZnVuY3Rpb24gaXNXaGl0ZXNwYWNlKGNvZGUpIHtcbiAgcmV0dXJuIChjb2RlID49ICRUQUIgJiYgY29kZSA8PSAkU1BBQ0UpIHx8IChjb2RlID09ICROQlNQKTtcbn1cblxuZnVuY3Rpb24gaXNJZGVudGlmaWVyU3RhcnQoY29kZSkge1xuICByZXR1cm4gKCRhIDw9IGNvZGUgJiYgY29kZSA8PSAkeilcbiAgICAgIHx8ICgkQSA8PSBjb2RlICYmIGNvZGUgPD0gJFopXG4gICAgICB8fCAoY29kZSA9PSAkXylcbiAgICAgIHx8IChjb2RlID09ICQkKTtcbn1cblxuZnVuY3Rpb24gaXNJZGVudGlmaWVyUGFydChjb2RlKSB7XG4gIHJldHVybiAoJGEgPD0gY29kZSAmJiBjb2RlIDw9ICR6KVxuICAgICAgfHwgKCRBIDw9IGNvZGUgJiYgY29kZSA8PSAkWilcbiAgICAgIHx8ICgkMCA8PSBjb2RlICYmIGNvZGUgPD0gJDkpXG4gICAgICB8fCAoY29kZSA9PSAkXylcbiAgICAgIHx8IChjb2RlID09ICQkKTtcbn1cblxuZnVuY3Rpb24gaXNEaWdpdChjb2RlKSB7XG4gIHJldHVybiAoJDAgPD0gY29kZSAmJiBjb2RlIDw9ICQ5KTtcbn1cblxuZnVuY3Rpb24gaXNFeHBvbmVudFN0YXJ0KGNvZGUpIHtcbiAgcmV0dXJuIChjb2RlID09ICRlIHx8IGNvZGUgPT0gJEUpO1xufVxuXG5mdW5jdGlvbiBpc0V4cG9uZW50U2lnbihjb2RlKSB7XG4gIHJldHVybiAoY29kZSA9PSAkTUlOVVMgfHwgY29kZSA9PSAkUExVUyk7XG59XG5cbmZ1bmN0aW9uIHVuZXNjYXBlKGNvZGUpIHtcbiAgc3dpdGNoKGNvZGUpIHtcbiAgICBjYXNlICRuOiByZXR1cm4gJExGO1xuICAgIGNhc2UgJGY6IHJldHVybiAkRkY7XG4gICAgY2FzZSAkcjogcmV0dXJuICRDUjtcbiAgICBjYXNlICR0OiByZXR1cm4gJFRBQjtcbiAgICBjYXNlICR2OiByZXR1cm4gJFZUQUI7XG4gICAgZGVmYXVsdDogcmV0dXJuIGNvZGU7XG4gIH1cbn1cblxuZnVuY3Rpb24gYXNzZXJ0KGNvbmRpdGlvbiwgbWVzc2FnZSkge1xuICBpZiAoIWNvbmRpdGlvbikge1xuICAgIHRocm93IG1lc3NhZ2UgfHwgXCJBc3NlcnRpb24gZmFpbGVkXCI7XG4gIH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIFRva2VuOiBUb2tlbixcbiAgbGV4OiBsZXhcbn07XG4iLCJ2YXIgTGV4ZXIgPSByZXF1aXJlKCcuL2xleGVyJyk7XG52YXIgRXhwcmVzc2lvbnMgPSByZXF1aXJlKCcuL2FzdCcpO1xuXG52YXIgQmluYXJ5ID0gRXhwcmVzc2lvbnMuQmluYXJ5O1xudmFyIEFjY2Vzc01lbWJlciA9IEV4cHJlc3Npb25zLkFjY2Vzc01lbWJlcjtcbnZhciBBY2Nlc3NTY29wZSA9IEV4cHJlc3Npb25zLkFjY2Vzc1Njb3BlO1xudmFyIFByZWZpeE5vdCA9IEV4cHJlc3Npb25zLlByZWZpeE5vdDtcbnZhciBMaXRlcmFsUHJpbWl0aXZlID0gRXhwcmVzc2lvbnMuTGl0ZXJhbFByaW1pdGl2ZTtcbnZhciBDb25kaXRpb25hbCA9IEV4cHJlc3Npb25zLkNvbmRpdGlvbmFsO1xuXG5mdW5jdGlvbiBQYXJzZXIgKCkge1xuICB0aGlzLmNhY2hlID0ge307XG59XG5cblBhcnNlci5wcm90b3R5cGUgPSB7XG4gIC8qKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXRcbiAgICogQHJldHVybiB7UGFyc2VySW1wbGVtZW50YXRpb259XG4gICAqL1xuICBwYXJzZTogZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgaW5wdXQgPSBpbnB1dCB8fCAnJztcblxuICAgIGlmICghdGhpcy5jYWNoZS5oYXNPd25Qcm9wZXJ0eShpbnB1dCkpIHtcbiAgICAgIHRoaXMuY2FjaGVbaW5wdXRdID0gbmV3IFBhcnNlckltcGxlbWVudGF0aW9uKExleGVyLCBpbnB1dCkucGFyc2UoKTtcbiAgICB9XG5cbiAgICByZXR1cm4gdGhpcy5jYWNoZVtpbnB1dF07XG4gIH0sXG5cbiAgLyoqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dFxuICAgKiBAcmV0dXJuIHtPYmplY3R9XG4gICAqL1xuICBwYXJzZU9iamVjdDogZnVuY3Rpb24gKGlucHV0KSB7XG4gICAgdmFyIG9iaiA9IHt9O1xuICAgIHZhciBhY2Nlc3NTY29wZU5hbWVzID0gW107XG5cbiAgICAvLyBUT0RPOiB0aGVyZSBhcmUgZWRnZXMgY2FzZXMgaGVyZSB3aGVuIHVzaW5nIHNwbGl0XG4gICAgaW5wdXQuc3BsaXQoJzsnKS5mb3JFYWNoKGZ1bmN0aW9uIChleHApIHtcbiAgICAgIHZhciBrZXlTZXBhcmF0b3JJbmRleCA9IGV4cC5pbmRleE9mKCc6Jyk7XG4gICAgICB2YXIgZXhwcmVzc2lvbiA9IHRoaXMucGFyc2UoZXhwLnN1YnN0cmluZyhrZXlTZXBhcmF0b3JJbmRleCArIDEpLnRyaW0oKSk7XG4gICAgICBhY2Nlc3NTY29wZU5hbWVzID0gYWNjZXNzU2NvcGVOYW1lcy5jb25jYXQoZXhwcmVzc2lvbi5hY2Nlc3NTY29wZU5hbWVzKTtcbiAgICAgIG9ialtleHAuc3Vic3RyaW5nKDAsIGtleVNlcGFyYXRvckluZGV4KV0gPSBleHByZXNzaW9uO1xuICAgIH0uYmluZCh0aGlzKSk7XG5cbiAgICByZXR1cm4ge1xuICAgICAgaW5wdXQ6IGlucHV0LFxuICAgICAgYWNjZXNzU2NvcGVOYW1lczogYWNjZXNzU2NvcGVOYW1lcyxcbiAgICAgIGV2YWw6IGZ1bmN0aW9uIChzY29wZSkge1xuICAgICAgICB2YXIgcmV0dXJuT2JqID0ge307XG5cbiAgICAgICAgT2JqZWN0LmtleXMob2JqKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcbiAgICAgICAgICByZXR1cm5PYmpba2V5XSA9IG9ialtrZXldLmV2YWwoc2NvcGUpO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gcmV0dXJuT2JqO1xuICAgICAgfVxuICAgIH07XG4gIH1cbn1cblxudmFyIEVPRiA9IG5ldyBMZXhlci5Ub2tlbigtMSwgbnVsbCk7XG5cbi8qKlxuICogQHBhcmFtIHtPYmplY3R9IGxleGVyXG4gKiBAcGFyYW0ge1N0cmluZ30gaW5wdXRcbiAqL1xuZnVuY3Rpb24gUGFyc2VySW1wbGVtZW50YXRpb24obGV4ZXIsIGlucHV0KSB7XG4gIHRoaXMuaW5kZXggPSAwO1xuICB0aGlzLmlucHV0ID0gaW5wdXQ7XG4gIHRoaXMuYWNjZXNzU2NvcGVOYW1lcyA9IFtdO1xuICB0aGlzLnRva2VucyA9IGxleGVyLmxleChpbnB1dCk7XG59XG5cblBhcnNlckltcGxlbWVudGF0aW9uLnByb3RvdHlwZSA9IHtcblxuICBwZWVrOiBmdW5jdGlvbiAoKSB7XG4gICAgcmV0dXJuICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSA/IHRoaXMudG9rZW5zW3RoaXMuaW5kZXhdIDogRU9GO1xuICB9LFxuXG4gIHBhcnNlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIGV4cHJlc3Npb24gPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgIC8vIGV4cG9zZSB1c2VmdWwgaW5mb3JtYXRpb25cbiAgICBleHByZXNzaW9uLmlucHV0ID0gdGhpcy5pbnB1dDtcbiAgICBleHByZXNzaW9uLmFjY2Vzc1Njb3BlTmFtZXMgPSB0aGlzLmFjY2Vzc1Njb3BlTmFtZXM7XG4gICAgcmV0dXJuIGV4cHJlc3Npb247XG4gIH0sXG5cbiAgcGFyc2VFeHByZXNzaW9uOiBmdW5jdGlvbiAoKSAge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlQ29uZGl0aW9uYWwoKTtcblxuICAgIHdoaWxlICh0aGlzLm9wdGlvbmFsKCcpJykpIHtcbiAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICBwYXJzZUNvbmRpdGlvbmFsOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5wZWVrKCkuaW5kZXgsXG4gICAgICByZXN1bHQgPSB0aGlzLnBhcnNlTG9naWNhbE9yKCk7XG5cbiAgICBpZiAodGhpcy5vcHRpb25hbCgnPycpKSB7XG4gICAgICB2YXIgeWVzID0gdGhpcy5wYXJzZUV4cHJlc3Npb24oKTtcblxuICAgICAgaWYgKCF0aGlzLm9wdGlvbmFsKCc6JykpIHtcbiAgICAgICAgdmFyIGVuZCA9ICh0aGlzLmluZGV4IDwgdGhpcy50b2tlbnMubGVuZ3RoKSA/IHRoaXMucGVlaygpLmluZGV4IDogdGhpcy5pbnB1dC5sZW5ndGg7XG4gICAgICAgIHZhciBleHByZXNzaW9uID0gdGhpcy5pbnB1dC5zdWJzdHJpbmcoc3RhcnQsIGVuZCk7XG5cbiAgICAgICAgdGhpcy5lcnJvcignQ29uZGl0aW9uYWwgZXhwcmVzc2lvbicgKyBleHByZXNzaW9uICsgJ3JlcXVpcmVzIGFsbCAzIGV4cHJlc3Npb25zJyk7XG4gICAgICB9XG5cbiAgICAgIHZhciBubyA9IHRoaXMucGFyc2VFeHByZXNzaW9uKCk7XG4gICAgICByZXN1bHQgPSBuZXcgQ29uZGl0aW9uYWwocmVzdWx0LCB5ZXMsIG5vKTtcbiAgICB9XG5cbiAgICByZXR1cm4gcmVzdWx0O1xuICB9LFxuXG4gIHBhcnNlTG9naWNhbE9yOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VMb2dpY2FsQW5kKCk7XG5cbiAgICB3aGlsZSAodGhpcy5vcHRpb25hbCgnfHwnKSkge1xuICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnfHwnLCByZXN1bHQsIHRoaXMucGFyc2VMb2dpY2FsQW5kKCkpO1xuICAgIH1cblxuICAgIHJldHVybiByZXN1bHQ7XG4gIH0sXG5cbiAgcGFyc2VMb2dpY2FsQW5kOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VFcXVhbGl0eSgpO1xuXG4gICAgd2hpbGUgKHRoaXMub3B0aW9uYWwoJyYmJykpIHtcbiAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJyYmJywgcmVzdWx0LCB0aGlzLnBhcnNlRXF1YWxpdHkoKSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSxcblxuICBwYXJzZUVxdWFsaXR5OiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VSZWxhdGlvbmFsKCk7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMub3B0aW9uYWwoJz09JykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnPT0nLCByZXN1bHQsIHRoaXMucGFyc2VSZWxhdGlvbmFsKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCchPScpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJyE9JywgcmVzdWx0LCB0aGlzLnBhcnNlUmVsYXRpb25hbCgpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIHBhcnNlUmVsYXRpb25hbDogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlQWRkaXRpdmUoKTtcblxuICAgIHdoaWxlICh0cnVlKSB7XG4gICAgICBpZiAodGhpcy5vcHRpb25hbCgnPCcpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJzwnLCByZXN1bHQsIHRoaXMucGFyc2VBZGRpdGl2ZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnPicpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJz4nLCByZXN1bHQsIHRoaXMucGFyc2VBZGRpdGl2ZSgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnPD0nKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCc8PScsIHJlc3VsdCwgdGhpcy5wYXJzZUFkZGl0aXZlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCc+PScpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJz49JywgcmVzdWx0LCB0aGlzLnBhcnNlQWRkaXRpdmUoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwYXJzZUFkZGl0aXZlOiBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlc3VsdCA9IHRoaXMucGFyc2VNdWx0aXBsaWNhdGl2ZSgpO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbmFsKCcrJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnKycsIHJlc3VsdCwgdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCctJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnLScsIHJlc3VsdCwgdGhpcy5wYXJzZU11bHRpcGxpY2F0aXZlKCkpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgcGFyc2VNdWx0aXBsaWNhdGl2ZTogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlUHJlZml4KCk7XG5cbiAgICB3aGlsZSAodHJ1ZSkge1xuICAgICAgaWYgKHRoaXMub3B0aW9uYWwoJyonKSkge1xuICAgICAgICByZXN1bHQgPSBuZXcgQmluYXJ5KCcqJywgcmVzdWx0LCB0aGlzLnBhcnNlUHJlZml4KCkpO1xuICAgICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCclJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnJScsIHJlc3VsdCwgdGhpcy5wYXJzZVByZWZpeCgpKTtcbiAgICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnLycpKSB7XG4gICAgICAgIHJlc3VsdCA9IG5ldyBCaW5hcnkoJy8nLCByZXN1bHQsIHRoaXMucGFyc2VQcmVmaXgoKSk7XG4gICAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJ34vJykpIHtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEJpbmFyeSgnfi8nLCByZXN1bHQsIHRoaXMucGFyc2VQcmVmaXgoKSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICBwYXJzZVByZWZpeDogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbmFsKCcrJykpIHtcbiAgICAgIHJldHVybiB0aGlzLnBhcnNlUHJlZml4KCk7IC8vIFRPRE8oa2FzcGVybCk6IFRoaXMgaXMgZGlmZmVyZW50IHRoYW4gdGhlIG9yaWdpbmFsIHBhcnNlci5cbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJy0nKSkge1xuICAgICAgcmV0dXJuIG5ldyBCaW5hcnkoJy0nLCBuZXcgTGl0ZXJhbFByaW1pdGl2ZSgwKSwgdGhpcy5wYXJzZVByZWZpeCgpKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJyEnKSkge1xuICAgICAgcmV0dXJuIG5ldyBQcmVmaXhOb3QoJyEnLCB0aGlzLnBhcnNlUHJlZml4KCkpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5wYXJzZUFjY2Vzc01lbWJlcigpO1xuICAgIH1cbiAgfSxcblxuICBwYXJzZUFjY2Vzc01lbWJlcjogZnVuY3Rpb24gKCkge1xuICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlUHJpbWFyeSgpO1xuXG4gICAgd2hpbGUgKHRydWUpIHtcbiAgICAgIGlmICh0aGlzLm9wdGlvbmFsKCcuJykpIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLnBlZWsoKS50ZXh0O1xuICAgICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgICAgcmVzdWx0ID0gbmV3IEFjY2Vzc01lbWJlcihyZXN1bHQsIG5hbWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgLy8gUHJlbWF0dXJlIG9wdGltaXphdGlvbnMgOylcbiAgcmVnaXN0ZXJBY2Nlc3NNZW1iZXJOYW1lOiBmdW5jdGlvbiAobmFtZSkge1xuICAgIGlmICh0aGlzLmFjY2Vzc01lbWJlck5hbWVzLmluZGV4T2YobmFtZSkgPT09IC0xKSB7XG4gICAgICB0aGlzLmFjY2Vzc01lbWJlck5hbWVzLnB1c2gobmFtZSk7XG4gICAgfVxuICB9LFxuXG4gIHBhcnNlUHJpbWFyeTogZnVuY3Rpb24gKCkge1xuICAgIGlmICh0aGlzLm9wdGlvbmFsKCcoJykpIHtcbiAgICAgIC8vIFRPRE9cbiAgICAgIHZhciByZXN1bHQgPSB0aGlzLnBhcnNlRXhwcmVzc2lvbigpO1xuICAgICAgcmV0dXJuIHJlc3VsdFxuICAgIH0gZWxzZSBpZiAodGhpcy5vcHRpb25hbCgnbnVsbCcpIHx8IHRoaXMub3B0aW9uYWwoJ3VuZGVmaW5lZCcpKSB7XG4gICAgICByZXR1cm4gbmV3IExpdGVyYWxQcmltaXRpdmUobnVsbCk7XG4gICAgfSBlbHNlIGlmICh0aGlzLm9wdGlvbmFsKCd0cnVlJykpIHtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh0cnVlKTtcbiAgICB9IGVsc2UgaWYgKHRoaXMub3B0aW9uYWwoJ2ZhbHNlJykpIHtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZShmYWxzZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLnBlZWsoKS5rZXkgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHRoaXMucGFyc2VBY2Nlc3NTY29wZSgpO1xuICAgIH0gZWxzZSBpZiAodGhpcy5wZWVrKCkudmFsdWUgIT0gbnVsbCkge1xuICAgICAgdmFyIHZhbHVlID0gdGhpcy5wZWVrKCkudmFsdWU7XG4gICAgICB0aGlzLmFkdmFuY2UoKTtcbiAgICAgIHJldHVybiBuZXcgTGl0ZXJhbFByaW1pdGl2ZSh2YWx1ZSk7XG4gICAgfSBlbHNlIGlmICh0aGlzLmluZGV4ID49IHRoaXMudG9rZW5zLmxlbmd0aCkge1xuICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmV4cGVjdGVkIGVuZCBvZiBleHByZXNzaW9uOiAnICsgdGhpcy5pbnB1dCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZXJyb3IoJ1VuZXhwZWN0ZWQgdG9rZW4gJyArIHRoaXMucGVlaygpLnRleHQpO1xuICAgIH1cblxuICB9LFxuXG4gIHBhcnNlQWNjZXNzU2NvcGU6IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgbmFtZSA9IHRoaXMucGVlaygpLmtleTtcblxuICAgIHRoaXMuYWR2YW5jZSgpO1xuXG4gICAgaWYgKHRoaXMuYWNjZXNzU2NvcGVOYW1lcy5pbmRleE9mKG5hbWUpID09PSAtMSkge1xuICAgICAgdGhpcy5hY2Nlc3NTY29wZU5hbWVzLnB1c2gobmFtZSk7XG4gICAgfVxuXG4gICAgcmV0dXJuIG5ldyBBY2Nlc3NTY29wZShuYW1lKTtcbiAgfSxcblxuICAvKipcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7Qm9vbGVhbn1cbiAgICovXG4gIG9wdGlvbmFsOiBmdW5jdGlvbiAodGV4dCkge1xuICAgIGlmICh0aGlzLnBlZWsoKS50ZXh0ID09IHRleHQpIHtcbiAgICAgIHRoaXMuYWR2YW5jZSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuXG4gICAgcmV0dXJuIGZhbHNlO1xuICB9LFxuXG4gIGFkdmFuY2U6IGZ1bmN0aW9uICgpIHtcbiAgICB0aGlzLmluZGV4Kys7XG4gIH0sXG5cbiAgZXJyb3I6IGZ1bmN0aW9uIChtZXNzYWdlKSB7XG4gICAgdmFyIGxvY2F0aW9uID0gKHRoaXMuaW5kZXggPCB0aGlzLnRva2Vucy5sZW5ndGgpID9cbiAgICAgICdhdCBjb2x1bW4gJyArIHRoaXMudG9rZW5zW3RoaXMuaW5kZXhdLmluZGV4ICsgMSArICcgaW4nIDpcbiAgICAgICdhdCB0aGUgZW5kIG9mIHRoZSBleHByZXNzaW9uJztcblxuICAgIHRocm93IG5ldyBFcnJvcignUGFyc2VyIEVycm9yOiAnICsgbWVzc2FnZSArICcgJyArIGxvY2F0aW9uICsgJyBbJyArIHRoaXMuaW5wdXQgKyAnXScpO1xuICB9XG5cbn07XG5cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIFBhcnNlcjogUGFyc2VyLFxuICBQYXJzZXJJbXBsZW1lbnRhdGlvbjogUGFyc2VySW1wbGVtZW50YXRpb25cbn07XG4iLCJ2YXIgU3RhdGVmdWxGb3JtRWxlbWVudCA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtZm9ybS1lbGVtZW50Jyk7XG5cbnZhciBDbHMgPSBmdW5jdGlvbiBTdGF0ZWZ1bENoZWNrYm94ICgpIHtcbiAgU3RhdGVmdWxGb3JtRWxlbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufTtcblxudmFyIFByb3RvID0gQ2xzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxGb3JtRWxlbWVudC5wcm90b3R5cGUpO1xuXG5Qcm90by5iaW5kRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMudXBkYXRlVmFsdWUuYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by51cGRhdGVWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5zZXRTdGF0ZSh7IHZhbHVlOiB0aGlzLmdldFZhbHVlKCksIHByaXN0aW5lOiBmYWxzZSwgdG91Y2hlZDogdHJ1ZSB9KTtcbn07XG5cblByb3RvLmlzVmFsaWQgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmVsLmhhc0F0dHJpYnV0ZSgncmVxdWlyZWQnKSkge1xuICAgIHJldHVybiB0aGlzLmVsLmNoZWNrZWQ7XG4gIH1cbiAgcmV0dXJuIHRydWU7XG59O1xuXG5Qcm90by5nZXRWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcbiAgcmV0dXJuIHRoaXMuZWwuY2hlY2tlZDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xzO1xuIiwidmFyIFN0YXRlZnVsT2JqZWN0ID0gcmVxdWlyZSgnLi4vc3RhdGVmdWwtb2JqZWN0Jyk7XG5cbmZ1bmN0aW9uIFN0YXRlZnVsRm9ybUVsZW1lbnQgKGVsKSB7XG4gIHRoaXMuZWwgPSBlbDtcbiAgdGhpcy5uYW1lID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ25hbWUnKTtcbiAgU3RhdGVmdWxPYmplY3QuY2FsbCh0aGlzKTtcbiAgdGhpcy5iaW5kRXZlbnRzKCk7XG59XG5cbnZhciBQcm90byA9IFN0YXRlZnVsRm9ybUVsZW1lbnQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bE9iamVjdC5wcm90b3R5cGUpO1xuXG5Qcm90by5nZXREZWZhdWx0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBzdGF0ZSA9IHtcbiAgICB2YWxpZDogdGhpcy5pc1ZhbGlkKCksXG4gICAgcHJpc3RpbmU6IHRydWUsXG4gICAgdG91Y2hlZDogZmFsc2UsXG4gICAgdmFsdWU6IHRoaXMuZ2V0VmFsdWUoKVxuICB9O1xuXG4gIHJldHVybiBzdGF0ZTtcbn07XG5cblByb3RvLmdldFZhbHVlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gdGhpcy5lbC52YWx1ZTtcbn07XG5cblByb3RvLmNvbXB1dGVkU3RhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgc3RhdGUudmFsaWQgPSB0aGlzLmlzVmFsaWQoKTtcblxuICByZXR1cm4gT2JqZWN0LmFzc2lnbihzdGF0ZSwge1xuICAgIGludmFsaWQ6ICFzdGF0ZS52YWxpZCxcbiAgICBkaXJ0eTogIXN0YXRlLnByaXN0aW5lLFxuICAgIHVudG91Y2hlZDogIXN0YXRlLnRvdWNoZWRcbiAgfSk7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsRm9ybUVsZW1lbnQ7XG4iLCJ2YXIgU3RhdGVmdWxGb3JtRWxlbWVudCA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtZm9ybS1lbGVtZW50Jyk7XG5cbmZ1bmN0aW9uIFN0YXRlZnVsU2VsZWN0ICgpIHtcbiAgU3RhdGVmdWxGb3JtRWxlbWVudC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xufVxuXG52YXIgUHJvdG8gPSBTdGF0ZWZ1bFNlbGVjdC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0YXRlZnVsRm9ybUVsZW1lbnQucHJvdG90eXBlKTtcblxuUHJvdG8uYmluZEV2ZW50cyA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB0aGlzLnVwZGF0ZVZhbHVlLmJpbmQodGhpcykpO1xufTtcblxuUHJvdG8udXBkYXRlVmFsdWUgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuc2V0U3RhdGUoeyB2YWx1ZTogdGhpcy5nZXRWYWx1ZSgpLCBwcmlzdGluZTogZmFsc2UsIHRvdWNoZWQ6IHRydWUgfSk7XG59O1xuXG5Qcm90by5pc1ZhbGlkID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4gISF0aGlzLmVsLnZhbHVlO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZWZ1bFNlbGVjdDtcbiIsInZhciBTdGF0ZWZ1bEZvcm1FbGVtZW50ID0gcmVxdWlyZSgnLi9zdGF0ZWZ1bC1mb3JtLWVsZW1lbnQnKTtcblxuZnVuY3Rpb24gU3RhdGVmdWxUZXh0SW5wdXQgKCkge1xuICBTdGF0ZWZ1bEZvcm1FbGVtZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbnZhciBQcm90byA9IFN0YXRlZnVsVGV4dElucHV0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxGb3JtRWxlbWVudC5wcm90b3R5cGUpO1xuXG5Qcm90by5iaW5kRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICB2YXIgdXBkYXRlVmFsdWUgPSB0aGlzLnVwZGF0ZVZhbHVlLmJpbmQodGhpcyk7XG5cbiAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdrZXl1cCcsIHVwZGF0ZVZhbHVlKTtcbiAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdjaGFuZ2UnLCB1cGRhdGVWYWx1ZSk7XG5cbiAgdGhpcy5lbC5hZGRFdmVudExpc3RlbmVyKCdibHVyJywgZnVuY3Rpb24gb25CbHVyICgpIHtcbiAgICB0aGlzLnNldFN0YXRlKHsgdG91Y2hlZDogdHJ1ZSB9KTtcbiAgfS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLnVwZGF0ZVZhbHVlID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLnNldFN0YXRlKHsgdmFsdWU6IHRoaXMuZ2V0VmFsdWUoKSwgcHJpc3RpbmU6IGZhbHNlIH0pO1xufTtcblxuUHJvdG8uY29tcHV0ZWRTdGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuICBzdGF0ZS52YWxpZCA9IHRoaXMuaXNWYWxpZCgpO1xuXG4gIHJldHVybiBPYmplY3QuYXNzaWduKHN0YXRlLCB7XG4gICAgaW52YWxpZDogIXN0YXRlLnZhbGlkLFxuICAgIGRpcnR5OiAhc3RhdGUucHJpc3RpbmUsXG4gICAgdW50b3VjaGVkOiAhc3RhdGUudG91Y2hlZFxuICB9KTtcbn07XG5cblByb3RvLmdldFZhbGlkYXRpb25SdWxlcyA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIHJ1bGVzID0gW107XG4gIHZhciByZXF1aXJlZCA9IHRoaXMuZWwuaGFzQXR0cmlidXRlKCdyZXF1aXJlZCcpO1xuICB2YXIgbWluID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ21pbicpO1xuICB2YXIgbWF4ID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ21heCcpO1xuICB2YXIgbWF4bGVuZ3RoID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ21heGxlbmd0aCcpO1xuICB2YXIgbWlubGVuZ3RoID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ21pbmxlbmd0aCcpO1xuICB2YXIgcGF0dGVybiA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdwYXR0ZXJuJyk7XG5cbiAgaWYgKHJlcXVpcmVkKSB7XG4gICAgcnVsZXMucHVzaChmdW5jdGlvbiByZXF1aXJlZCAodmFsKSB7XG4gICAgICByZXR1cm4gdmFsLmxlbmd0aCA+IDA7XG4gICAgfSk7XG4gIH1cblxuICBpZiAobWluICE9PSBudWxsKSB7XG4gICAgcnVsZXMucHVzaChmdW5jdGlvbiBtaW4gKHZhbCkge1xuICAgICAgcmV0dXJuIHZhbCA+PSBtaW47XG4gICAgfSk7XG4gIH1cblxuICBpZiAobWF4ICE9PSBudWxsKSB7XG4gICAgcnVsZXMucHVzaChmdW5jdGlvbiBtYXggKHZhbCkge1xuICAgICAgcmV0dXJuIHZhbCA8PSBtYXg7XG4gICAgfSk7XG4gIH1cblxuICBpZiAobWlubGVuZ3RoICE9PSBudWxsKSB7XG4gICAgcnVsZXMucHVzaChmdW5jdGlvbiBtaW5sZW5ndGggKHZhbCkge1xuICAgICAgcmV0dXJuIHZhbC5sZW5ndGggPj0gbWlubGVuZ3RoO1xuICAgIH0pO1xuICB9XG5cbiAgaWYgKG1heGxlbmd0aCAhPT0gbnVsbCkge1xuICAgIHJ1bGVzLnB1c2goZnVuY3Rpb24gbWF4bGVuZ3RoICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwubGVuZ3RoIDw9IG1heGxlbmd0aDtcbiAgICB9KTtcbiAgfVxuXG4gIGlmIChwYXR0ZXJuICE9PSBudWxsKSB7XG4gICAgcnVsZXMucHVzaChmdW5jdGlvbiBwYXR0ZXJuICh2YWwpIHtcbiAgICAgIHJldHVybiB2YWwubWF0Y2gobmV3IFJlZ0V4cChwYXR0ZXJuKSk7XG4gICAgfSk7XG4gIH1cblxuICByZXR1cm4gcnVsZXM7XG59O1xuXG5Qcm90by5pc1ZhbGlkID0gZnVuY3Rpb24gKCkge1xuICB2YXIgdmFsID0gdGhpcy5lbC52YWx1ZS50cmltKCk7XG4gIC8vIEdldCB2YWxpZGF0aW9uIHJ1bGVzIGlzIGFsd2F5cyBjYWxsZWQgdG8gYWxsb3cgY2hhbmdpbmcgb2YgcHJvcGVydGllc1xuICB2YXIgcnVsZXMgPSB0aGlzLmdldFZhbGlkYXRpb25SdWxlcygpO1xuICB2YXIgaXNWYWxpZCA9IHRydWU7XG5cbiAgaWYgKHRoaXMuZWwuZ2V0QXR0cmlidXRlKCd0eXBlJykgPT09ICdlbWFpbCcpIHtcbiAgICBpc1ZhbGlkID0gKHZhbC5pbmRleE9mKCdAJykgPiAwKSAmJiB2YWwubGVuZ3RoID4gMjtcbiAgfVxuXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcnVsZXMubGVuZ3RoOyBpKyspIHtcbiAgICBpc1ZhbGlkID0gcnVsZXNbaV0odmFsKSAmJiBpc1ZhbGlkO1xuICAgIGlmICghaXNWYWxpZCkgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgcmV0dXJuIGlzVmFsaWQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsVGV4dElucHV0O1xuIiwidmFyIFN0YXRlZnVsT2JqZWN0ID0gcmVxdWlyZSgnLi9zdGF0ZWZ1bC1vYmplY3QnKTtcbnZhciBTdGF0ZWZ1bFRleHRJbnB1dCA9IHJlcXVpcmUoJy4vZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC10ZXh0LWlucHV0Jyk7XG52YXIgU3RhdGVmdWxTZWxlY3QgPSByZXF1aXJlKCcuL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtc2VsZWN0Jyk7XG52YXIgU3RhdGVmdWxDaGVja2JveCA9IHJlcXVpcmUoJy4vZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1jaGVja2JveCcpO1xuXG5mdW5jdGlvbiBTdGF0ZWZ1bEZvcm0gKGVsKSB7XG4gIHRoaXMuZWwgPSBlbDtcbiAgdGhpcy5pbml0KCk7XG4gIFN0YXRlZnVsT2JqZWN0LmNhbGwodGhpcyk7XG4gIHRoaXMuYmluZEV2ZW50cygpO1xufVxuXG52YXIgUHJvdG8gPSBTdGF0ZWZ1bEZvcm0ucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bE9iamVjdC5wcm90b3R5cGUpO1xuXG4vKipcbiAqIEhhbmRsZSBzdGF0ZSBjaGFuZ2VzIGJ5IGZvcm0gZWxlbWVudHNcbiAqL1xuUHJvdG8uaGFuZGxlRm9ybUVsZW1lbnRTdGF0ZUNoYW5nZSA9IGZ1bmN0aW9uIChzdGF0ZSwgcGFydGlhbFN0YXRlLCBrZXkpIHtcbiAgdmFyIG5ld1N0YXRlID0ge307XG4gIG5ld1N0YXRlW2tleV0gPSBzdGF0ZTtcbiAgdGhpcy5zZXRTdGF0ZShuZXdTdGF0ZSwga2V5KTtcbn07XG5cblByb3RvLnNldEZvcm1TdGF0ZSA9IGZ1bmN0aW9uIChuZXdTdGF0ZSkge1xuICB0aGlzLnNldFN0YXRlKHsgZm9ybTogT2JqZWN0LmFzc2lnbih7fSwgdGhpcy5zdGF0ZS5mb3JtLCBuZXdTdGF0ZSkgfSwgJ2Zvcm0nKTtcbn07XG5cblByb3RvLmNvbXB1dGVkU3RhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgZm9yICh2YXIgcHJvcCBpbiBzdGF0ZSkge1xuICAgIGlmIChzdGF0ZS5oYXNPd25Qcm9wZXJ0eShwcm9wKSAmJiBwcm9wICE9PSAnZm9ybScpIHtcbiAgICAgIHN0YXRlLmZvcm0ucHJpc3RpbmUgPSBzdGF0ZVtwcm9wXS5wcmlzdGluZSAmJiBzdGF0ZS5mb3JtLnByaXN0aW5lO1xuICAgICAgc3RhdGUuZm9ybS52YWxpZCA9IHN0YXRlW3Byb3BdLnZhbGlkICYmIHN0YXRlLmZvcm0udmFsaWQ7XG4gICAgICBzdGF0ZS5mb3JtLnRvdWNoZWQgPSBzdGF0ZVtwcm9wXS50b3VjaGVkICYmIHN0YXRlLmZvcm0udG91Y2hlZDtcbiAgICB9XG4gIH1cblxuICBPYmplY3QuYXNzaWduKHN0YXRlLmZvcm0sIHtcbiAgICBpbnZhbGlkOiAhc3RhdGUuZm9ybS52YWxpZCxcbiAgICBkaXJ0eTogIXN0YXRlLmZvcm0ucHJpc3RpbmUsXG4gICAgdW50b3VjaGVkOiAhc3RhdGUuZm9ybS50b3VjaGVkXG4gIH0pO1xuXG4gIHJldHVybiBzdGF0ZTtcbn07XG5cblByb3RvLmluaXQgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuZm9ybUVsZW1lbnRzID0gW107XG5cbiAgQXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCh0aGlzLmVsLmVsZW1lbnRzLCBmdW5jdGlvbiAoZmllbGQpIHtcbiAgICB2YXIgbmFtZSA9IGZpZWxkLm5hbWU7XG4gICAgdmFyIHR5cGUgPSBmaWVsZC50eXBlO1xuXG4gICAgaWYgKCFuYW1lKSByZXR1cm47XG4gICAgaWYgKGZpZWxkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT0gJ2ZpZWxkc2V0JykgcmV0dXJuO1xuICAgIGlmICh0eXBlID09ICdzdWJtaXQnKSByZXR1cm47XG4gICAgaWYgKHR5cGUgPT0gJ3Jlc2V0JykgcmV0dXJuO1xuICAgIGlmICh0eXBlID09ICdidXR0b24nKSByZXR1cm47XG4gICAgaWYgKHR5cGUgPT0gJ2ZpbGUnKSByZXR1cm47XG5cbiAgICB2YXIgZm9ybUVsZW1lbnQgPSBjcmVhdGVTdGF0ZWZ1bEZvcm1FbGVtZW50KGZpZWxkKTtcbiAgICBpZiAoZm9ybUVsZW1lbnQgIT09IHVuZGVmaW5lZCkge1xuICAgICAgdGhpcy5mb3JtRWxlbWVudHMucHVzaChmb3JtRWxlbWVudCk7XG4gICAgfVxuICB9LmJpbmQodGhpcykpO1xufTtcblxuUHJvdG8uZ2V0RGVmYXVsdFN0YXRlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgc3RhdGUgPSB7fTtcbiAgdmFyIGlzVmFsaWQgPSB0cnVlO1xuXG4gIEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLmNhbGwodGhpcy5mb3JtRWxlbWVudHMsIGZ1bmN0aW9uIChmb3JtRWxlbWVudCkge1xuICAgIGZvcm1FbGVtZW50Lm9uU3RhdGVDaGFuZ2UodGhpcy5oYW5kbGVGb3JtRWxlbWVudFN0YXRlQ2hhbmdlLmJpbmQodGhpcykpO1xuICAgIHN0YXRlW2Zvcm1FbGVtZW50Lm5hbWVdID0gZm9ybUVsZW1lbnQuc3RhdGU7XG4gICAgaXNWYWxpZCA9IGZvcm1FbGVtZW50LnN0YXRlLnZhbGlkICYmIGlzVmFsaWQ7XG4gIH0uYmluZCh0aGlzKSk7XG5cbiAgcmV0dXJuIE9iamVjdC5hc3NpZ24oe1xuICAgIGZvcm06IHtcbiAgICAgIHN1Ym1pdHRlZDogZmFsc2UsXG4gICAgICBwcmlzdGluZTogdHJ1ZSxcbiAgICAgIHZhbGlkOiBpc1ZhbGlkXG4gICAgfVxuICB9LCBzdGF0ZSk7XG59O1xuXG5Qcm90by5iaW5kRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ3N1Ym1pdCcsIGZ1bmN0aW9uIChlKSB7XG4gICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIHRoaXMuc3VibWl0KCk7XG4gIH0uYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by5zdWJtaXQgPSBmdW5jdGlvbiAoKSB7XG4gIHZhciBhY3Rpb24gPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnYWN0aW9uJyk7XG4gIHRoaXMuc2V0Rm9ybVN0YXRlKHsgc3VibWl0dGVkOiB0cnVlIH0pO1xuICBkb1JlcXVlc3QoYWN0aW9uLCB0aGlzLnNlcmlhbGl6ZSgpKTtcbn07XG5cbi8vIFByaXZhdGVcblxuZnVuY3Rpb24gY3JlYXRlU3RhdGVmdWxGb3JtRWxlbWVudCAoZmllbGQpIHtcbiAgc3dpdGNoIChmaWVsZC50eXBlKSB7XG4gICAgY2FzZSAndGV4dGFyZWEnOiByZXR1cm4gbmV3IFN0YXRlZnVsVGV4dElucHV0KGZpZWxkKTtcbiAgICBjYXNlICd0ZXh0JzogcmV0dXJuIG5ldyBTdGF0ZWZ1bFRleHRJbnB1dChmaWVsZCk7XG4gICAgY2FzZSAnZW1haWwnOiByZXR1cm4gbmV3IFN0YXRlZnVsVGV4dElucHV0KGZpZWxkKTtcbiAgICBjYXNlICdjaGVja2JveCc6IHJldHVybiBuZXcgU3RhdGVmdWxDaGVja2JveChmaWVsZCk7XG4gICAgZGVmYXVsdDpcbiAgICAgIGlmIChmaWVsZC5ub2RlTmFtZS50b0xvd2VyQ2FzZSgpID09PSAnc2VsZWN0Jykge1xuICAgICAgICByZXR1cm4gbmV3IFN0YXRlZnVsU2VsZWN0KGZpZWxkKTtcbiAgICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBkb1JlcXVlc3QgKGFjdGlvbiwgZGF0YSkge1xuICB2YXIgcmVxdWVzdCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuICByZXF1ZXN0Lm9wZW4oJ1BPU1QnLCBhY3Rpb24sIHRydWUpO1xuICByZXF1ZXN0LnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi94LXd3dy1mb3JtLXVybGVuY29kZWQ7IGNoYXJzZXQ9VVRGLTgnKTtcbiAgcmVxdWVzdC5zZW5kKGRhdGEpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsRm9ybTtcbiIsImZ1bmN0aW9uIFN0YXRlZnVsT2JqZWN0ICgpIHtcbiAgdGhpcy5saXN0ZW5lcnMgPSBbXTtcbiAgdGhpcy5zZXRTdGF0ZSh0aGlzLmdldERlZmF1bHRTdGF0ZSgpKTtcbn1cblxudmFyIFByb3RvID0gU3RhdGVmdWxPYmplY3QucHJvdG90eXBlO1xuXG5Qcm90by5vblN0YXRlQ2hhbmdlID0gZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG4gIHRoaXMubGlzdGVuZXJzLnB1c2gobGlzdGVuZXIpO1xuICByZXR1cm4gdGhpcztcbn07XG5cblByb3RvLnRyaWdnZXJTdGF0ZUNoYW5nZSA9IGZ1bmN0aW9uIChwYXJ0aWFsTmV3U3RhdGUsIGtleSkge1xuICB0aGlzLmxpc3RlbmVycy5mb3JFYWNoKGZ1bmN0aW9uIChsaXN0ZW5lcikge1xuICAgIGxpc3RlbmVyKHRoaXMuc3RhdGUsIHBhcnRpYWxOZXdTdGF0ZSwga2V5LCB0aGlzKTtcbiAgfS5iaW5kKHRoaXMpKTtcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vKipcbiAqIEBwYXJhbSB7T2JqZWN0fSBwYXJ0aWFsTmV3U3RhdGVcbiAqIEBwYXJhbSB7P1N0cmluZ30ga2V5XG4gKi9cblByb3RvLnNldFN0YXRlID0gZnVuY3Rpb24gKHBhcnRpYWxOZXdTdGF0ZSwga2V5KSB7XG4gIHZhciBuYW1lID0ga2V5IHx8IHRoaXMubmFtZTtcbiAgdmFyIG9sZFN0YXRlID0gdGhpcy5zdGF0ZSB8fCB7fTtcbiAgdGhpcy5zdGF0ZSA9IHRoaXMuY29tcHV0ZWRTdGF0ZShPYmplY3QuYXNzaWduKHt9LCB0aGlzLnN0YXRlLCBwYXJ0aWFsTmV3U3RhdGUpKTtcbiAgaWYgKEpTT04uc3RyaW5naWZ5KG9sZFN0YXRlW2tleV0pICE9PSBKU09OLnN0cmluZ2lmeShwYXJ0aWFsTmV3U3RhdGUpKSB7XG4gICAgdGhpcy50cmlnZ2VyU3RhdGVDaGFuZ2UocGFydGlhbE5ld1N0YXRlLCBuYW1lKTtcbiAgfVxuICByZXR1cm4gdGhpcztcbn07XG5cblByb3RvLmNvbXB1dGVkU3RhdGUgPSBmdW5jdGlvbiAoc3RhdGUpIHtcbiAgcmV0dXJuIHN0YXRlO1xufTtcblxuUHJvdG8uZ2V0RGVmYXVsdFN0YXRlID0gZnVuY3Rpb24gKCkge1xuICByZXR1cm4ge307XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsT2JqZWN0O1xuIiwiLy8gSUU4K1xuZnVuY3Rpb24gcmVtb3ZlQ2xhc3MgKGVsLCBjbGFzc05hbWUpIHtcbiAgaWYgKGVsLmNsYXNzTGlzdCkge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5jbGFzc05hbWUgPSBlbC5jbGFzc05hbWUucmVwbGFjZShuZXcgUmVnRXhwKCcoXnxcXFxcYiknICsgY2xhc3NOYW1lLnNwbGl0KCcgJykuam9pbignfCcpICsgJyhcXFxcYnwkKScsICdnaScpLCAnICcpO1xuICB9XG59XG5cbi8vIElFOCtcbmZ1bmN0aW9uIGFkZENsYXNzIChlbCwgY2xhc3NOYW1lKSB7XG4gIGlmIChlbC5jbGFzc0xpc3QpIHtcbiAgICBlbC5jbGFzc0xpc3QuYWRkKGNsYXNzTmFtZSk7XG4gIH0gZWxzZSB7XG4gICAgZWwuY2xhc3NOYW1lICs9ICcgJyArIGNsYXNzTmFtZTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVDbGFzcyAoZWwsIGNsYXNzTmFtZSwgaXNBcHBsaWVkKSB7XG4gIGlmIChpc0FwcGxpZWQpIHtcbiAgICBhZGRDbGFzcyhlbCwgY2xhc3NOYW1lKTtcbiAgfSBlbHNlIHtcbiAgICByZW1vdmVDbGFzcyhlbCwgY2xhc3NOYW1lKTtcbiAgfVxufVxuXG5mdW5jdGlvbiB0b2dnbGVBdHRyaWJ1dGUgKGVsLCBhdHRyTmFtZSwgaXNBcHBsaWVkKSB7XG4gIGlmIChpc0FwcGxpZWQpIHtcbiAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ck5hbWUsIGF0dHJOYW1lKTtcbiAgfSBlbHNlIHtcbiAgICBlbC5yZW1vdmVBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICB9XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICB0b2dnbGVDbGFzczogdG9nZ2xlQ2xhc3MsXG4gIHJlbW92ZUNsYXNzOiByZW1vdmVDbGFzcyxcbiAgYWRkQ2xhc3M6IGFkZENsYXNzLFxuICB0b2dnbGVBdHRyaWJ1dGU6IHRvZ2dsZUF0dHJpYnV0ZVxufTtcbiIsIi8vIFNvbWUgYnJvd3NlcnMgZG8gbm90IHN1cHBvcnQgT2JqZWN0LmNyZWF0ZVxuaWYgKHR5cGVvZiBPYmplY3QuY3JlYXRlID09PSAndW5kZWZpbmVkJykge1xuXHRPYmplY3QuY3JlYXRlID0gZnVuY3Rpb24ocHJvdG90eXBlKSB7XG5cdFx0ZnVuY3Rpb24gQygpIHt9XG5cdFx0Qy5wcm90b3R5cGUgPSBwcm90b3R5cGU7XG5cdFx0cmV0dXJuIG5ldyBDKCk7XG5cdH1cbn1cbiIsIid1c2Ugc3RyaWN0Jztcbi8qKlxuICogU3RhdGVmdWwgZm9ybXNcbiAqIC0tLVxuICogQXV0aG9yOiBKZXJvZW4gUmFuc2lqblxuICogTGljZW5zZTogTUlUXG4gKi9cbnJlcXVpcmUoJy4vcG9seWZpbGxzL29iamVjdC1jcmVhdGUnKTtcbnZhciBTdGF0ZWZ1bEZvcm0gPSByZXF1aXJlKCcuL2xpYi9zdGF0ZWZ1bC1mb3JtJyk7XG52YXIgRGlyZWN0aXZlc01hbmFnZXIgPSByZXF1aXJlKCcuL2xpYi9kaXJlY3RpdmVzL2RpcmVjdGl2ZXMtbWFuYWdlcicpO1xuXG5nbG9iYWwuY3JlYXRlU3RhdGVmdWxGb3JtcyA9IGZ1bmN0aW9uIGNyZWF0ZVN0YXRlZnVsRm9ybXMgKCkge1xuICB2YXIgZm9ybXMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKCdmb3JtW3N0YXRlZnVsXScpO1xuXG4gIC8vIElFOSsgTm9kZUxpc3QgaXRlcmF0aW9uXG4gIHJldHVybiBBcnJheS5wcm90b3R5cGUubWFwLmNhbGwoZm9ybXMsIGZ1bmN0aW9uIChmb3JtKSB7XG4gICAgdmFyIG1hbmFnZXIgPSBuZXcgRGlyZWN0aXZlc01hbmFnZXIoZm9ybSk7XG4gICAgcmV0dXJuIG5ldyBTdGF0ZWZ1bEZvcm0oZm9ybSkub25TdGF0ZUNoYW5nZShmdW5jdGlvbiAoc3RhdGUsIHBhcnRpYWxTdGF0ZSwga2V5KSB7XG4gICAgICBjb25zb2xlLmxvZygnZm9ybTpzdGF0ZUNoYW5nZScsIGtleSwgc3RhdGUpO1xuICAgICAgaWYgKGtleSkge1xuICAgICAgICBtYW5hZ2VyLnBhdGNoKGtleSwgc3RhdGUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgbWFuYWdlci51cGRhdGUoc3RhdGUpO1xuICAgICAgfVxuICAgIH0pLnRyaWdnZXJTdGF0ZUNoYW5nZSgpO1xuICB9KTtcbn1cbiJdfQ==

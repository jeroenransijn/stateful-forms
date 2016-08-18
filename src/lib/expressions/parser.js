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

    // TODO: there are edges cases here when using split
    input.split(';').forEach(function (exp) {
      var keySeparatorIndex = exp.indexOf(':');
      obj[exp.substring(0, keySeparatorIndex)] = parse(exp.substring(keySeparatorIndex + 1).trim());
    }.bind(this));

    return obj;
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
  this.tokens = lexer.lex(input);
}

ParserImplementation.prototype = {

  peek: function () {
    return (this.index < this.tokens.length) ? this.tokens[this.index] : EOF;
  },

  parse: function () {
    return this.parseExpression();
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

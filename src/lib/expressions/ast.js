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

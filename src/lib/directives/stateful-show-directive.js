var StatefulDirective = require('./stateful-directive');
var CompoundBooleanExpression = require('../expressions/compound-boolean-expression');

var Cls = function StatefulShowDirective (el) {
  StatefulDirective.apply(this, [el, CompoundBooleanExpression]);
};

var Proto = Cls.prototype = Object.create(StatefulDirective.prototype);

Proto.ATTRIBUTE = 'sf-show';

Proto.update = function (state) {
  console.log('update');
  if (this.expression.isMatched(state)) {
    this.el.style.display = '';
  } else {
    this.el.style.display = 'none';
  }
};

module.exports = Cls;

var StatefulDirective = require('./stateful-directive');
var ValueExpression = require('../expressions/value-expression');

var Cls = function StatefulTextDirective (el) {
	StatefulDirective.apply(this, [el, ValueExpression]);
};

var Proto = Cls.prototype = Object.create(StatefulDirective.prototype);

Proto.ATTRIBUTE = 'sf-text';

Proto.update = function (state) {
	this.el.innerHTML = this.expression.getValue(state);
};

module.exports = Cls;

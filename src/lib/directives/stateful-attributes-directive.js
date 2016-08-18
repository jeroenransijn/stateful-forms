var utils = require('../utils');
var StatefulDirective = require('./stateful-directive');
var ObjectExpression = require('../expressions/object-expression');

var Cls = function StatefulClassDirective (el) {
  StatefulDirective.apply(this, [el, ObjectExpression]);
};

var Proto = Cls.prototype = Object.create(StatefulDirective.prototype);

Proto.ATTRIBUTE = 'sf-attributes';

Proto.update = function (state) {
  var matchedObject = this.expression.getMatched(state);

  Object.keys(matchedObject).forEach(function (key) {
    utils.toggleAttribute(this.el, key, matchedObject[key]);
  }.bind(this));
};

module.exports = Cls;

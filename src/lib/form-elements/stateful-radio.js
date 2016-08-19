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

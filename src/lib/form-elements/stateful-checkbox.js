var StatefulFormElement = require('./stateful-form-element');

var Cls = function StatefulCheckbox () {
  StatefulFormElement.apply(this, arguments);
};

var Proto = Cls.prototype = Object.create(StatefulFormElement.prototype);

Proto.bindEvents = function () {
  this.el.addEventListener('change', this.updateValue.bind(this));
};

Proto.updateValue = function () {
  console.log('checkbox', this.getValue());
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

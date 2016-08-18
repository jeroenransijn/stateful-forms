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

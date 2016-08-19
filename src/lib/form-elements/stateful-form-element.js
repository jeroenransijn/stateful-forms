var StatefulObject = require('../stateful-object');
var reflectState = require('../utils').reflectState;

function StatefulFormElement (el) {
  this.el = el;
  this.name = this.el.getAttribute('name');
  StatefulObject.call(this);
  this.onStateChange(reflectState.bind(null, this.el));
  this.bindEvents();
  this.triggerStateChange();
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

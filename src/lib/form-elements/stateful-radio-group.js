var StatefulObject = require('../stateful-object');

var Cls = function StatefulRadioGroup (name) {
  this.name = name;
  this.radios = [];
  this.required = false;
  this.handleRadioStateChange = this.handleRadioStateChange.bind(this);
  StatefulObject.apply(this, arguments);
};

var Proto = Cls.prototype = Object.create(StatefulObject.prototype);

/**
 * @param {StatefulRadio} radio
 */
Proto.addRadio = function (radio) {
  radio.index = this.radios.length;
  this.required = this.required || radio.el.hasAttribute('required');
  this.radios.push(radio);
  radio.onStateChange(this.handleRadioStateChange);
}

Proto.triggerRadiosStateChange = function () {
  this.radios.forEach(function (radio) {
    radio.triggerStateChange();
  });
};

Proto.getDefaultState = function () {
  // This is actually not so important since all children will be
  return {
    pristine: true,
    valid: false,
    touched: false
  };
};

Proto.handleRadioStateChange = function (state, partialState, key, obj) {
  var isValid = !this.required || (this.state.valid || state.valid);
  var isPristine = this.state.pristine && state.pristine;
  var isTouched = this.state.touched || state.touched;

  this.setState({
    valid: isValid,
    invalid: !isValid,
    pristine: isPristine,
    dirty: !isPristine,
    touched: isTouched,
    untouched: !isTouched
  }, this.name);
};


module.exports = Cls;

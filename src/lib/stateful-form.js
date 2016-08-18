var StatefulObject = require('./stateful-object');
var StatefulTextInput = require('./form-elements/stateful-text-input');
var StatefulSelect = require('./form-elements/stateful-select');
var StatefulCheckbox = require('./form-elements/stateful-checkbox');

function StatefulForm (el) {
  this.el = el;
  this.init();
  StatefulObject.call(this);
  this.bindEvents();
}

var Proto = StatefulForm.prototype = Object.create(StatefulObject.prototype);

/**
 * Handle state changes by form elements
 */
Proto.handleFormElementStateChange = function (state, partialState, key) {
  var newState = {};
  newState[key] = state;
  this.setState(newState, key);
};

Proto.setFormState = function (newState) {
  this.setState({ form: Object.assign({}, this.state.form, newState) }, 'form');
};

Proto.computedState = function (state) {
  for (var prop in state) {
    if (state.hasOwnProperty(prop) && prop !== 'form') {
      state.form.pristine = state[prop].pristine && state.form.pristine;
      state.form.valid = state[prop].valid && state.form.valid;
      state.form.touched = state[prop].touched && state.form.touched;
    }
  }

  Object.assign(state.form, {
    invalid: !state.form.valid,
    dirty: !state.form.pristine,
    untouched: !state.form.touched
  });

  return state;
};

Proto.init = function () {
  this.formElements = [];

  Array.prototype.forEach.call(this.el.elements, function (field) {
    var name = field.name;
    var type = field.type;

    if (!name) return;
    if (field.nodeName.toLowerCase() == 'fieldset') return;
    if (type == 'submit') return;
    if (type == 'reset') return;
    if (type == 'button') return;
    if (type == 'file') return;

    var formElement = createStatefulFormElement(field);
    if (formElement !== undefined) {
      this.formElements.push(formElement);
    }
  }.bind(this));
};

Proto.getDefaultState = function () {
  var state = {};
  var isValid = true;

  Array.prototype.forEach.call(this.formElements, function (formElement) {
    formElement.onStateChange(this.handleFormElementStateChange.bind(this));
    state[formElement.name] = formElement.state;
    isValid = formElement.state.valid && isValid;
  }.bind(this));

  return Object.assign({
    form: {
      submitted: false,
      pristine: true,
      valid: isValid
    }
  }, state);
};

Proto.bindEvents = function () {
  this.el.addEventListener('submit', function (e) {
    e.preventDefault();
    this.submit();
  }.bind(this));
};

Proto.submit = function () {
  var action = this.el.getAttribute('action');
  this.setFormState({ submitted: true });
  doRequest(action, this.serialize());
};

// Private

function createStatefulFormElement (field) {
  switch (field.type) {
    case 'textarea': return new StatefulTextInput(field);
    case 'text': return new StatefulTextInput(field);
    case 'email': return new StatefulTextInput(field);
    case 'checkbox': return new StatefulCheckbox(field);
    default:
      if (field.nodeName.toLowerCase() === 'select') {
        return new StatefulSelect(field);
      }
  }
}

function doRequest (action, data) {
  var request = new XMLHttpRequest();
  request.open('POST', action, true);
  request.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
  request.send(data);
}

module.exports = StatefulForm;

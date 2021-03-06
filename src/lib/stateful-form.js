var StatefulObject = require('./stateful-object');
var StatefulTextInput = require('./form-elements/stateful-text-input');
var StatefulSelect = require('./form-elements/stateful-select');
var StatefulCheckbox = require('./form-elements/stateful-checkbox');
var StatefulRadio = require('./form-elements/stateful-radio');
var StatefulRadioGroup = require('./form-elements/stateful-radio-group');

function StatefulForm (el) {
  this.el = el;
  this.handleFormElementStateChange = this.handleFormElementStateChange.bind(this)
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
  this.setState({ $form: Object.assign({}, this.state.$form, newState) }, '$form');
};

Proto.computedState = function (state) {
  var isValid = true;
  var isPristine = state.$form.pristine;
  var isTouched = state.$form.touched;

  Object.keys(state).forEach(function (key) {
    if (key.indexOf('$') === 0) return;

    var prop = state[key];

    if (isValid && prop.hasOwnProperty('valid')) {
      isValid = prop.valid;
    }

    if (isPristine && prop.hasOwnProperty('pristine')) {
      isPristine = prop.pristine;
    }

    if (prop.hasOwnProperty('touched')) {
      isTouched = isTouched || prop.touched;
    }
  });

  Object.assign(state.$form, {
    valid: isValid,
    pristine: isPristine,
    touched: isTouched,
    invalid: !isValid,
    dirty: !isPristine,
    untouched: !isTouched
  });

  return state;
};

Proto.init = function () {
  this.formElements = [];
  this.radioGroups = {};

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

    if (formElement instanceof StatefulRadio) {
      if (this.radioGroups.hasOwnProperty(name)) {
        this.radioGroups[name].addRadio(formElement);
      } else {
        this.radioGroups[name] = new StatefulRadioGroup(name);
        this.radioGroups[name].addRadio(formElement);
      }
    } else if (formElement !== undefined) {
      this.formElements.push(formElement);
    }
  }.bind(this));

  Object.keys(this.radioGroups).forEach(function (name) {
    this.radioGroups[name].triggerRadiosStateChange();
    this.formElements.push(this.radioGroups[name]);
  }.bind(this));
};

Proto.getDefaultState = function () {
  var state = {};
  var isValid = true;

  Array.prototype.forEach.call(this.formElements, function (formElement) {
    formElement.onStateChange(this.handleFormElementStateChange);
    state[formElement.name] = formElement.state;
    isValid = formElement.state.valid && isValid;
  }.bind(this));

  return Object.assign({
    $form: {
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

function serialize (state) {
  var result = [];

  Object.keys(state).forEach(function (key) {
    if (key.indexOf('$') === -1) {
      result.push(encodeURIComponent(key) + '=' + encodeURIComponent(state[key].value));
    }
  });

  return result.join('&');
}

function serializeJSON (state) {
  var obj = {};

  Object.keys(state).forEach(function (key) {
    if (key.indexOf('$') === -1) {
      obj[key] = state[key].value;
    }
  });

  return JSON.stringify(obj);
}

Proto.submit = function () {
  var action = this.el.getAttribute('action');
  var enctype = this.el.getAttribute('enctype') || 'application/x-www-form-urlencoded; charset=UTF-8';

  if (this.state.hasOwnProperty('$response')) {
    this.setState({ $response: undefined });
  }

  if (!this.state.$form.submitted) {
    this.setFormState({ submitted: true });
  }

  if (this.state.$form.invalid) return;

  this.setState({
    $request: Object.assign({}, this.state.$request, {
      pending: true
    })
  });

  var request = new XMLHttpRequest();
  request.open('POST', action, true);
  request.setRequestHeader('Content-Type', enctype);

  request.onload = function () {
    if (request.status >= 200 && request.status < 400) {

      var json;
      try {
        json = JSON.parse(request.responseText);
      } catch (e) {
        json = {};
      }

      this.setState({
        $request: {
          success: true,
          pending: false,
          failed: false,
          error: false,
          status: request.status
        },
        $response: {
          json: json,
          text: request.responseText
        }
      });
    } else {
      this.setState({
        $request: {
          pending: false,
          success: false,
          failed: true,
          error: false,
          status: request.status
        }
      });
    }
  }.bind(this);

  request.onerror = function () {
    this.setState({
      $request: {
        pending: false,
        success: false,
        failed: false,
        error: true,
        status: request.status
      }
    });
  };

  if (enctype === 'application/json') {
    request.send(serializeJSON(this.state));
  } else {
    request.send(serialize(this.state));
  }

};

// Private

function createStatefulFormElement (field) {
  var type = field.getAttribute('sf-element')
          || field.type
          || field.nodeName.toLowerCase();

  switch (type) {
    case 'textarea':
    case 'password':
    case 'text':
    case 'email':
    case 'phone':
    case 'tel':
    case 'hidden':
      return new StatefulTextInput(field);
    case 'checkbox': return new StatefulCheckbox(field);
    case 'radio': return new StatefulRadio(field);
    case 'select-one':
    case 'select':
      return new StatefulSelect(field);
    default:
      console.error('Form element type `' + type + '` not supported by Stateful Forms', field);
  }
}

module.exports = StatefulForm;

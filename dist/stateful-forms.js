(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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

},{"../expressions/object-expression":10,"../utils":18,"./stateful-directive":3}],2:[function(require,module,exports){
var utils = require('../utils');
var StatefulDirective = require('./stateful-directive');
var ObjectExpression = require('../expressions/object-expression');

var Cls = function StatefulClassDirective (el) {
	StatefulDirective.apply(this, [el, ObjectExpression]);
};

var Proto = Cls.prototype = Object.create(StatefulDirective.prototype);

Proto.ATTRIBUTE = 'sf-class';

Proto.update = function (state) {
	var matchedObject = this.expression.getMatched(state);

	Object.keys(matchedObject).forEach(function (key) {
		utils.toggleClass(this.el, key, matchedObject[key]);
	}.bind(this));
};

module.exports = Cls;

},{"../expressions/object-expression":10,"../utils":18,"./stateful-directive":3}],3:[function(require,module,exports){
function StatefulDirective (el, ExpressionClass) {
	this.el = el;
	this.attributeValue = this.el.getAttribute(this.ATTRIBUTE);
	this.expression = new ExpressionClass(this.attributeValue);
}

module.exports = StatefulDirective;

},{}],4:[function(require,module,exports){
var StatefulShowDirective = require('./stateful-show-directive');
var StatefulTextDirective = require('./stateful-text-directive');
var StatefulClassDirective = require('./stateful-class-directive');
var StatefulAttributesDirective = require('./stateful-attributes-directive');

function StatefulDirectives (el) {
	this.el = el;
	this.directives = {};
	this.patchIndex = {};
	this.init();
}

var Proto = StatefulDirectives.prototype;

Proto.init = function () {
	this.queryMap(StatefulShowDirective);
	this.queryMap(StatefulTextDirective);
	this.queryMap(StatefulClassDirective);
	this.queryMap(StatefulAttributesDirective);
};

Proto.queryMap = function (cls) {
	var attr = cls.prototype.ATTRIBUTE;
	Array.prototype.forEach.call(
		this.el.querySelectorAll('[' + attr + ']'), function (el) {
			var directive = new cls(el);

			this.directives[attr] = this.directives[attr] || [];
			this.directives[attr].push(directive);

			directive.expression.getNames().forEach(function (name) {
				this.patchIndex[name] = this.patchIndex[name] || [];
				this.patchIndex[name].push(directive);
			}.bind(this));
		}.bind(this));
};

Proto.patch = function (key, state) {

	console.log('patch', key, state);
	if (this.patchIndex.hasOwnProperty(key)) {
		this.patchIndex[key].forEach(function (directive) {
			directive.update(state);
		});
	}
};

Proto.update = function (state) {
	console.log('update', this.directives);
	Object.keys(this.directives).forEach(function (key) {
		this.directives[key].forEach(function (directive) {
			directive.update(state);
		});
	}.bind(this));
};

module.exports = StatefulDirectives;

},{"./stateful-attributes-directive":1,"./stateful-class-directive":2,"./stateful-show-directive":5,"./stateful-text-directive":6}],5:[function(require,module,exports){
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

},{"../expressions/compound-boolean-expression":9,"./stateful-directive":3}],6:[function(require,module,exports){
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

},{"../expressions/value-expression":11,"./stateful-directive":3}],7:[function(require,module,exports){
var PROPERTY_SEPARATOR = '.';

function BooleanExpression (exp) {
	this.exp = exp.trim();

	var splitExp = this.exp.split(PROPERTY_SEPARATOR);
	this.name = splitExp[0];
	this.prop = splitExp[1];
}

var Proto = BooleanExpression.prototype;

Proto.isMatched = function (state) {
	if (state.hasOwnProperty(this.name)) {
		return state[this.name][this.prop];
	}

	return false;
};

Proto.getNames = function () {
	return [this.name];
};

module.exports = BooleanExpression;

},{}],8:[function(require,module,exports){
var VALUE_SEPARATOR = ' == ';
var INVERTED_VALUE_SEPARATOR = ' != ';
var PROPERTY_SEPARATOR = '.';

function BooleanValueExpression (exp) {
	this.exp = exp.trim();

	var valueSplit;
	if (this.exp.indexOf(VALUE_SEPARATOR) > 0) {
		this.inverted = false;
		valueSplit = this.exp.split(VALUE_SEPARATOR);
	} else if (this.exp.indexOf(INVERTED_VALUE_SEPARATOR) > 0) {
		this.inverted = true;
		valueSplit = this.exp.split(INVERTED_VALUE_SEPARATOR);
	}

	var nameAndPropSplit = valueSplit[0].trim().split(PROPERTY_SEPARATOR);

	this.name = nameAndPropSplit[0];
	this.prop = nameAndPropSplit[1];
	this.value = valueSplit[1];
}

BooleanValueExpression.isApplicable = function (exp) {
	return exp.indexOf(VALUE_SEPARATOR) > 0 || exp.indexOf(INVERTED_VALUE_SEPARATOR) > 0 ;
};

var Proto = BooleanValueExpression.prototype;

Proto.isMatched = function (state) {
	if (state.hasOwnProperty(this.name)) {
		console.log(state[this.name].value === this.value);
		if (state[this.name].value === this.value) return !this.inverted;
	}

	return this.inverted;
};

Proto.getNames = function () {
	return [this.name];
};

module.exports = BooleanValueExpression;

},{}],9:[function(require,module,exports){
var BooleanExpression = require('./boolean-expression');
var BooleanValueExpression = require('./boolean-value-expression');

var AND_SEPARATOR = ' and '; // whitespace is important
var OR_SEPARATOR = ' or '; // whitespace is important

function CompoundBooleanExpression (exp) {
	this.exp = exp.trim();

	if (this.exp.indexOf(OR_SEPARATOR) > 0) {
		this.expressions = this.exp.split(OR_SEPARATOR)
			.map(function (splitExp) {
				return new CompoundBooleanExpression(splitExp);
			});
	} else {
		this.expressions = this.exp.split(AND_SEPARATOR)
			.map(function (splitExp) {
				if (BooleanValueExpression.isApplicable(splitExp)) {
					return new BooleanValueExpression(splitExp);
				}

				return new BooleanExpression(splitExp);
			});
	}

}

var Proto = CompoundBooleanExpression.prototype;

Proto.isMatched = function (state) {
	for (var i = 0; i < this.expressions.length; i++) {
		if (!this.expressions[i].isMatched(state)) return false;
	}

	return true;
};

Proto.getNames = function () {
	var names = [];
	this.expressions.forEach(function (exp) {
		names = names.concat(exp.getNames());
	});
	return names;
};

module.exports = CompoundBooleanExpression;

},{"./boolean-expression":7,"./boolean-value-expression":8}],10:[function(require,module,exports){
var CompoundBooleanExpression = require('./compound-boolean-expression');

var SEPARATOR = ',';
var KEY_SEPARATOR = ':';

function ObjectExpression (exp) {
	this.exp = exp.trim();
	this.expressions = {};

	this.exp.split(SEPARATOR).forEach(function (rawObjExp) {
		var splitObjExp = rawObjExp.split(KEY_SEPARATOR);
		this.expressions[splitObjExp[0]] = new CompoundBooleanExpression(splitObjExp[1]);
	}.bind(this));
}

var Proto = ObjectExpression.prototype;

Proto.getMatched = function (state) {
	var obj = {};

	Object.keys(this.expressions).forEach(function (key) {
		obj[key] = this.expressions[key].isMatched(state);
	}.bind(this));

	return obj;
};

Proto.getNames = function () {
	var names = [];

	Object.keys(this.expressions).forEach(function (key) {
		names = names.concat(this.expressions[key].getNames());
	}.bind(this));

	return names;
};

module.exports = ObjectExpression;

},{"./compound-boolean-expression":9}],11:[function(require,module,exports){
var PROPERTY_SEPARATOR = '.';

function ValueExpression (exp) {
	this.exp = exp.trim();

	var splitExp = this.exp.split(PROPERTY_SEPARATOR);
	this.name = splitExp[0];
}

var Proto = ValueExpression.prototype;

Proto.isMatched = function (state) {
	if (state.hasOwnProperty(this.name)) {
		return !!state[this.name].value;
	}

	return false;
};

Proto.getValue = function (state) {
	if (state.hasOwnProperty(this.name)) {
		return state[this.name].value;
	}
	return '';
};

Proto.getNames = function () {
	return [this.name];
};

module.exports = ValueExpression;

},{}],12:[function(require,module,exports){
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

},{"./stateful-form-element":13}],13:[function(require,module,exports){
var StatefulObject = require('../stateful-object');

function StatefulFormElement (el) {
	this.el = el;
	this.name = this.el.getAttribute('name');
	StatefulObject.call(this);
	this.bindEvents();
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

},{"../stateful-object":17}],14:[function(require,module,exports){
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

},{"./stateful-form-element":13}],15:[function(require,module,exports){
var StatefulFormElement = require('./stateful-form-element');

function StatefulTextInput () {
	StatefulFormElement.apply(this, arguments);
}

var Proto = StatefulTextInput.prototype = Object.create(StatefulFormElement.prototype);

Proto.bindEvents = function () {
	var updateValue = this.updateValue.bind(this);

	this.el.addEventListener('keyup', updateValue);
	this.el.addEventListener('change', updateValue);

	this.el.addEventListener('blur', function onBlur () {
		this.setState({ touched: true });
	}.bind(this));
};

Proto.updateValue = function () {
	this.setState({ value: this.getValue(), pristine: false });
};

Proto.computedState = function (state) {
	state.valid = this.isValid();

	return Object.assign(state, {
		invalid: !state.valid,
		dirty: !state.pristine,
		untouched: !state.touched
	});
};

Proto.getValidationRules = function () {
	var rules = [];
	var required = this.el.hasAttribute('required');
	var min = this.el.getAttribute('min');
	var max = this.el.getAttribute('max');
	var maxlength = this.el.getAttribute('maxlength');
	var minlength = this.el.getAttribute('minlength');
	var pattern = this.el.getAttribute('pattern');

	if (required) {
		rules.push(function required (val) {
			return val.length > 0;
		});
	}

	if (min !== null) {
		rules.push(function min (val) {
			return val >= min;
		});
	}

	if (max !== null) {
		rules.push(function max (val) {
			return val <= max;
		});
	}

	if (minlength !== null) {
		rules.push(function minlength (val) {
			return val.length >= minlength;
		});
	}

	if (maxlength !== null) {
		rules.push(function maxlength (val) {
			return val.length <= maxlength;
		});
	}

	if (pattern !== null) {
		rules.push(function pattern (val) {
			return val.match(new RegExp(pattern));
		});
	}

	return rules;
};

Proto.isValid = function () {
	var val = this.el.value.trim();
	// Get validation rules is always called to allow changing of properties
	var rules = this.getValidationRules();
	var isValid = true;

	if (this.el.getAttribute('type') === 'email') {
		isValid = (val.indexOf('@') > 0) && val.length > 2;
	}

	for (var i = 0; i < rules.length; i++) {
		isValid = rules[i](val) && isValid;
		if (!isValid) return false;
	}

	return isValid;
};

module.exports = StatefulTextInput;

},{"./stateful-form-element":13}],16:[function(require,module,exports){
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

},{"./form-elements/stateful-checkbox":12,"./form-elements/stateful-select":14,"./form-elements/stateful-text-input":15,"./stateful-object":17}],17:[function(require,module,exports){
function StatefulObject () {
	this.listeners = [];
	this.setState(this.getDefaultState());
}

var Proto = StatefulObject.prototype;

Proto.onStateChange = function (listener) {
	this.listeners.push(listener);
	return this;
};

Proto.triggerStateChange = function (partialNewState, key) {
	this.listeners.forEach(function (listener) {
		listener(this.state, partialNewState, key, this);
	}.bind(this));
	return this;
};

/**
 * @param {Object} partialNewState
 * @param {?String} key
 */
Proto.setState = function (partialNewState, key) {
	var name = key || this.name;
	var oldState = this.state || {};
	this.state = this.computedState(Object.assign({}, this.state, partialNewState));
	if (JSON.stringify(oldState[key]) !== JSON.stringify(partialNewState)) {
		this.triggerStateChange(partialNewState, name);
	}
	return this;
};

Proto.computedState = function (state) {
	return state;
};

Proto.getDefaultState = function () {
	return {};
};

module.exports = StatefulObject;

},{}],18:[function(require,module,exports){
// IE8+
function removeClass (el, className) {
	if (el.classList) {
		el.classList.remove(className);
	} else {
		el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
	}
}

// IE8+
function addClass (el, className) {
	if (el.classList) {
		el.classList.add(className);
	} else {
		el.className += ' ' + className;
	}
}

function toggleClass (el, className, isApplied) {
	if (isApplied) {
		addClass(el, className);
	} else {
		removeClass(el, className);
	}
}

function toggleAttribute (el, attrName, isApplied) {
	if (isApplied) {
		el.setAttribute(attrName, attrName);
	} else {
		el.removeAttribute(attrName);
	}
}

module.exports = {
	toggleClass: toggleClass,
	removeClass: removeClass,
	addClass: addClass,
	toggleAttribute: toggleAttribute
};

},{}],19:[function(require,module,exports){
// Some browsers do not support Object.create
if (typeof Object.create === 'undefined') {
	Object.create = function(prototype) {
		function C() {}
		C.prototype = prototype;
		return new C();
	}
}

},{}],20:[function(require,module,exports){
(function (global){
'use strict';
/**
 * Stateful forms
 * ---
 * Author: Jeroen Ransijn
 * License: MIT
 */
require('./polyfills/object-create');
var StatefulForm = require('./lib/stateful-form');
var StatefulDirectives = require('./lib/directives/stateful-directives');

global.createStatefulForms = function createStatefulForms () {
	var forms = document.querySelectorAll('form[stateful]');

	// IE9+ NodeList iteration
	return Array.prototype.map.call(forms, function (form) {
		var directives = new StatefulDirectives(form);
		return new StatefulForm(form).onStateChange(function (state, partialState, key) {
			console.log('form:stateChange', key, state);
			if (key) {
				directives.patch(key, state);
			} else {
				directives.update(state);
			}
		}).triggerStateChange();
	});
}

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"./lib/directives/stateful-directives":4,"./lib/stateful-form":16,"./polyfills/object-create":19}]},{},[20])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJzcmMvbGliL2RpcmVjdGl2ZXMvc3RhdGVmdWwtYXR0cmlidXRlcy1kaXJlY3RpdmUuanMiLCJzcmMvbGliL2RpcmVjdGl2ZXMvc3RhdGVmdWwtY2xhc3MtZGlyZWN0aXZlLmpzIiwic3JjL2xpYi9kaXJlY3RpdmVzL3N0YXRlZnVsLWRpcmVjdGl2ZS5qcyIsInNyYy9saWIvZGlyZWN0aXZlcy9zdGF0ZWZ1bC1kaXJlY3RpdmVzLmpzIiwic3JjL2xpYi9kaXJlY3RpdmVzL3N0YXRlZnVsLXNob3ctZGlyZWN0aXZlLmpzIiwic3JjL2xpYi9kaXJlY3RpdmVzL3N0YXRlZnVsLXRleHQtZGlyZWN0aXZlLmpzIiwic3JjL2xpYi9leHByZXNzaW9ucy9ib29sZWFuLWV4cHJlc3Npb24uanMiLCJzcmMvbGliL2V4cHJlc3Npb25zL2Jvb2xlYW4tdmFsdWUtZXhwcmVzc2lvbi5qcyIsInNyYy9saWIvZXhwcmVzc2lvbnMvY29tcG91bmQtYm9vbGVhbi1leHByZXNzaW9uLmpzIiwic3JjL2xpYi9leHByZXNzaW9ucy9vYmplY3QtZXhwcmVzc2lvbi5qcyIsInNyYy9saWIvZXhwcmVzc2lvbnMvdmFsdWUtZXhwcmVzc2lvbi5qcyIsInNyYy9saWIvZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1jaGVja2JveC5qcyIsInNyYy9saWIvZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1mb3JtLWVsZW1lbnQuanMiLCJzcmMvbGliL2Zvcm0tZWxlbWVudHMvc3RhdGVmdWwtc2VsZWN0LmpzIiwic3JjL2xpYi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXRleHQtaW5wdXQuanMiLCJzcmMvbGliL3N0YXRlZnVsLWZvcm0uanMiLCJzcmMvbGliL3N0YXRlZnVsLW9iamVjdC5qcyIsInNyYy9saWIvdXRpbHMuanMiLCJzcmMvcG9seWZpbGxzL29iamVjdC1jcmVhdGUuanMiLCJzcmMvc3RhdGVmdWwtZm9ybXMuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDUEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3JCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ2hCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3pCQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzNDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzlDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDdENBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM3QkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNyQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDckJBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDcEdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDekhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQzFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOztBQ3hDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7OztBQ1JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsInZhciB1dGlscyA9IHJlcXVpcmUoJy4uL3V0aWxzJyk7XG52YXIgU3RhdGVmdWxEaXJlY3RpdmUgPSByZXF1aXJlKCcuL3N0YXRlZnVsLWRpcmVjdGl2ZScpO1xudmFyIE9iamVjdEV4cHJlc3Npb24gPSByZXF1aXJlKCcuLi9leHByZXNzaW9ucy9vYmplY3QtZXhwcmVzc2lvbicpO1xuXG52YXIgQ2xzID0gZnVuY3Rpb24gU3RhdGVmdWxDbGFzc0RpcmVjdGl2ZSAoZWwpIHtcblx0U3RhdGVmdWxEaXJlY3RpdmUuYXBwbHkodGhpcywgW2VsLCBPYmplY3RFeHByZXNzaW9uXSk7XG59O1xuXG52YXIgUHJvdG8gPSBDbHMucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bERpcmVjdGl2ZS5wcm90b3R5cGUpO1xuXG5Qcm90by5BVFRSSUJVVEUgPSAnc2YtYXR0cmlidXRlcyc7XG5cblByb3RvLnVwZGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHR2YXIgbWF0Y2hlZE9iamVjdCA9IHRoaXMuZXhwcmVzc2lvbi5nZXRNYXRjaGVkKHN0YXRlKTtcblxuXHRPYmplY3Qua2V5cyhtYXRjaGVkT2JqZWN0KS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHR1dGlscy50b2dnbGVBdHRyaWJ1dGUodGhpcy5lbCwga2V5LCBtYXRjaGVkT2JqZWN0W2tleV0pO1xuXHR9LmJpbmQodGhpcykpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbHM7XG4iLCJ2YXIgdXRpbHMgPSByZXF1aXJlKCcuLi91dGlscycpO1xudmFyIFN0YXRlZnVsRGlyZWN0aXZlID0gcmVxdWlyZSgnLi9zdGF0ZWZ1bC1kaXJlY3RpdmUnKTtcbnZhciBPYmplY3RFeHByZXNzaW9uID0gcmVxdWlyZSgnLi4vZXhwcmVzc2lvbnMvb2JqZWN0LWV4cHJlc3Npb24nKTtcblxudmFyIENscyA9IGZ1bmN0aW9uIFN0YXRlZnVsQ2xhc3NEaXJlY3RpdmUgKGVsKSB7XG5cdFN0YXRlZnVsRGlyZWN0aXZlLmFwcGx5KHRoaXMsIFtlbCwgT2JqZWN0RXhwcmVzc2lvbl0pO1xufTtcblxudmFyIFByb3RvID0gQ2xzLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxEaXJlY3RpdmUucHJvdG90eXBlKTtcblxuUHJvdG8uQVRUUklCVVRFID0gJ3NmLWNsYXNzJztcblxuUHJvdG8udXBkYXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG5cdHZhciBtYXRjaGVkT2JqZWN0ID0gdGhpcy5leHByZXNzaW9uLmdldE1hdGNoZWQoc3RhdGUpO1xuXG5cdE9iamVjdC5rZXlzKG1hdGNoZWRPYmplY3QpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdHV0aWxzLnRvZ2dsZUNsYXNzKHRoaXMuZWwsIGtleSwgbWF0Y2hlZE9iamVjdFtrZXldKTtcblx0fS5iaW5kKHRoaXMpKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xzO1xuIiwiZnVuY3Rpb24gU3RhdGVmdWxEaXJlY3RpdmUgKGVsLCBFeHByZXNzaW9uQ2xhc3MpIHtcblx0dGhpcy5lbCA9IGVsO1xuXHR0aGlzLmF0dHJpYnV0ZVZhbHVlID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUodGhpcy5BVFRSSUJVVEUpO1xuXHR0aGlzLmV4cHJlc3Npb24gPSBuZXcgRXhwcmVzc2lvbkNsYXNzKHRoaXMuYXR0cmlidXRlVmFsdWUpO1xufVxuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsRGlyZWN0aXZlO1xuIiwidmFyIFN0YXRlZnVsU2hvd0RpcmVjdGl2ZSA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtc2hvdy1kaXJlY3RpdmUnKTtcbnZhciBTdGF0ZWZ1bFRleHREaXJlY3RpdmUgPSByZXF1aXJlKCcuL3N0YXRlZnVsLXRleHQtZGlyZWN0aXZlJyk7XG52YXIgU3RhdGVmdWxDbGFzc0RpcmVjdGl2ZSA9IHJlcXVpcmUoJy4vc3RhdGVmdWwtY2xhc3MtZGlyZWN0aXZlJyk7XG52YXIgU3RhdGVmdWxBdHRyaWJ1dGVzRGlyZWN0aXZlID0gcmVxdWlyZSgnLi9zdGF0ZWZ1bC1hdHRyaWJ1dGVzLWRpcmVjdGl2ZScpO1xuXG5mdW5jdGlvbiBTdGF0ZWZ1bERpcmVjdGl2ZXMgKGVsKSB7XG5cdHRoaXMuZWwgPSBlbDtcblx0dGhpcy5kaXJlY3RpdmVzID0ge307XG5cdHRoaXMucGF0Y2hJbmRleCA9IHt9O1xuXHR0aGlzLmluaXQoKTtcbn1cblxudmFyIFByb3RvID0gU3RhdGVmdWxEaXJlY3RpdmVzLnByb3RvdHlwZTtcblxuUHJvdG8uaW5pdCA9IGZ1bmN0aW9uICgpIHtcblx0dGhpcy5xdWVyeU1hcChTdGF0ZWZ1bFNob3dEaXJlY3RpdmUpO1xuXHR0aGlzLnF1ZXJ5TWFwKFN0YXRlZnVsVGV4dERpcmVjdGl2ZSk7XG5cdHRoaXMucXVlcnlNYXAoU3RhdGVmdWxDbGFzc0RpcmVjdGl2ZSk7XG5cdHRoaXMucXVlcnlNYXAoU3RhdGVmdWxBdHRyaWJ1dGVzRGlyZWN0aXZlKTtcbn07XG5cblByb3RvLnF1ZXJ5TWFwID0gZnVuY3Rpb24gKGNscykge1xuXHR2YXIgYXR0ciA9IGNscy5wcm90b3R5cGUuQVRUUklCVVRFO1xuXHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKFxuXHRcdHRoaXMuZWwucXVlcnlTZWxlY3RvckFsbCgnWycgKyBhdHRyICsgJ10nKSwgZnVuY3Rpb24gKGVsKSB7XG5cdFx0XHR2YXIgZGlyZWN0aXZlID0gbmV3IGNscyhlbCk7XG5cblx0XHRcdHRoaXMuZGlyZWN0aXZlc1thdHRyXSA9IHRoaXMuZGlyZWN0aXZlc1thdHRyXSB8fCBbXTtcblx0XHRcdHRoaXMuZGlyZWN0aXZlc1thdHRyXS5wdXNoKGRpcmVjdGl2ZSk7XG5cblx0XHRcdGRpcmVjdGl2ZS5leHByZXNzaW9uLmdldE5hbWVzKCkuZm9yRWFjaChmdW5jdGlvbiAobmFtZSkge1xuXHRcdFx0XHR0aGlzLnBhdGNoSW5kZXhbbmFtZV0gPSB0aGlzLnBhdGNoSW5kZXhbbmFtZV0gfHwgW107XG5cdFx0XHRcdHRoaXMucGF0Y2hJbmRleFtuYW1lXS5wdXNoKGRpcmVjdGl2ZSk7XG5cdFx0XHR9LmJpbmQodGhpcykpO1xuXHRcdH0uYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by5wYXRjaCA9IGZ1bmN0aW9uIChrZXksIHN0YXRlKSB7XG5cblx0Y29uc29sZS5sb2coJ3BhdGNoJywga2V5LCBzdGF0ZSk7XG5cdGlmICh0aGlzLnBhdGNoSW5kZXguaGFzT3duUHJvcGVydHkoa2V5KSkge1xuXHRcdHRoaXMucGF0Y2hJbmRleFtrZXldLmZvckVhY2goZnVuY3Rpb24gKGRpcmVjdGl2ZSkge1xuXHRcdFx0ZGlyZWN0aXZlLnVwZGF0ZShzdGF0ZSk7XG5cdFx0fSk7XG5cdH1cbn07XG5cblByb3RvLnVwZGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHRjb25zb2xlLmxvZygndXBkYXRlJywgdGhpcy5kaXJlY3RpdmVzKTtcblx0T2JqZWN0LmtleXModGhpcy5kaXJlY3RpdmVzKS5mb3JFYWNoKGZ1bmN0aW9uIChrZXkpIHtcblx0XHR0aGlzLmRpcmVjdGl2ZXNba2V5XS5mb3JFYWNoKGZ1bmN0aW9uIChkaXJlY3RpdmUpIHtcblx0XHRcdGRpcmVjdGl2ZS51cGRhdGUoc3RhdGUpO1xuXHRcdH0pO1xuXHR9LmJpbmQodGhpcykpO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBTdGF0ZWZ1bERpcmVjdGl2ZXM7XG4iLCJ2YXIgU3RhdGVmdWxEaXJlY3RpdmUgPSByZXF1aXJlKCcuL3N0YXRlZnVsLWRpcmVjdGl2ZScpO1xudmFyIENvbXBvdW5kQm9vbGVhbkV4cHJlc3Npb24gPSByZXF1aXJlKCcuLi9leHByZXNzaW9ucy9jb21wb3VuZC1ib29sZWFuLWV4cHJlc3Npb24nKTtcblxudmFyIENscyA9IGZ1bmN0aW9uIFN0YXRlZnVsU2hvd0RpcmVjdGl2ZSAoZWwpIHtcblx0U3RhdGVmdWxEaXJlY3RpdmUuYXBwbHkodGhpcywgW2VsLCBDb21wb3VuZEJvb2xlYW5FeHByZXNzaW9uXSk7XG59O1xuXG52YXIgUHJvdG8gPSBDbHMucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bERpcmVjdGl2ZS5wcm90b3R5cGUpO1xuXG5Qcm90by5BVFRSSUJVVEUgPSAnc2Ytc2hvdyc7XG5cblByb3RvLnVwZGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHRjb25zb2xlLmxvZygndXBkYXRlJyk7XG5cdGlmICh0aGlzLmV4cHJlc3Npb24uaXNNYXRjaGVkKHN0YXRlKSkge1xuXHRcdHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICcnO1xuXHR9IGVsc2Uge1xuXHRcdHRoaXMuZWwuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0fVxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbHM7XG4iLCJ2YXIgU3RhdGVmdWxEaXJlY3RpdmUgPSByZXF1aXJlKCcuL3N0YXRlZnVsLWRpcmVjdGl2ZScpO1xudmFyIFZhbHVlRXhwcmVzc2lvbiA9IHJlcXVpcmUoJy4uL2V4cHJlc3Npb25zL3ZhbHVlLWV4cHJlc3Npb24nKTtcblxudmFyIENscyA9IGZ1bmN0aW9uIFN0YXRlZnVsVGV4dERpcmVjdGl2ZSAoZWwpIHtcblx0U3RhdGVmdWxEaXJlY3RpdmUuYXBwbHkodGhpcywgW2VsLCBWYWx1ZUV4cHJlc3Npb25dKTtcbn07XG5cbnZhciBQcm90byA9IENscy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0YXRlZnVsRGlyZWN0aXZlLnByb3RvdHlwZSk7XG5cblByb3RvLkFUVFJJQlVURSA9ICdzZi10ZXh0JztcblxuUHJvdG8udXBkYXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG5cdHRoaXMuZWwuaW5uZXJIVE1MID0gdGhpcy5leHByZXNzaW9uLmdldFZhbHVlKHN0YXRlKTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gQ2xzO1xuIiwidmFyIFBST1BFUlRZX1NFUEFSQVRPUiA9ICcuJztcblxuZnVuY3Rpb24gQm9vbGVhbkV4cHJlc3Npb24gKGV4cCkge1xuXHR0aGlzLmV4cCA9IGV4cC50cmltKCk7XG5cblx0dmFyIHNwbGl0RXhwID0gdGhpcy5leHAuc3BsaXQoUFJPUEVSVFlfU0VQQVJBVE9SKTtcblx0dGhpcy5uYW1lID0gc3BsaXRFeHBbMF07XG5cdHRoaXMucHJvcCA9IHNwbGl0RXhwWzFdO1xufVxuXG52YXIgUHJvdG8gPSBCb29sZWFuRXhwcmVzc2lvbi5wcm90b3R5cGU7XG5cblByb3RvLmlzTWF0Y2hlZCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHRpZiAoc3RhdGUuaGFzT3duUHJvcGVydHkodGhpcy5uYW1lKSkge1xuXHRcdHJldHVybiBzdGF0ZVt0aGlzLm5hbWVdW3RoaXMucHJvcF07XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59O1xuXG5Qcm90by5nZXROYW1lcyA9IGZ1bmN0aW9uICgpIHtcblx0cmV0dXJuIFt0aGlzLm5hbWVdO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCb29sZWFuRXhwcmVzc2lvbjtcbiIsInZhciBWQUxVRV9TRVBBUkFUT1IgPSAnID09ICc7XG52YXIgSU5WRVJURURfVkFMVUVfU0VQQVJBVE9SID0gJyAhPSAnO1xudmFyIFBST1BFUlRZX1NFUEFSQVRPUiA9ICcuJztcblxuZnVuY3Rpb24gQm9vbGVhblZhbHVlRXhwcmVzc2lvbiAoZXhwKSB7XG5cdHRoaXMuZXhwID0gZXhwLnRyaW0oKTtcblxuXHR2YXIgdmFsdWVTcGxpdDtcblx0aWYgKHRoaXMuZXhwLmluZGV4T2YoVkFMVUVfU0VQQVJBVE9SKSA+IDApIHtcblx0XHR0aGlzLmludmVydGVkID0gZmFsc2U7XG5cdFx0dmFsdWVTcGxpdCA9IHRoaXMuZXhwLnNwbGl0KFZBTFVFX1NFUEFSQVRPUik7XG5cdH0gZWxzZSBpZiAodGhpcy5leHAuaW5kZXhPZihJTlZFUlRFRF9WQUxVRV9TRVBBUkFUT1IpID4gMCkge1xuXHRcdHRoaXMuaW52ZXJ0ZWQgPSB0cnVlO1xuXHRcdHZhbHVlU3BsaXQgPSB0aGlzLmV4cC5zcGxpdChJTlZFUlRFRF9WQUxVRV9TRVBBUkFUT1IpO1xuXHR9XG5cblx0dmFyIG5hbWVBbmRQcm9wU3BsaXQgPSB2YWx1ZVNwbGl0WzBdLnRyaW0oKS5zcGxpdChQUk9QRVJUWV9TRVBBUkFUT1IpO1xuXG5cdHRoaXMubmFtZSA9IG5hbWVBbmRQcm9wU3BsaXRbMF07XG5cdHRoaXMucHJvcCA9IG5hbWVBbmRQcm9wU3BsaXRbMV07XG5cdHRoaXMudmFsdWUgPSB2YWx1ZVNwbGl0WzFdO1xufVxuXG5Cb29sZWFuVmFsdWVFeHByZXNzaW9uLmlzQXBwbGljYWJsZSA9IGZ1bmN0aW9uIChleHApIHtcblx0cmV0dXJuIGV4cC5pbmRleE9mKFZBTFVFX1NFUEFSQVRPUikgPiAwIHx8IGV4cC5pbmRleE9mKElOVkVSVEVEX1ZBTFVFX1NFUEFSQVRPUikgPiAwIDtcbn07XG5cbnZhciBQcm90byA9IEJvb2xlYW5WYWx1ZUV4cHJlc3Npb24ucHJvdG90eXBlO1xuXG5Qcm90by5pc01hdGNoZWQgPSBmdW5jdGlvbiAoc3RhdGUpIHtcblx0aWYgKHN0YXRlLmhhc093blByb3BlcnR5KHRoaXMubmFtZSkpIHtcblx0XHRjb25zb2xlLmxvZyhzdGF0ZVt0aGlzLm5hbWVdLnZhbHVlID09PSB0aGlzLnZhbHVlKTtcblx0XHRpZiAoc3RhdGVbdGhpcy5uYW1lXS52YWx1ZSA9PT0gdGhpcy52YWx1ZSkgcmV0dXJuICF0aGlzLmludmVydGVkO1xuXHR9XG5cblx0cmV0dXJuIHRoaXMuaW52ZXJ0ZWQ7XG59O1xuXG5Qcm90by5nZXROYW1lcyA9IGZ1bmN0aW9uICgpIHtcblx0cmV0dXJuIFt0aGlzLm5hbWVdO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBCb29sZWFuVmFsdWVFeHByZXNzaW9uO1xuIiwidmFyIEJvb2xlYW5FeHByZXNzaW9uID0gcmVxdWlyZSgnLi9ib29sZWFuLWV4cHJlc3Npb24nKTtcbnZhciBCb29sZWFuVmFsdWVFeHByZXNzaW9uID0gcmVxdWlyZSgnLi9ib29sZWFuLXZhbHVlLWV4cHJlc3Npb24nKTtcblxudmFyIEFORF9TRVBBUkFUT1IgPSAnIGFuZCAnOyAvLyB3aGl0ZXNwYWNlIGlzIGltcG9ydGFudFxudmFyIE9SX1NFUEFSQVRPUiA9ICcgb3IgJzsgLy8gd2hpdGVzcGFjZSBpcyBpbXBvcnRhbnRcblxuZnVuY3Rpb24gQ29tcG91bmRCb29sZWFuRXhwcmVzc2lvbiAoZXhwKSB7XG5cdHRoaXMuZXhwID0gZXhwLnRyaW0oKTtcblxuXHRpZiAodGhpcy5leHAuaW5kZXhPZihPUl9TRVBBUkFUT1IpID4gMCkge1xuXHRcdHRoaXMuZXhwcmVzc2lvbnMgPSB0aGlzLmV4cC5zcGxpdChPUl9TRVBBUkFUT1IpXG5cdFx0XHQubWFwKGZ1bmN0aW9uIChzcGxpdEV4cCkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IENvbXBvdW5kQm9vbGVhbkV4cHJlc3Npb24oc3BsaXRFeHApO1xuXHRcdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0dGhpcy5leHByZXNzaW9ucyA9IHRoaXMuZXhwLnNwbGl0KEFORF9TRVBBUkFUT1IpXG5cdFx0XHQubWFwKGZ1bmN0aW9uIChzcGxpdEV4cCkge1xuXHRcdFx0XHRpZiAoQm9vbGVhblZhbHVlRXhwcmVzc2lvbi5pc0FwcGxpY2FibGUoc3BsaXRFeHApKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBCb29sZWFuVmFsdWVFeHByZXNzaW9uKHNwbGl0RXhwKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBuZXcgQm9vbGVhbkV4cHJlc3Npb24oc3BsaXRFeHApO1xuXHRcdFx0fSk7XG5cdH1cblxufVxuXG52YXIgUHJvdG8gPSBDb21wb3VuZEJvb2xlYW5FeHByZXNzaW9uLnByb3RvdHlwZTtcblxuUHJvdG8uaXNNYXRjaGVkID0gZnVuY3Rpb24gKHN0YXRlKSB7XG5cdGZvciAodmFyIGkgPSAwOyBpIDwgdGhpcy5leHByZXNzaW9ucy5sZW5ndGg7IGkrKykge1xuXHRcdGlmICghdGhpcy5leHByZXNzaW9uc1tpXS5pc01hdGNoZWQoc3RhdGUpKSByZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn07XG5cblByb3RvLmdldE5hbWVzID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgbmFtZXMgPSBbXTtcblx0dGhpcy5leHByZXNzaW9ucy5mb3JFYWNoKGZ1bmN0aW9uIChleHApIHtcblx0XHRuYW1lcyA9IG5hbWVzLmNvbmNhdChleHAuZ2V0TmFtZXMoKSk7XG5cdH0pO1xuXHRyZXR1cm4gbmFtZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IENvbXBvdW5kQm9vbGVhbkV4cHJlc3Npb247XG4iLCJ2YXIgQ29tcG91bmRCb29sZWFuRXhwcmVzc2lvbiA9IHJlcXVpcmUoJy4vY29tcG91bmQtYm9vbGVhbi1leHByZXNzaW9uJyk7XG5cbnZhciBTRVBBUkFUT1IgPSAnLCc7XG52YXIgS0VZX1NFUEFSQVRPUiA9ICc6JztcblxuZnVuY3Rpb24gT2JqZWN0RXhwcmVzc2lvbiAoZXhwKSB7XG5cdHRoaXMuZXhwID0gZXhwLnRyaW0oKTtcblx0dGhpcy5leHByZXNzaW9ucyA9IHt9O1xuXG5cdHRoaXMuZXhwLnNwbGl0KFNFUEFSQVRPUikuZm9yRWFjaChmdW5jdGlvbiAocmF3T2JqRXhwKSB7XG5cdFx0dmFyIHNwbGl0T2JqRXhwID0gcmF3T2JqRXhwLnNwbGl0KEtFWV9TRVBBUkFUT1IpO1xuXHRcdHRoaXMuZXhwcmVzc2lvbnNbc3BsaXRPYmpFeHBbMF1dID0gbmV3IENvbXBvdW5kQm9vbGVhbkV4cHJlc3Npb24oc3BsaXRPYmpFeHBbMV0pO1xuXHR9LmJpbmQodGhpcykpO1xufVxuXG52YXIgUHJvdG8gPSBPYmplY3RFeHByZXNzaW9uLnByb3RvdHlwZTtcblxuUHJvdG8uZ2V0TWF0Y2hlZCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHR2YXIgb2JqID0ge307XG5cblx0T2JqZWN0LmtleXModGhpcy5leHByZXNzaW9ucykuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG5cdFx0b2JqW2tleV0gPSB0aGlzLmV4cHJlc3Npb25zW2tleV0uaXNNYXRjaGVkKHN0YXRlKTtcblx0fS5iaW5kKHRoaXMpKTtcblxuXHRyZXR1cm4gb2JqO1xufTtcblxuUHJvdG8uZ2V0TmFtZXMgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBuYW1lcyA9IFtdO1xuXG5cdE9iamVjdC5rZXlzKHRoaXMuZXhwcmVzc2lvbnMpLmZvckVhY2goZnVuY3Rpb24gKGtleSkge1xuXHRcdG5hbWVzID0gbmFtZXMuY29uY2F0KHRoaXMuZXhwcmVzc2lvbnNba2V5XS5nZXROYW1lcygpKTtcblx0fS5iaW5kKHRoaXMpKTtcblxuXHRyZXR1cm4gbmFtZXM7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IE9iamVjdEV4cHJlc3Npb247XG4iLCJ2YXIgUFJPUEVSVFlfU0VQQVJBVE9SID0gJy4nO1xuXG5mdW5jdGlvbiBWYWx1ZUV4cHJlc3Npb24gKGV4cCkge1xuXHR0aGlzLmV4cCA9IGV4cC50cmltKCk7XG5cblx0dmFyIHNwbGl0RXhwID0gdGhpcy5leHAuc3BsaXQoUFJPUEVSVFlfU0VQQVJBVE9SKTtcblx0dGhpcy5uYW1lID0gc3BsaXRFeHBbMF07XG59XG5cbnZhciBQcm90byA9IFZhbHVlRXhwcmVzc2lvbi5wcm90b3R5cGU7XG5cblByb3RvLmlzTWF0Y2hlZCA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHRpZiAoc3RhdGUuaGFzT3duUHJvcGVydHkodGhpcy5uYW1lKSkge1xuXHRcdHJldHVybiAhIXN0YXRlW3RoaXMubmFtZV0udmFsdWU7XG5cdH1cblxuXHRyZXR1cm4gZmFsc2U7XG59O1xuXG5Qcm90by5nZXRWYWx1ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHRpZiAoc3RhdGUuaGFzT3duUHJvcGVydHkodGhpcy5uYW1lKSkge1xuXHRcdHJldHVybiBzdGF0ZVt0aGlzLm5hbWVdLnZhbHVlO1xuXHR9XG5cdHJldHVybiAnJztcbn07XG5cblByb3RvLmdldE5hbWVzID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gW3RoaXMubmFtZV07XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZhbHVlRXhwcmVzc2lvbjtcbiIsInZhciBTdGF0ZWZ1bEZvcm1FbGVtZW50ID0gcmVxdWlyZSgnLi9zdGF0ZWZ1bC1mb3JtLWVsZW1lbnQnKTtcblxudmFyIENscyA9IGZ1bmN0aW9uIFN0YXRlZnVsQ2hlY2tib3ggKCkge1xuXHRTdGF0ZWZ1bEZvcm1FbGVtZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59O1xuXG52YXIgUHJvdG8gPSBDbHMucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bEZvcm1FbGVtZW50LnByb3RvdHlwZSk7XG5cblByb3RvLmJpbmRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG5cdHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignY2hhbmdlJywgdGhpcy51cGRhdGVWYWx1ZS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLnVwZGF0ZVZhbHVlID0gZnVuY3Rpb24gKCkge1xuXHRjb25zb2xlLmxvZygnY2hlY2tib3gnLCB0aGlzLmdldFZhbHVlKCkpO1xuXHR0aGlzLnNldFN0YXRlKHsgdmFsdWU6IHRoaXMuZ2V0VmFsdWUoKSwgcHJpc3RpbmU6IGZhbHNlLCB0b3VjaGVkOiB0cnVlIH0pO1xufTtcblxuUHJvdG8uaXNWYWxpZCA9IGZ1bmN0aW9uICgpIHtcblx0aWYgKHRoaXMuZWwuaGFzQXR0cmlidXRlKCdyZXF1aXJlZCcpKSB7XG5cdFx0cmV0dXJuIHRoaXMuZWwuY2hlY2tlZDtcblx0fVxuXHRyZXR1cm4gdHJ1ZTtcbn07XG5cblByb3RvLmdldFZhbHVlID0gZnVuY3Rpb24gKCkge1xuXHRyZXR1cm4gdGhpcy5lbC5jaGVja2VkO1xufTtcblxubW9kdWxlLmV4cG9ydHMgPSBDbHM7XG4iLCJ2YXIgU3RhdGVmdWxPYmplY3QgPSByZXF1aXJlKCcuLi9zdGF0ZWZ1bC1vYmplY3QnKTtcblxuZnVuY3Rpb24gU3RhdGVmdWxGb3JtRWxlbWVudCAoZWwpIHtcblx0dGhpcy5lbCA9IGVsO1xuXHR0aGlzLm5hbWUgPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnbmFtZScpO1xuXHRTdGF0ZWZ1bE9iamVjdC5jYWxsKHRoaXMpO1xuXHR0aGlzLmJpbmRFdmVudHMoKTtcbn1cblxudmFyIFByb3RvID0gU3RhdGVmdWxGb3JtRWxlbWVudC5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0YXRlZnVsT2JqZWN0LnByb3RvdHlwZSk7XG5cblByb3RvLmdldERlZmF1bHRTdGF0ZSA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIHN0YXRlID0ge1xuXHRcdHZhbGlkOiB0aGlzLmlzVmFsaWQoKSxcblx0XHRwcmlzdGluZTogdHJ1ZSxcblx0XHR0b3VjaGVkOiBmYWxzZSxcblx0XHR2YWx1ZTogdGhpcy5nZXRWYWx1ZSgpXG5cdH07XG5cblx0cmV0dXJuIHN0YXRlO1xufTtcblxuUHJvdG8uZ2V0VmFsdWUgPSBmdW5jdGlvbiAoKSB7XG5cdHJldHVybiB0aGlzLmVsLnZhbHVlO1xufTtcblxuUHJvdG8uY29tcHV0ZWRTdGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHRzdGF0ZS52YWxpZCA9IHRoaXMuaXNWYWxpZCgpO1xuXG5cdHJldHVybiBPYmplY3QuYXNzaWduKHN0YXRlLCB7XG5cdFx0aW52YWxpZDogIXN0YXRlLnZhbGlkLFxuXHRcdGRpcnR5OiAhc3RhdGUucHJpc3RpbmUsXG5cdFx0dW50b3VjaGVkOiAhc3RhdGUudG91Y2hlZFxuXHR9KTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVmdWxGb3JtRWxlbWVudDtcbiIsInZhciBTdGF0ZWZ1bEZvcm1FbGVtZW50ID0gcmVxdWlyZSgnLi9zdGF0ZWZ1bC1mb3JtLWVsZW1lbnQnKTtcblxuZnVuY3Rpb24gU3RhdGVmdWxTZWxlY3QgKCkge1xuXHRTdGF0ZWZ1bEZvcm1FbGVtZW50LmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG59XG5cbnZhciBQcm90byA9IFN0YXRlZnVsU2VsZWN0LnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3RhdGVmdWxGb3JtRWxlbWVudC5wcm90b3R5cGUpO1xuXG5Qcm90by5iaW5kRXZlbnRzID0gZnVuY3Rpb24gKCkge1xuXHR0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHRoaXMudXBkYXRlVmFsdWUuYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by51cGRhdGVWYWx1ZSA9IGZ1bmN0aW9uICgpIHtcblx0dGhpcy5zZXRTdGF0ZSh7IHZhbHVlOiB0aGlzLmdldFZhbHVlKCksIHByaXN0aW5lOiBmYWxzZSwgdG91Y2hlZDogdHJ1ZSB9KTtcbn07XG5cblByb3RvLmlzVmFsaWQgPSBmdW5jdGlvbiAoKSB7XG5cdHJldHVybiAhIXRoaXMuZWwudmFsdWU7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0YXRlZnVsU2VsZWN0O1xuIiwidmFyIFN0YXRlZnVsRm9ybUVsZW1lbnQgPSByZXF1aXJlKCcuL3N0YXRlZnVsLWZvcm0tZWxlbWVudCcpO1xuXG5mdW5jdGlvbiBTdGF0ZWZ1bFRleHRJbnB1dCAoKSB7XG5cdFN0YXRlZnVsRm9ybUVsZW1lbnQuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbn1cblxudmFyIFByb3RvID0gU3RhdGVmdWxUZXh0SW5wdXQucHJvdG90eXBlID0gT2JqZWN0LmNyZWF0ZShTdGF0ZWZ1bEZvcm1FbGVtZW50LnByb3RvdHlwZSk7XG5cblByb3RvLmJpbmRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciB1cGRhdGVWYWx1ZSA9IHRoaXMudXBkYXRlVmFsdWUuYmluZCh0aGlzKTtcblxuXHR0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2tleXVwJywgdXBkYXRlVmFsdWUpO1xuXHR0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2NoYW5nZScsIHVwZGF0ZVZhbHVlKTtcblxuXHR0aGlzLmVsLmFkZEV2ZW50TGlzdGVuZXIoJ2JsdXInLCBmdW5jdGlvbiBvbkJsdXIgKCkge1xuXHRcdHRoaXMuc2V0U3RhdGUoeyB0b3VjaGVkOiB0cnVlIH0pO1xuXHR9LmJpbmQodGhpcykpO1xufTtcblxuUHJvdG8udXBkYXRlVmFsdWUgPSBmdW5jdGlvbiAoKSB7XG5cdHRoaXMuc2V0U3RhdGUoeyB2YWx1ZTogdGhpcy5nZXRWYWx1ZSgpLCBwcmlzdGluZTogZmFsc2UgfSk7XG59O1xuXG5Qcm90by5jb21wdXRlZFN0YXRlID0gZnVuY3Rpb24gKHN0YXRlKSB7XG5cdHN0YXRlLnZhbGlkID0gdGhpcy5pc1ZhbGlkKCk7XG5cblx0cmV0dXJuIE9iamVjdC5hc3NpZ24oc3RhdGUsIHtcblx0XHRpbnZhbGlkOiAhc3RhdGUudmFsaWQsXG5cdFx0ZGlydHk6ICFzdGF0ZS5wcmlzdGluZSxcblx0XHR1bnRvdWNoZWQ6ICFzdGF0ZS50b3VjaGVkXG5cdH0pO1xufTtcblxuUHJvdG8uZ2V0VmFsaWRhdGlvblJ1bGVzID0gZnVuY3Rpb24gKCkge1xuXHR2YXIgcnVsZXMgPSBbXTtcblx0dmFyIHJlcXVpcmVkID0gdGhpcy5lbC5oYXNBdHRyaWJ1dGUoJ3JlcXVpcmVkJyk7XG5cdHZhciBtaW4gPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnbWluJyk7XG5cdHZhciBtYXggPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnbWF4Jyk7XG5cdHZhciBtYXhsZW5ndGggPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnbWF4bGVuZ3RoJyk7XG5cdHZhciBtaW5sZW5ndGggPSB0aGlzLmVsLmdldEF0dHJpYnV0ZSgnbWlubGVuZ3RoJyk7XG5cdHZhciBwYXR0ZXJuID0gdGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ3BhdHRlcm4nKTtcblxuXHRpZiAocmVxdWlyZWQpIHtcblx0XHRydWxlcy5wdXNoKGZ1bmN0aW9uIHJlcXVpcmVkICh2YWwpIHtcblx0XHRcdHJldHVybiB2YWwubGVuZ3RoID4gMDtcblx0XHR9KTtcblx0fVxuXG5cdGlmIChtaW4gIT09IG51bGwpIHtcblx0XHRydWxlcy5wdXNoKGZ1bmN0aW9uIG1pbiAodmFsKSB7XG5cdFx0XHRyZXR1cm4gdmFsID49IG1pbjtcblx0XHR9KTtcblx0fVxuXG5cdGlmIChtYXggIT09IG51bGwpIHtcblx0XHRydWxlcy5wdXNoKGZ1bmN0aW9uIG1heCAodmFsKSB7XG5cdFx0XHRyZXR1cm4gdmFsIDw9IG1heDtcblx0XHR9KTtcblx0fVxuXG5cdGlmIChtaW5sZW5ndGggIT09IG51bGwpIHtcblx0XHRydWxlcy5wdXNoKGZ1bmN0aW9uIG1pbmxlbmd0aCAodmFsKSB7XG5cdFx0XHRyZXR1cm4gdmFsLmxlbmd0aCA+PSBtaW5sZW5ndGg7XG5cdFx0fSk7XG5cdH1cblxuXHRpZiAobWF4bGVuZ3RoICE9PSBudWxsKSB7XG5cdFx0cnVsZXMucHVzaChmdW5jdGlvbiBtYXhsZW5ndGggKHZhbCkge1xuXHRcdFx0cmV0dXJuIHZhbC5sZW5ndGggPD0gbWF4bGVuZ3RoO1xuXHRcdH0pO1xuXHR9XG5cblx0aWYgKHBhdHRlcm4gIT09IG51bGwpIHtcblx0XHRydWxlcy5wdXNoKGZ1bmN0aW9uIHBhdHRlcm4gKHZhbCkge1xuXHRcdFx0cmV0dXJuIHZhbC5tYXRjaChuZXcgUmVnRXhwKHBhdHRlcm4pKTtcblx0XHR9KTtcblx0fVxuXG5cdHJldHVybiBydWxlcztcbn07XG5cblByb3RvLmlzVmFsaWQgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciB2YWwgPSB0aGlzLmVsLnZhbHVlLnRyaW0oKTtcblx0Ly8gR2V0IHZhbGlkYXRpb24gcnVsZXMgaXMgYWx3YXlzIGNhbGxlZCB0byBhbGxvdyBjaGFuZ2luZyBvZiBwcm9wZXJ0aWVzXG5cdHZhciBydWxlcyA9IHRoaXMuZ2V0VmFsaWRhdGlvblJ1bGVzKCk7XG5cdHZhciBpc1ZhbGlkID0gdHJ1ZTtcblxuXHRpZiAodGhpcy5lbC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKSA9PT0gJ2VtYWlsJykge1xuXHRcdGlzVmFsaWQgPSAodmFsLmluZGV4T2YoJ0AnKSA+IDApICYmIHZhbC5sZW5ndGggPiAyO1xuXHR9XG5cblx0Zm9yICh2YXIgaSA9IDA7IGkgPCBydWxlcy5sZW5ndGg7IGkrKykge1xuXHRcdGlzVmFsaWQgPSBydWxlc1tpXSh2YWwpICYmIGlzVmFsaWQ7XG5cdFx0aWYgKCFpc1ZhbGlkKSByZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRyZXR1cm4gaXNWYWxpZDtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVmdWxUZXh0SW5wdXQ7XG4iLCJ2YXIgU3RhdGVmdWxPYmplY3QgPSByZXF1aXJlKCcuL3N0YXRlZnVsLW9iamVjdCcpO1xudmFyIFN0YXRlZnVsVGV4dElucHV0ID0gcmVxdWlyZSgnLi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLXRleHQtaW5wdXQnKTtcbnZhciBTdGF0ZWZ1bFNlbGVjdCA9IHJlcXVpcmUoJy4vZm9ybS1lbGVtZW50cy9zdGF0ZWZ1bC1zZWxlY3QnKTtcbnZhciBTdGF0ZWZ1bENoZWNrYm94ID0gcmVxdWlyZSgnLi9mb3JtLWVsZW1lbnRzL3N0YXRlZnVsLWNoZWNrYm94Jyk7XG5cbmZ1bmN0aW9uIFN0YXRlZnVsRm9ybSAoZWwpIHtcblx0dGhpcy5lbCA9IGVsO1xuXHR0aGlzLmluaXQoKTtcblx0U3RhdGVmdWxPYmplY3QuY2FsbCh0aGlzKTtcblx0dGhpcy5iaW5kRXZlbnRzKCk7XG59XG5cbnZhciBQcm90byA9IFN0YXRlZnVsRm9ybS5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKFN0YXRlZnVsT2JqZWN0LnByb3RvdHlwZSk7XG5cbi8qKlxuICogSGFuZGxlIHN0YXRlIGNoYW5nZXMgYnkgZm9ybSBlbGVtZW50c1xuICovXG5Qcm90by5oYW5kbGVGb3JtRWxlbWVudFN0YXRlQ2hhbmdlID0gZnVuY3Rpb24gKHN0YXRlLCBwYXJ0aWFsU3RhdGUsIGtleSkge1xuXHR2YXIgbmV3U3RhdGUgPSB7fTtcblx0bmV3U3RhdGVba2V5XSA9IHN0YXRlO1xuXHR0aGlzLnNldFN0YXRlKG5ld1N0YXRlLCBrZXkpO1xufTtcblxuUHJvdG8uc2V0Rm9ybVN0YXRlID0gZnVuY3Rpb24gKG5ld1N0YXRlKSB7XG5cdHRoaXMuc2V0U3RhdGUoeyBmb3JtOiBPYmplY3QuYXNzaWduKHt9LCB0aGlzLnN0YXRlLmZvcm0sIG5ld1N0YXRlKSB9LCAnZm9ybScpO1xufTtcblxuUHJvdG8uY29tcHV0ZWRTdGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHRmb3IgKHZhciBwcm9wIGluIHN0YXRlKSB7XG5cdFx0aWYgKHN0YXRlLmhhc093blByb3BlcnR5KHByb3ApICYmIHByb3AgIT09ICdmb3JtJykge1xuXHRcdFx0c3RhdGUuZm9ybS5wcmlzdGluZSA9IHN0YXRlW3Byb3BdLnByaXN0aW5lICYmIHN0YXRlLmZvcm0ucHJpc3RpbmU7XG5cdFx0XHRzdGF0ZS5mb3JtLnZhbGlkID0gc3RhdGVbcHJvcF0udmFsaWQgJiYgc3RhdGUuZm9ybS52YWxpZDtcblx0XHRcdHN0YXRlLmZvcm0udG91Y2hlZCA9IHN0YXRlW3Byb3BdLnRvdWNoZWQgJiYgc3RhdGUuZm9ybS50b3VjaGVkO1xuXHRcdH1cblx0fVxuXG5cdE9iamVjdC5hc3NpZ24oc3RhdGUuZm9ybSwge1xuXHRcdGludmFsaWQ6ICFzdGF0ZS5mb3JtLnZhbGlkLFxuXHRcdGRpcnR5OiAhc3RhdGUuZm9ybS5wcmlzdGluZSxcblx0XHR1bnRvdWNoZWQ6ICFzdGF0ZS5mb3JtLnRvdWNoZWRcblx0fSk7XG5cblx0cmV0dXJuIHN0YXRlO1xufTtcblxuUHJvdG8uaW5pdCA9IGZ1bmN0aW9uICgpIHtcblx0dGhpcy5mb3JtRWxlbWVudHMgPSBbXTtcblxuXHRBcnJheS5wcm90b3R5cGUuZm9yRWFjaC5jYWxsKHRoaXMuZWwuZWxlbWVudHMsIGZ1bmN0aW9uIChmaWVsZCkge1xuXHRcdHZhciBuYW1lID0gZmllbGQubmFtZTtcblx0XHR2YXIgdHlwZSA9IGZpZWxkLnR5cGU7XG5cblx0XHRpZiAoIW5hbWUpIHJldHVybjtcblx0XHRpZiAoZmllbGQubm9kZU5hbWUudG9Mb3dlckNhc2UoKSA9PSAnZmllbGRzZXQnKSByZXR1cm47XG5cdFx0aWYgKHR5cGUgPT0gJ3N1Ym1pdCcpIHJldHVybjtcblx0XHRpZiAodHlwZSA9PSAncmVzZXQnKSByZXR1cm47XG5cdFx0aWYgKHR5cGUgPT0gJ2J1dHRvbicpIHJldHVybjtcblx0XHRpZiAodHlwZSA9PSAnZmlsZScpIHJldHVybjtcblxuXHRcdHZhciBmb3JtRWxlbWVudCA9IGNyZWF0ZVN0YXRlZnVsRm9ybUVsZW1lbnQoZmllbGQpO1xuXHRcdGlmIChmb3JtRWxlbWVudCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmZvcm1FbGVtZW50cy5wdXNoKGZvcm1FbGVtZW50KTtcblx0XHR9XG5cdH0uYmluZCh0aGlzKSk7XG59O1xuXG5Qcm90by5nZXREZWZhdWx0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG5cdHZhciBzdGF0ZSA9IHt9O1xuXHR2YXIgaXNWYWxpZCA9IHRydWU7XG5cblx0QXJyYXkucHJvdG90eXBlLmZvckVhY2guY2FsbCh0aGlzLmZvcm1FbGVtZW50cywgZnVuY3Rpb24gKGZvcm1FbGVtZW50KSB7XG5cdFx0Zm9ybUVsZW1lbnQub25TdGF0ZUNoYW5nZSh0aGlzLmhhbmRsZUZvcm1FbGVtZW50U3RhdGVDaGFuZ2UuYmluZCh0aGlzKSk7XG5cdFx0c3RhdGVbZm9ybUVsZW1lbnQubmFtZV0gPSBmb3JtRWxlbWVudC5zdGF0ZTtcblx0XHRpc1ZhbGlkID0gZm9ybUVsZW1lbnQuc3RhdGUudmFsaWQgJiYgaXNWYWxpZDtcblx0fS5iaW5kKHRoaXMpKTtcblxuXHRyZXR1cm4gT2JqZWN0LmFzc2lnbih7XG5cdFx0Zm9ybToge1xuXHRcdFx0c3VibWl0dGVkOiBmYWxzZSxcblx0XHRcdHByaXN0aW5lOiB0cnVlLFxuXHRcdFx0dmFsaWQ6IGlzVmFsaWRcblx0XHR9XG5cdH0sIHN0YXRlKTtcbn07XG5cblByb3RvLmJpbmRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG5cdHRoaXMuZWwuYWRkRXZlbnRMaXN0ZW5lcignc3VibWl0JywgZnVuY3Rpb24gKGUpIHtcblx0XHRlLnByZXZlbnREZWZhdWx0KCk7XG5cdFx0dGhpcy5zdWJtaXQoKTtcblx0fS5iaW5kKHRoaXMpKTtcbn07XG5cblByb3RvLnN1Ym1pdCA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIGFjdGlvbiA9IHRoaXMuZWwuZ2V0QXR0cmlidXRlKCdhY3Rpb24nKTtcblx0dGhpcy5zZXRGb3JtU3RhdGUoeyBzdWJtaXR0ZWQ6IHRydWUgfSk7XG5cdGRvUmVxdWVzdChhY3Rpb24sIHRoaXMuc2VyaWFsaXplKCkpO1xufTtcblxuLy8gUHJpdmF0ZVxuXG5mdW5jdGlvbiBjcmVhdGVTdGF0ZWZ1bEZvcm1FbGVtZW50IChmaWVsZCkge1xuXHRzd2l0Y2ggKGZpZWxkLnR5cGUpIHtcblx0XHRjYXNlICd0ZXh0YXJlYSc6IHJldHVybiBuZXcgU3RhdGVmdWxUZXh0SW5wdXQoZmllbGQpO1xuXHRcdGNhc2UgJ3RleHQnOiByZXR1cm4gbmV3IFN0YXRlZnVsVGV4dElucHV0KGZpZWxkKTtcblx0XHRjYXNlICdlbWFpbCc6IHJldHVybiBuZXcgU3RhdGVmdWxUZXh0SW5wdXQoZmllbGQpO1xuXHRcdGNhc2UgJ2NoZWNrYm94JzogcmV0dXJuIG5ldyBTdGF0ZWZ1bENoZWNrYm94KGZpZWxkKTtcblx0XHRkZWZhdWx0OlxuXHRcdFx0aWYgKGZpZWxkLm5vZGVOYW1lLnRvTG93ZXJDYXNlKCkgPT09ICdzZWxlY3QnKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgU3RhdGVmdWxTZWxlY3QoZmllbGQpO1xuXHRcdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGRvUmVxdWVzdCAoYWN0aW9uLCBkYXRhKSB7XG5cdHZhciByZXF1ZXN0ID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdHJlcXVlc3Qub3BlbignUE9TVCcsIGFjdGlvbiwgdHJ1ZSk7XG5cdHJlcXVlc3Quc2V0UmVxdWVzdEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZDsgY2hhcnNldD1VVEYtOCcpO1xuXHRyZXF1ZXN0LnNlbmQoZGF0YSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVmdWxGb3JtO1xuIiwiZnVuY3Rpb24gU3RhdGVmdWxPYmplY3QgKCkge1xuXHR0aGlzLmxpc3RlbmVycyA9IFtdO1xuXHR0aGlzLnNldFN0YXRlKHRoaXMuZ2V0RGVmYXVsdFN0YXRlKCkpO1xufVxuXG52YXIgUHJvdG8gPSBTdGF0ZWZ1bE9iamVjdC5wcm90b3R5cGU7XG5cblByb3RvLm9uU3RhdGVDaGFuZ2UgPSBmdW5jdGlvbiAobGlzdGVuZXIpIHtcblx0dGhpcy5saXN0ZW5lcnMucHVzaChsaXN0ZW5lcik7XG5cdHJldHVybiB0aGlzO1xufTtcblxuUHJvdG8udHJpZ2dlclN0YXRlQ2hhbmdlID0gZnVuY3Rpb24gKHBhcnRpYWxOZXdTdGF0ZSwga2V5KSB7XG5cdHRoaXMubGlzdGVuZXJzLmZvckVhY2goZnVuY3Rpb24gKGxpc3RlbmVyKSB7XG5cdFx0bGlzdGVuZXIodGhpcy5zdGF0ZSwgcGFydGlhbE5ld1N0YXRlLCBrZXksIHRoaXMpO1xuXHR9LmJpbmQodGhpcykpO1xuXHRyZXR1cm4gdGhpcztcbn07XG5cbi8qKlxuICogQHBhcmFtIHtPYmplY3R9IHBhcnRpYWxOZXdTdGF0ZVxuICogQHBhcmFtIHs/U3RyaW5nfSBrZXlcbiAqL1xuUHJvdG8uc2V0U3RhdGUgPSBmdW5jdGlvbiAocGFydGlhbE5ld1N0YXRlLCBrZXkpIHtcblx0dmFyIG5hbWUgPSBrZXkgfHwgdGhpcy5uYW1lO1xuXHR2YXIgb2xkU3RhdGUgPSB0aGlzLnN0YXRlIHx8IHt9O1xuXHR0aGlzLnN0YXRlID0gdGhpcy5jb21wdXRlZFN0YXRlKE9iamVjdC5hc3NpZ24oe30sIHRoaXMuc3RhdGUsIHBhcnRpYWxOZXdTdGF0ZSkpO1xuXHRpZiAoSlNPTi5zdHJpbmdpZnkob2xkU3RhdGVba2V5XSkgIT09IEpTT04uc3RyaW5naWZ5KHBhcnRpYWxOZXdTdGF0ZSkpIHtcblx0XHR0aGlzLnRyaWdnZXJTdGF0ZUNoYW5nZShwYXJ0aWFsTmV3U3RhdGUsIG5hbWUpO1xuXHR9XG5cdHJldHVybiB0aGlzO1xufTtcblxuUHJvdG8uY29tcHV0ZWRTdGF0ZSA9IGZ1bmN0aW9uIChzdGF0ZSkge1xuXHRyZXR1cm4gc3RhdGU7XG59O1xuXG5Qcm90by5nZXREZWZhdWx0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG5cdHJldHVybiB7fTtcbn07XG5cbm1vZHVsZS5leHBvcnRzID0gU3RhdGVmdWxPYmplY3Q7XG4iLCIvLyBJRTgrXG5mdW5jdGlvbiByZW1vdmVDbGFzcyAoZWwsIGNsYXNzTmFtZSkge1xuXHRpZiAoZWwuY2xhc3NMaXN0KSB7XG5cdFx0ZWwuY2xhc3NMaXN0LnJlbW92ZShjbGFzc05hbWUpO1xuXHR9IGVsc2Uge1xuXHRcdGVsLmNsYXNzTmFtZSA9IGVsLmNsYXNzTmFtZS5yZXBsYWNlKG5ldyBSZWdFeHAoJyhefFxcXFxiKScgKyBjbGFzc05hbWUuc3BsaXQoJyAnKS5qb2luKCd8JykgKyAnKFxcXFxifCQpJywgJ2dpJyksICcgJyk7XG5cdH1cbn1cblxuLy8gSUU4K1xuZnVuY3Rpb24gYWRkQ2xhc3MgKGVsLCBjbGFzc05hbWUpIHtcblx0aWYgKGVsLmNsYXNzTGlzdCkge1xuXHRcdGVsLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcblx0fSBlbHNlIHtcblx0XHRlbC5jbGFzc05hbWUgKz0gJyAnICsgY2xhc3NOYW1lO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUNsYXNzIChlbCwgY2xhc3NOYW1lLCBpc0FwcGxpZWQpIHtcblx0aWYgKGlzQXBwbGllZCkge1xuXHRcdGFkZENsYXNzKGVsLCBjbGFzc05hbWUpO1xuXHR9IGVsc2Uge1xuXHRcdHJlbW92ZUNsYXNzKGVsLCBjbGFzc05hbWUpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHRvZ2dsZUF0dHJpYnV0ZSAoZWwsIGF0dHJOYW1lLCBpc0FwcGxpZWQpIHtcblx0aWYgKGlzQXBwbGllZCkge1xuXHRcdGVsLnNldEF0dHJpYnV0ZShhdHRyTmFtZSwgYXR0ck5hbWUpO1xuXHR9IGVsc2Uge1xuXHRcdGVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyTmFtZSk7XG5cdH1cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG5cdHRvZ2dsZUNsYXNzOiB0b2dnbGVDbGFzcyxcblx0cmVtb3ZlQ2xhc3M6IHJlbW92ZUNsYXNzLFxuXHRhZGRDbGFzczogYWRkQ2xhc3MsXG5cdHRvZ2dsZUF0dHJpYnV0ZTogdG9nZ2xlQXR0cmlidXRlXG59O1xuIiwiLy8gU29tZSBicm93c2VycyBkbyBub3Qgc3VwcG9ydCBPYmplY3QuY3JlYXRlXG5pZiAodHlwZW9mIE9iamVjdC5jcmVhdGUgPT09ICd1bmRlZmluZWQnKSB7XG5cdE9iamVjdC5jcmVhdGUgPSBmdW5jdGlvbihwcm90b3R5cGUpIHtcblx0XHRmdW5jdGlvbiBDKCkge31cblx0XHRDLnByb3RvdHlwZSA9IHByb3RvdHlwZTtcblx0XHRyZXR1cm4gbmV3IEMoKTtcblx0fVxufVxuIiwiJ3VzZSBzdHJpY3QnO1xuLyoqXG4gKiBTdGF0ZWZ1bCBmb3Jtc1xuICogLS0tXG4gKiBBdXRob3I6IEplcm9lbiBSYW5zaWpuXG4gKiBMaWNlbnNlOiBNSVRcbiAqL1xucmVxdWlyZSgnLi9wb2x5ZmlsbHMvb2JqZWN0LWNyZWF0ZScpO1xudmFyIFN0YXRlZnVsRm9ybSA9IHJlcXVpcmUoJy4vbGliL3N0YXRlZnVsLWZvcm0nKTtcbnZhciBTdGF0ZWZ1bERpcmVjdGl2ZXMgPSByZXF1aXJlKCcuL2xpYi9kaXJlY3RpdmVzL3N0YXRlZnVsLWRpcmVjdGl2ZXMnKTtcblxuZ2xvYmFsLmNyZWF0ZVN0YXRlZnVsRm9ybXMgPSBmdW5jdGlvbiBjcmVhdGVTdGF0ZWZ1bEZvcm1zICgpIHtcblx0dmFyIGZvcm1zID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCgnZm9ybVtzdGF0ZWZ1bF0nKTtcblxuXHQvLyBJRTkrIE5vZGVMaXN0IGl0ZXJhdGlvblxuXHRyZXR1cm4gQXJyYXkucHJvdG90eXBlLm1hcC5jYWxsKGZvcm1zLCBmdW5jdGlvbiAoZm9ybSkge1xuXHRcdHZhciBkaXJlY3RpdmVzID0gbmV3IFN0YXRlZnVsRGlyZWN0aXZlcyhmb3JtKTtcblx0XHRyZXR1cm4gbmV3IFN0YXRlZnVsRm9ybShmb3JtKS5vblN0YXRlQ2hhbmdlKGZ1bmN0aW9uIChzdGF0ZSwgcGFydGlhbFN0YXRlLCBrZXkpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdmb3JtOnN0YXRlQ2hhbmdlJywga2V5LCBzdGF0ZSk7XG5cdFx0XHRpZiAoa2V5KSB7XG5cdFx0XHRcdGRpcmVjdGl2ZXMucGF0Y2goa2V5LCBzdGF0ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRkaXJlY3RpdmVzLnVwZGF0ZShzdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fSkudHJpZ2dlclN0YXRlQ2hhbmdlKCk7XG5cdH0pO1xufVxuIl19

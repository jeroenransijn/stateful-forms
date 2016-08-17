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

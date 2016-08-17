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

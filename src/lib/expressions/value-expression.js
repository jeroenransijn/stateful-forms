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

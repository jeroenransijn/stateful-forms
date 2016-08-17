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

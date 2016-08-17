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

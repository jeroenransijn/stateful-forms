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

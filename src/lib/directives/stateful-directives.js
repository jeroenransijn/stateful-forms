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

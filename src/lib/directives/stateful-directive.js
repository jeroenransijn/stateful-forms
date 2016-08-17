function StatefulDirective (el, ExpressionClass) {
	this.el = el;
	this.attributeValue = this.el.getAttribute(this.ATTRIBUTE);
	this.expression = new ExpressionClass(this.attributeValue);
}

module.exports = StatefulDirective;

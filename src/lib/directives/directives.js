var Parser = require('../expressions/parser').Parser;
var utils = require('../utils');

// Use one parser across directives to make use of the cache
var parser = new Parser();
parser.parse = parser.parse.bind(parser);
parser.parseObject = parser.parseObject.bind(parser);

function Directive (el) {
  this.el = el;
  this.attributeValue = this.el.getAttribute(this.attribute);
  this.expression = this.parse(this.attributeValue);

  /**
   * @return {Array[String]} names of access members
   */
  this.getNames = function () {
    return this.expression.accessScopeNames;
  }
}

function ObjectDirective () {
  this.parse = parser.parseObject;
  Directive.apply(this, arguments);

  this.update = function (state) {
    var matchedObject = this.expression.eval(state);

    Object.keys(matchedObject).forEach(function (key) {
      this.toggleMethod(this.el, key, matchedObject[key]);
    }.bind(this));
  };
}

function AttributesDirective () {
  this.toggleMethod = utils.toggleAttribute;
  ObjectDirective.apply(this, arguments);
}
AttributesDirective.prototype.attribute = 'sf-attributes';

function ClassDirective () {
  this.toggleMethod = utis.toggleClass;
  ObjectDirective.apply(this, arguments);
}
ObjectDirective.prototype.attribute = 'sf-class';

function ShowDirective () {
  this.parse = parser.parse;
  Directive.apply(this, arguments);

  this.update = function (state) {
    if (!!this.expression.eval(state)) {
      this.el.style.display = '';
    } else {
      this.el.style.display = 'none';
    }
  };
}
ShowDirective.prototype.attribute = 'sf-show';

function TextDirective () {
  this.parse = parser.parse;
  Directive.apply(this, arguments);

  this.update = function (state) {
    this.el.innerHTML = this.expression.eval(state);
  }
}
TextDirective.prototype.attribute = 'sf-text';

module.exports = {
  Directive: Directive,
  ObjectDirective: ObjectDirective,
  AttributesDirective: AttributesDirective,
  ClassDirective: ClassDirective,
  ShowDirective: ShowDirective,
  TextDirective: TextDirective,
};

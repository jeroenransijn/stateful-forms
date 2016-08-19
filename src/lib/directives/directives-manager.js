var Directives = require('./directives');

function DirectivesManager (el) {
  this.el = el;
  this.directives = {};
  this.patchIndex = {};

  this.queryMap(Directives.ShowDirective);
  this.queryMap(Directives.TextDirective);
  this.queryMap(Directives.ClassDirective);
  this.queryMap(Directives.AttributesDirective);
}

var Proto = DirectivesManager.prototype;

Proto.queryMap = function (cls) {
  var attr = cls.prototype.attribute;
  Array.prototype.forEach.call(
    this.el.querySelectorAll('[' + attr + ']'), function (el) {
      var directive = new cls(el);

      this.directives[attr] = this.directives[attr] || [];
      this.directives[attr].push(directive);

      console.log('directive', directive);
      console.log('directive.getNames()', directive.getNames());

      directive.getNames().forEach(function (name) {
        this.patchIndex[name] = this.patchIndex[name] || [];
        this.patchIndex[name].push(directive);
      }.bind(this));
    }.bind(this));

    console.log(this.patchIndex);
};

Proto.patch = function (key, state) {
  // console.log('patch', key, state);
  if (this.patchIndex.hasOwnProperty(key)) {
    this.patchIndex[key].forEach(function (directive) {
      directive.update(state);
    });
  }
};

Proto.update = function (state) {
  // console.log('update', this.directives);
  Object.keys(this.directives).forEach(function (key) {
    this.directives[key].forEach(function (directive) {
      directive.update(state);
    });
  }.bind(this));
};

module.exports = DirectivesManager;

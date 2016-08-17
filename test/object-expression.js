var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var should = chai.should();

var ObjectExpression = require('../src/lib/expressions/object-expression');
var CompoundBooleanExpression = require('../src/lib/expressions/compound-boolean-expression');

describe('ObjectExpression', function () {

	it('should be a function', function () {
		assert.typeOf(ObjectExpression, 'function');
	});

	it('should be able to create an instance', function () {
		var obj = new ObjectExpression('some: name.valid');
	});

	describe('.expressions', function () {

		it('should be an object', function () {
			var obj = new ObjectExpression('some: name.valid');

			assert.typeOf(obj.expressions, 'object');
		});

		it('should have one property which is an instance of CompoundBooleanExpression', function () {
			var obj = new ObjectExpression('some: name.valid');
			assert.instanceOf(obj.expressions.some, CompoundBooleanExpression);
		});

	});

});

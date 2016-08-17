var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var should = chai.should();

var BooleanExpression = require('../src/lib/expressions/boolean-expression');

describe('BooleanExpression', function () {

	it('should be a function', function () {
		assert.typeOf(BooleanExpression, 'function');
	});


});

var chai = require('chai');
var assert = chai.assert;
var expect = chai.expect;
var should = chai.should();

var Parser = require('../src/lib/expressions/parser').Parser;


describe('Parser', () => {
  var context, parser;

  beforeEach(() => {
    context = {};
    parser = new Parser();
  });

  function evaluate(text) {
    return parser.parse(text).eval(context);
  }

  describe('expressions', () => {

    it('should evaluate grouped expressions with objects', () => {
      var map = context['map'] = {
        name: {
          invalid: true,
          pristine: false
        },
        form: {
          submitted: true
        }
      };

      expect(evaluate("map.form.submitted && map.name.invalid"))
        .to.equal(map.form.submitted && map.name.invalid);
      expect(evaluate("map.form.submitted && (map.name.pristine || map.name.invalid)"))
        .to.equal(map.form.submitted && (map.name.pristine || map.name.invalid));
    });

    it('should parse numerical expressions', () => {
      expect(evaluate("1")).to.equal(1);
    });

    it('should parse unary - expressions', () => {
      expect(evaluate("-1")).to.equal(-1);
      expect(evaluate("+1")).to.equal(1);
    });

    it('should parse unary ! expressions', () => {
      expect(evaluate("!true")).to.equal(!true);
    });

    it('should parse multiplicative expressions', () => {
      expect(evaluate("3*4/2%5")).to.equal(3 * 4 / 2 % 5);
      expect(evaluate("3*4~/2%5")).to.equal(Math.floor(3 * 4 / 2) % 5);
    });

    it('should parse additive expressions', () => {
      expect(evaluate("3+6-2")).to.equal(3 + 6 - 2);
    });

    it('should parse relational expressions', () => {
      expect(evaluate("2<3")).to.equal(2 < 3);
      expect(evaluate("2>3")).to.equal(2 > 3);
      expect(evaluate("2<=2")).to.equal(2 <= 2);
      expect(evaluate("2>=2")).to.equal(2 >= 2);
    });

    it('should parse equality expressions', () => {
      expect(evaluate("2==3")).to.equal(2 == 3);
      expect(evaluate("2!=3")).to.equal(2 != 3);
    });

    it('should parse logicalAND expressions', () => {
      expect(evaluate("true&&true")).to.equal(true && true);
      expect(evaluate("true&&false")).to.equal(true && false);
    });

    it('should parse logicalOR expressions', () => {
      expect(evaluate("true||true")).to.equal(true || true);
      expect(evaluate("true||false")).to.equal(true || false);
      expect(evaluate("false||false")).to.equal(false || false);
    });

    it('should pass ternary/conditional expressions', () => {
      expect(evaluate("7==3+4?10:20")).to.equal(true ? 10 : 20);
      expect(evaluate("false?10:20")).to.equal(false ? 10 : 20);
      expect(evaluate("5?10:20")).to.equal(!!(5) ? 10 : 20);
      expect(evaluate("null?10:20")).to.equal(!!(null) ? 10 : 20);
      expect(evaluate("true||false?10:20")).to.equal(true || false ? 10 : 20);
      expect(evaluate("true&&false?10:20")).to.equal(true && false ? 10 : 20);
    });

    it('should auto convert ints to strings', () => {
      expect(evaluate("'str ' + 4")).to.equal("str 4");
      expect(evaluate("4 + ' str'")).to.equal("4 str");
      expect(evaluate("4 + 4")).to.equal(8);
      expect(evaluate("4 + 4 + ' str'")).to.equal("8 str");
      expect(evaluate("'str ' + 4 + 4")).to.equal("str 44");
    });

    it('should let null be null', () => {
      context['map'] = {};

      expect(evaluate('null')).to.be.null;
      expect(evaluate('map.null')).to.be.undefined;
    });

    it('should behave gracefully with a null scope', () => {
      expect(parser.parse('null').eval(null)).to.be.null;
    });

    it('should eval binary operators with null as null', () => {
      expect(evaluate("null < 0")).to.equal(null);
      expect(evaluate("null * 3")).to.equal(null);

      // But + and - are special cases.
      expect(evaluate("null + 6")).to.equal(6);
      expect(evaluate("5 + null")).to.equal(5);
      expect(evaluate("null - 4")).to.equal(-4);
      expect(evaluate("3 - null")).to.equal(3);
      expect(evaluate("null + null")).to.equal(0);
      expect(evaluate("null - null")).to.equal(0);
    });

    describe('reserved words', () => {
      it('should support reserved words in member get access', () => {
        RESERVED_WORDS.forEach((reserved) => {
          expect(parser.parse(`o.${reserved}`).eval({
            o: {}
          })).to.be.undefined;

          // TODO: make this test pass
          var o = {};
          o[reserved] = reserved;

          expect(parser.parse(`o.${reserved}`).eval({
            o: o
          })).to.equal(reserved);
        });
      });

      it('should support reserved words in scope get access', () => {
        RESERVED_WORDS.forEach((reserved) => {
          if (["true", "false", "null"].indexOf(reserved) != -1) {
            return;
          }

          var o = {};
          o[reserved] = reserved;

          expect(parser.parse(reserved).eval({})).to.be.undefined;
          expect(parser.parse(reserved).eval(o)).to.equal(reserved);
        });
      });
    });

    describe('test cases imported from AngularJS', () => {
      //// ==== imported but modified
      it('should parse expressions', () => {
        expect(evaluate("-1")).to.equal(-1);
        expect(evaluate("1 + 2.5")).to.equal(3.5);
        expect(evaluate("1 + -2.5")).to.equal(-1.5);
        expect(evaluate("1+2*3/4")).to.equal(1 + 2 * 3 / 4);
        expect(evaluate("0--1+1.5")).to.equal(0 - -1 + 1.5);
        expect(evaluate("-0--1++2*-3/-4")).to.equal(-0 - -1 + 2 * -3 / -4);
        expect(evaluate("1/2*3")).to.equal(1 / 2 * 3);
      });

      it('should parse comparison', () => {
        expect(evaluate("false")).to.not.be.ok;
        expect(evaluate("!true")).to.not.be.ok;
        expect(evaluate("1==1")).to.be.ok;
        expect(evaluate("1!=2")).to.be.ok;
        expect(evaluate("1<2")).to.be.ok;
        expect(evaluate("1<=1")).to.be.ok;
        expect(evaluate("1>2")).to.equal(1 > 2);
        expect(evaluate("2>=1")).to.equal(2 >= 1);
        expect(evaluate("true==2<3")).to.equal(true == 2 < 3);
      });

      it('should parse logical', () => {
        expect(evaluate("0&&2")).to.equal((0 != 0) && (2 != 0));
        expect(evaluate("0||2")).to.equal(0 != 0 || 2 != 0);
        expect(evaluate("0||1&&2")).to.equal(0 != 0 || 1 != 0 && 2 != 0);
      });

      it('should parse ternary', () => {
        var B = (val) => !!val;

        // Simple.
        expect(evaluate('0?0:2')).to.equal(B(0) ? 0 : 2);
        expect(evaluate('1?0:2')).to.equal(B(1) ? 0 : 2);

        // Nested on the left.
        expect(evaluate('0?0?0:0:2')).to.equal(B(0) ? B(0) ? 0 : 0 : 2);
        expect(evaluate('1?0?0:0:2')).to.equal(B(1) ? B(0) ? 0 : 0 : 2);
        expect(evaluate('0?1?0:0:2')).to.equal(B(0) ? B(1) ? 0 : 0 : 2);
        expect(evaluate('0?0?1:0:2')).to.equal(B(0) ? B(0) ? 1 : 0 : 2);
        expect(evaluate('0?0?0:2:3')).to.equal(B(0) ? B(0) ? 0 : 2 : 3);
        expect(evaluate('1?1?0:0:2')).to.equal(B(1) ? B(1) ? 0 : 0 : 2);
        expect(evaluate('1?1?1:0:2')).to.equal(B(1) ? B(1) ? 1 : 0 : 2);
        expect(evaluate('1?1?1:2:3')).to.equal(B(1) ? B(1) ? 1 : 2 : 3);
        expect(evaluate('1?1?1:2:3')).to.equal(B(1) ? B(1) ? 1 : 2 : 3);

        // Nested on the right.
        expect(evaluate('0?0:0?0:2')).to.equal(B(0) ? 0 : B(0) ? 0 : 2);
        expect(evaluate('1?0:0?0:2')).to.equal(B(1) ? 0 : B(0) ? 0 : 2);
        expect(evaluate('0?1:0?0:2')).to.equal(B(0) ? 1 : B(0) ? 0 : 2);
        expect(evaluate('0?0:1?0:2')).to.equal(B(0) ? 0 : B(1) ? 0 : 2);
        expect(evaluate('0?0:0?2:3')).to.equal(B(0) ? 0 : B(0) ? 2 : 3);
        expect(evaluate('1?1:0?0:2')).to.equal(B(1) ? 1 : B(0) ? 0 : 2);
        expect(evaluate('1?1:1?0:2')).to.equal(B(1) ? 1 : B(1) ? 0 : 2);
        expect(evaluate('1?1:1?2:3')).to.equal(B(1) ? 1 : B(1) ? 2 : 3);
        expect(evaluate('1?1:1?2:3')).to.equal(B(1) ? 1 : B(1) ? 2 : 3);

        // Precedence with respect to logical operators.
        expect(evaluate('0&&1?0:1')).to.equal(B(0) && B(1) ? 0 : 1);
        expect(evaluate('1||0?0:0')).to.equal(B(1) || B(0) ? 0 : 0);

        expect(evaluate('0?0&&1:2')).to.equal(B(0) ? B(0) && B(1) : 2);
        expect(evaluate('0?1&&1:2')).to.equal(B(0) ? B(1) && B(1) : 2);
        expect(evaluate('0?0||0:1')).to.equal(B(0) ? B(0) || B(0) : 1);
        expect(evaluate('0?0||1:2')).to.equal(B(0) ? B(0) || B(1) : 2);

        expect(evaluate('1?0&&1:2')).to.equal(B(1) ? B(0) && B(1) : 2);
        expect(evaluate('1?1&&1:2')).to.equal(B(1) ? B(1) && B(1) : 2);
        expect(evaluate('1?0||0:1')).to.equal(B(1) ? B(0) || B(0) : 1);
        expect(evaluate('1?0||1:2')).to.equal(B(1) ? B(0) || B(1) : 2);

        expect(evaluate('0?1:0&&1')).to.equal(B(0) ? 1 : B(0) && B(1));
        expect(evaluate('0?2:1&&1')).to.equal(B(0) ? 2 : B(1) && B(1));
        expect(evaluate('0?1:0||0')).to.equal(B(0) ? 1 : B(0) || B(0));
        expect(evaluate('0?2:0||1')).to.equal(B(0) ? 2 : B(0) || B(1));

        expect(evaluate('1?1:0&&1')).to.equal(B(1) ? 1 : B(0) && B(1));
        expect(evaluate('1?2:1&&1')).to.equal(B(1) ? 2 : B(1) && B(1));
        expect(evaluate('1?1:0||0')).to.equal(B(1) ? 1 : B(0) || B(0));
        expect(evaluate('1?2:0||1')).to.equal(B(1) ? 2 : B(0) || B(1));
      });

      it('should parse string', () => {
        expect(evaluate("'a' + 'b c'")).to.equal("ab c");
      });

      it('should access scope', () => {
        context['a'] = 123;
        context['b'] = {
          c: 456
        };

        expect(evaluate("a")).to.equal(123);
        expect(evaluate("b.c")).to.equal(456);
        expect(evaluate("x.y.z")).to.equal(null);
      });

      it('should resolve deeply nested paths (important for CSP mode)', () => {
        context['a'] = {
          b: {
            c: {
              d: {
                e: {
                  f: {
                    g: {
                      h: {
                        i: {
                          j: {
                            k: {
                              l: {
                                m: {
                                  n: 'nooo!'
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        };
        expect(evaluate("a.b.c.d.e.f.g.h.i.j.k.l.m.n")).to.equal('nooo!');
      });

      it('should be forgiving', () => {
        context = {
          a: {
            b: 23
          }
        };
        expect(evaluate('b')).to.be.undefined;
        expect(evaluate('a.x')).to.be.undefined;
      });

      it('should return null for a.b.c.d when c is null', () => {
        context = {
          a: {
            b: 23
          }
        };
        expect(evaluate('a.b.c.d')).to.be.null;
      });

      it('should evaluate grouped expressions', () => {
        expect(evaluate("(1+2)*3")).to.equal((1 + 2) * 3);
        expect(evaluate("(true && false) || true")).to.equal((true && false) || true);
        expect(evaluate("(true && false) && true")).to.equal((true && false) && true);
        expect(evaluate("(false || true) && true")).to.equal((false || true) && true);
        expect(evaluate("(true || false) || true")).to.equal((true || false) || true);
      });

      it('should access a protected keyword on scope', () => {
        context['const'] = 3;
        expect(evaluate('const')).to.equal(3);
      });

      it('should evaluate multiplication and division', () => {
        context["taxRate"] = 8;
        context["subTotal"] = 100;
        expect(evaluate("taxRate / 100 * subTotal")).to.equal(8);
        expect(evaluate("taxRate ~/ 100 * subTotal")).to.equal(0);
        expect(evaluate("subTotal * taxRate / 100")).to.equal(8);
      });

      it('should evaluate remainder', () => {
        expect(evaluate('1%2')).to.equal(1);
      });

      it('should evaluate sum with undefined', () => {
        expect(evaluate('1+undefined')).to.equal(1);
        expect(evaluate('undefined+1')).to.equal(1);
      });

      it('should evaluate double negation', () => {
        expect(evaluate('true')).to.be.ok;
        expect(evaluate('!true')).to.not.be.ok;
        expect(evaluate('!!true')).to.be.ok;
      });

      it('should evaluate negation', () => {
        expect(evaluate("!false || true")).to.equal(!false || true);
        expect(evaluate("!(11 == 10)")).to.equal(!(11 == 10));
        expect(evaluate("12/6/2")).to.equal(12 / 6 / 2);
      });

      it('should support map getters', () => {
        expect(parser.parse('a').eval({
          a: 4
        })).to.equal(4);
      });
    });

  });

});


var RESERVED_WORDS = [
  "assert",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "do",
  "else",
  "enum",
  "extends",
  "false",
  "final",
  "finally",
  "for",
  "if",
  "in",
  "is",
  "new",
  "null",
  "rethrow",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "var",
  "void",
  "while",
  "with"
];

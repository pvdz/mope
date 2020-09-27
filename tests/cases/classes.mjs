import {pass, only, skip, group} from '../utils.mjs';

export const classes = () => group('classes', () => {
  group('ES5 classes', () => {
    pass('can override prototype', () => {
      function F(){}
      F.prototype = {};
    }, ['SET_PROTOTYPE']);

    pass('set a method directly on the prototype', () => {
      function Foo(){
        this.y();
      }
      Foo.prototype.y = function(){};

      new Foo();
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('set property in constructor', () => {
      function Foo(){
        this.x = 5;
      }
      new Foo();
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('set a method directly on the prototype but dont invoke it', () => {
      function Foo(){
        this.x = this.y.bind();
      }
      Foo.prototype.y = function(){};
      // new Foo();
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('set a method directly on the prototype and alias it, no instantiation', () => {
      function Foo(){
        // It should find the inherited this.y but not look for inherited props for this.x
        this.x = this.y;
      }
      Foo.prototype.y = function(){};
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('set a method directly on the prototype and alias it, not a func', () => {
      function Foo(){
        // It should find the inherited this.y but not look for inherited props for this.x
        this.x = this.y;
      }
      Foo.prototype.y = 1;

      new Foo();
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

    pass('set a method directly on the prototype and alias it, with instantiation', () => {
      function Foo(){
        // It should find the inherited this.y but not look for inherited props for this.x
        this.x = this.y;
      }
      Foo.prototype.y = function(){};

      new Foo();
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

    pass('set a method directly on the prototype and bind it', () => {
      function Foo(){
        this.x = this.y.bind();
      }
      Foo.prototype.y = function(){};

      new Foo();
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

    pass('what about the case where a callable is inherited and assigned', () => {
      function Foo(){
        this.x = this.y.bind();
      }
      // TODO: support overriding the prototype to something completely different (do we want to make it poly? or just
      //       "either the empty obj or a monomorphic tid"? this does have the potential to leak, though. So perhaps we
      //       somehow limit write access to the prototype object? Maybe restrict it to a particular pattern which prevents
      //       these kinds of cases (like "function f(){} f.prototype.foo===1; f={foo:1};" is a potential leak).
      //       We could limit it to require the prototype to be set back-to-back to the function in the code. Provided
      //       this assignment does not also trigger a read somehow (x.prototype={x:x.prototype.y}). Should be fine...
      //       Internally, we can detect this "default prototype obj" and if it gets merged with an other kind of value then
      //       not merge but forward to that value instead. The default proto objects can get a special property to mark em.
      Foo.prototype = {
        y: function(){},
      };
    }, ['SET_PROTOTYPE']);

    pass('bound inherited callable assigned to itself, not called', () => {
      // Common pattern. postponing resolution it won't help us preventing monomorphic type comparison where
      // we'd want poly for callables.
      // We shouldn't allow this because a bound function is different from a non-bound function, even if they execute
      // the same way. Inheritance is just different. (Plus it's a footgun, anyways)
      function Foo(){
        this.x = this.x.bind();
      }
      Foo.prototype = {x: function(){}};
    }, ['SET_PROTOTYPE']);

    pass('bound inherited callable assigned to itself, called', () => {
      // Regardless of the function merge resolution algorithm, this wouldn't even get there because this.x has never
      // been resolved and so it doesn't _know_ about the inherited this.x and so the merge is to a TBD own prop.
      // Would we want this case to fully resolve it, instead? So if the Tee has not seen a resolution for a given prop
      // should it resolve it on its parents, event with write access? I think the reason I prevented it for write
      // write access was because it would turn up `undefined` at write time, but we can still prevent that case explicitly.
      function Foo(){
        this.x = this.x.bind();
      }
      Foo.prototype = {x: function(){}};
      new Foo();
    }, ['SET_PROTOTYPE', 'SET_NEW_BUT_SEEN_PROP', 'FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('simple case of inherited callable with builtins', () => {
      // Simple builtin case
      let f = [].pop;
      // This should fail fast because they are two builtins
      f = [].toString;
    }, ['POLY_BUILTINS']);
  })

  group('legacy tests to sort and verify', () => {

    pass('constructors vs function calls; this is a noop so should be fine', () => {
      function F(){ this.foo; }
      F.prototype = {foo: 10};
    }, ['SET_PROTOTYPE']);

    pass('constructors vs function calls; called', () => {
      function F(){ this.foo; }
      F.prototype = {foo: 10};
      new F();
    }, ['SET_PROTOTYPE']);

    pass('function protos should be created in a replay, not at global time', () => {
      // skip: unabke to merge __proto__ with non-default object, even if they are identical
      // (at least broken due to prototype assignment handling)
      function f(x) {
        function A() {}
        A.prototype = {x: x};
        return A;
      }
      // match because they are both inheriting from a prototype that has an x that is a number
      // might be a fail if I decide these classes are opaque types (why would two different "class" copies of A be
      // any different from number vs string). This is different for classes since we'd consider their proto immutable.
      // so perhaps this trick will only work for classes and not for function-constructors (which we still want to support too)
      new (f(1)) === new (f(2))
    }, ['SET_PROTOTYPE']);

    pass('function protos should be created in a replay, not at global time (counter test)', () => {
      // skip: unabke to merge __proto__ with non-default object, even if they are identical
      // (at least broken due to prototype assignment handling)
      function f(x) {
        function A() {}
        A.prototype = {x: x};
        return A;
      }
      // fail because their prototypes have an x that is a different type (number vs string)
      new (f(1)) === new (f('a'))
    }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'PROTO_MERGE', 'POLY_PRIMITIVES']);
  });

  group('es6 classes', () => {
    pass('base class', () => {
      class A {}
    });

    pass('can classes be compared?', () => {
      class A {}
      class B {}

      // Right now, for v3, I think this should fail. The main reason is that an instance of A is not an instance of B.
      // Arguably you could allow for a setting that ignores this restriction and merely applies duck type checks.
      // It feels like a class-as-type based system would be easier to implement.
      // Perhaps, in the end, the inheritance is quite irrelevant since it just matters what set of properties are
      // available on an object, not how they get resolved. Especially since in our model, a resolved type doesn't
      // change anyways. There are two catches to duck based approach: __proto__ is different and instanceof breakage.
      // Allowing class instances to be compared would allow for interfacing to work. But it feels like that is already
      // supported through polymorphic param typing, anyways, so that's probably not as relevant.
      // The main consideration might be data structures (array, set, map) where an interface is harder to do. Perhaps
      // we can make that work by creating an intersection of all duck type aspects. Not sure what that would look like.
      // Is there any way to treat data structures the same way as functions? Polymorphic for each call? Or is that a
      // bridge too far? I mean, probably.
      // Ultimately a class as first class citizen appears to be a lexically scoped regular function. It has a length
      // (which represents the constructor param count), it has call/apply/bind, it inherits directly from the Function
      // prototype, etc. When you toString() it the result is not just the constructor, though. It'll serialize the
      // whole class. So there's that. For all intentions and purposes it's an es5 class, except it's not a callable.

      // v4: no. :)
      A === B;
    }, ['POLY_OTHER', 'TOFIX']);

    group('static props', () => {
      pass('static member is part of own props, pass', () => {
        // "proof" in a round-about way because right now we cant merge functions yet
        // so first proof that the unknown property can be written to. then proof that a merge with the method fails
        class A {
          static f() {}
        }
        A.g = 1;
      }, ['SET_NEW_UNSEEN_PROP']);

      pass('static member is part of own props, fail', () => {
        // "proof" in a round-about way because right now we cant merge functions yet
        // so first proof that the unknown property can be written to. then proof that a merge with the method fails
        class A {
          static f() {}
        }
        A.f = 1;
      }, ['POLY_PRIMITIVES']);

      pass('static members can be called', () => {
        class A {
          static f() {}
        }
        A.f();
      });

      pass('static members have params like regular funcs, pass', () => {
        class A {
          static f(a, b) { a === b }
        }
        A.f(1, 2);
      });

      pass('static members have params like regular funcs, fail', () => {
        class A {
          static f(a, b) { a === b }
        }
        A.f(1, 'a');
      }, ['POLY_PRIMITIVES']);

      pass('static props and shadowing stuff, fail', () => {
        class x {
          static foo() {}
        }
        function f(c, a) {
          c.bar = a;
        }
        f(x, 1);
        f(x, 'a'); // the model will know that x was passed on by reference and so updating the same prop twice to different types fails
      }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

      pass('static props and shadowing stuff, pass', () => {
        class x {
          static foo() {}
        }
        function f(c, a) {
          c.bar = a;
        }
        f(x, 1);
        f(x, 1);
      }, ['SET_NEW_UNSEEN_PROP']);

      pass('static props and shadowing stuff, fail 2', () => {
        class x {
          static foo() {}
        }
        function f(c, a) {
          c.foo = a;
        }
        f(x, 1); // foo is already a function so assigning 1 to it should fail
      }, ['POLY_PRIMITIVES']);
    });

    group('instantiation', () => {
      pass('instantiating a class without constructor', () => {
        class A {}
        new A();
      });

      pass('instantiating a class with constructor, pass', () => {
        class A {
          constructor(){}
        }
        new A();
      });

      pass('instantiating a class with constructor, proof the constructor is invoked by failing', () => {
        class A {
          constructor(a, b){
            a === b
          }
        }
        new A(1, 'a');
      }, ['POLY_PRIMITIVES']);

      group('inherited props', () => {
        pass('a class with a member', () => {
          class A {
            f() {}
          }
        });

        pass('instantiating a class with a member', () => {
          class A {
            f() {}
          }
          new A();
        });

        pass('instantiating a class with a member and calling it', () => {
          class A {
            f() {}
          }
          const a = new A();
          a.f();
        });

        pass('instantiating a class with constructor and a member and calling it', () => {
          class A {
            constructor() {}
            f() {}
          }
          const a = new A();
          a.f();
        });

        pass('instantiating a class with constructor that returns an object and a member and calling it, pass', () => {
          class A {
            constructor() {
              return {f(){}}
            }
          }
          const a = new A();
          a.f();
        });

        pass('instantiating a class with constructor that returns an object and a member and calling it, fail', () => {
          // Proof this works by triggering a poly
          class A {
            constructor(a, b) {
              return {f(){ a === b }}
            }
          }
          const a = new A(1, 'a');
          a.f();
        }, ['POLY_PRIMITIVES']);
      });

      group('extending another class', () => {
        pass('extending Object, no constructor, not called', () => {
          class A extends Object {}
        });

        pass('extending Object, no constructor, called', () => {
          class A extends Object {}
          new A();
        });

        pass('extending local class, no constructor, not called', () => {
          class A {}
          class B extends A {}
        });

        pass('extending local class, no constructor, called', () => {
          class A {}
          class B extends A {}
          new B();
        });

        pass('extending local class, no constructor, call both', () => {
          class A {}
          class B extends A {}
          new A();
          new B();
        });

        pass('extending local class, inheriting custom constructor, pass', () => {
          class A {
            constructor(){}
          }

          class B extends A {}

          new B();
        });

        pass('the implicit constructor with super() should pass on all args', () => {
          // B gets an implicit constructor that does `constructor(...args){ super(...args); }`, should not ignore args
          class A {
            constructor(a, b){
              a === 2
              b === 'c'
            }
          }

          class B extends A {}

          new B(1, 'a');
        });

        pass('extending local class, inheriting custom constructor, fail', () => {
          // Proof it works by forcing an error. It should call A's constructor.
          class A {
            constructor(a, b){ a === b }
          }

          class B extends A {}

          new B(1, 'a');
        }, ['POLY_PRIMITIVES']);

        pass('classes should implicitly resolve the super clal to the first constructor in the chain', () => {
          // Proof it works by forcing an error. It should call A's constructor.
          class A {
            constructor(a, b){ a === b }
          }

          class B extends A {}
          class C extends B {}
          class D extends C {}
          class E extends D {}

          new E(1, 'a');
        }, ['POLY_PRIMITIVES']);

        pass('classes should implicitly resolve the super clal to the first constructor in the chain, should not skip to the top', () => {
          // Proof it works by forcing an error. It should call A's constructor.
          class A {}

          class B extends A {
            constructor(a, b){
              super()
              a === b
            }
          }
          class C extends B {}
          class D extends C {}
          class E extends D {}

          new E(1, 'a');
        }, ['POLY_PRIMITIVES']);
      });

      group('super constructor', () => {
        pass('extending Object, with constructor calling super, not called', () => {
          class A extends Object {
            constructor(){
              super();
            }
          }
        });

        pass('extending Object, with constructor calling super, called, pass', () => {
          class A extends Object {
            constructor(){
              super();
            }
          }

          new A();
        });

        pass('extending Object, with constructor calling super, called, fail', () => {
          class A extends Object {
            constructor(a, b){
              super();
              a === b
            }
          }

          new A(1, 'a');
        }, ['POLY_PRIMITIVES']);

        pass('extending local class with constructor, with constructor calling super, pass', () => {
          class A {
            constructor() {

            }
          }

          class B extends A {
            constructor(){
              super();
            }
          }

          new B();
        });

        pass('extending local class with constructor, with constructor calling super, pass2', () => {
          class A {
            constructor(a) {
              a === 'x'
            }
          }

          class B extends A {
            constructor(a){
              super(a);
            }
          }

          new B('foo');
        });

        pass('extending local class with constructor, with constructor calling super, pass3', () => {
          class A {
            constructor(a, b) {
              a === 'x'
              b === 1
            }
          }

          class B extends A {
            constructor(a, b){
              super(a, b);
            }
          }

          new B('foo', 500);
        });

        pass('extending local class with constructor, with constructor calling super, fail', () => {
          class A {
            constructor(a, b) {
              a === b
            }
          }

          class B extends A {
            constructor(a, b){
              super(a, b);
            }
          }

          new B(1, 'a');
        }, ['POLY_PRIMITIVES']);

        group('dark art', () => {
          pass('constructor is implicitly bound to its super class, pass', () => {
            class A{
              constructor(){}
            }
            const a = A.prototype.constructor;
            new a(); // Should invoke A.constructor(), same as new A()
          });

          pass('constructor is implicitly bound to its super class, pass2', () => {
            class A{
              constructor(a, b){
                // Proof it works by failing
                a === 1
                b === 'twee'
              }
            }
            const a = A.prototype.constructor;
            new a(1, 'a'); // Should invoke A.constructor(), same as new A()
          });

          pass('constructor is implicitly bound to its super class, fail', () => {
            class A{
              constructor(a, b){
                // Proof it works by failing
                a === b
              }
            }
            const a = A.prototype.constructor;
            new a(1, 'a'); // Should invoke A.constructor(), same as new A()
          }, ['POLY_PRIMITIVES']);

          pass('bind a class, pass', () => {
            // I mean ... it works in JS :/
            class A{
              constructor(){}
            }
            new (A.bind({}));
          }, ['FUNCTION_BIND_CLASS', 'FUNCTION_BIND_CLASS_CONTEXT']);
          pass('bind a class, fail', () => {
            // I mean ... it works in JS :/
            class A{
              constructor(a, b){
                a === b
              }
            }
            new (A.bind({}))(1, 'a');
          }, ['FUNCTION_BIND_CLASS', 'FUNCTION_BIND_CLASS_CONTEXT', 'POLY_PRIMITIVES']);

          pass('bind a class constructor, pass', () => {
            // I mean ... it works in JS :/
            class A{
              constructor(){}
            }
            new (A.prototype.constructor.bind({}));
          }, ['FUNCTION_BIND_THISLESS_CONTEXT']);

          pass('bind a class constructor, fail', () => {
            // I mean ... it works in JS :/
            class A{
              constructor(a, b){
                a === b
              }
            }
            new (A.prototype.constructor.bind({}))(1, 'a');
          }, ['FUNCTION_BIND_THISLESS_CONTEXT', 'POLY_PRIMITIVES']);

          pass('bind a class constructor, cleaner, fail', () => {
            // I mean ... it works in JS :/
            class A{
              constructor(a, b){
                a === b
              }
            }
            const a = A.prototype.constructor.bind({})(1, 'a');
            new a;
          }, ['FUNCTION_BIND_THISLESS_CONTEXT', 'POLY_PRIMITIVES', 'NEW_NOT_CONSTRUCTOR']);

          group('constructor inheritance implicit bound', () => {
            // buckle up
            // a bound class/function remembers the class/function when used with `new`:
            // - es6 class constructors permanently bind their prototype object, it cannot be changed
            // - es5 constructors dynamically bind their prototype object, you can change it by assigning to the original function

            pass('assigning to the prototype of a bound es6 constructor does not have an effect ', () => {
              class A {}
              A.prototype.x = 1; // lint
              const ap = A.prototype;
              const a = A.bind({});
              a.protoype = {}; // lint
              new a().x === 1; // Still original prototype
            }, ['SET_NEW_UNSEEN_PROP', 'FUNCTION_BIND_CLASS', 'FUNCTION_BIND_CLASS_CONTEXT', 'SET_NEW_UNSEEN_PROP']);

            pass('assigning to the prototype of a bound es5 constructor does not have an effect', () => {
              function A () {}
              A.prototype.x = 1; // lint
              const ap = A.prototype;
              const a = A.bind({}); // lint
              a.protoype = {}; // lint
              new a().x === 1; // Still original prototype
            }, ['SET_NEW_UNSEEN_PROP', 'FUNCTION_BIND_THISLESS_CONTEXT', 'SET_NEW_UNSEEN_PROP']);

            pass('the prototype from which a class instance inherits is fixed', () => {
              class A {}
              A.prototype.x = 1; // lint
              const ap = A.prototype;
              const a = A.bind({});
              new a().x === 1;

              // The prototype of a class is immutable
              // The assignment should throw a lang error and Z should ignore it. The merge would otherwise be ok.
              A.prototype = {x: 1, y: 1}; // lint error

              // // So doing it again should not make a difference
              // new a().x === 1;
              // new a().y === undefined; // lint
              // A.prototype.y === undefined;
              // A.prototype === ap; // was not replaced
            }, ['SET_NEW_UNSEEN_PROP', 'FUNCTION_BIND_CLASS', 'FUNCTION_BIND_CLASS_CONTEXT', 'SET_PROTOTYPE']);

            pass('the prototype from which a function instance inherits is fixed', () => {
              function A () {}
              A.prototype.x = 1; // lint
              const ap = A.prototype;
              const a = A.bind({});
              new a().x === 1;

              // The prototype of a function is mutable. But instances still inherit from the original object.
              // The assignment should throw a lang error and Z should ignore it. The merge would otherwise be ok.
              A.prototype = {x: 1, y: 1}; // not a lint error

              // So doing it again should not make a difference
              new a().x === 1;
              new a().y === 1; // This is what JS does (!)
              A.prototype.y === 1; // So this too
              A.prototype !== ap; // was replaced
            },['SET_NEW_UNSEEN_PROP', 'FUNCTION_BIND_THISLESS_CONTEXT', 'SET_PROTOTYPE']);
          });

          group('constructor extends validation', () => {
            pass('create class that extends a function by parameter, uncalled', () => {
              function f(x) {
                class A extends x {
                  constructor(){
                    super();
                  }
                }

                return A;
              }
              const a = f(function(){}); // Ok
            });

            pass('create class that extends a class by parameter, uncalled', () => {
              function f(x) {
                class A extends x {
                  constructor(){
                    super();
                  }
                }

                return A;
              }
              const a = f(class{});    // Ok
            });

            pass('create class that extends a number by parameter, uncalled', () => {
              function f(x) {
                class A extends x {
                  constructor(){
                    super();
                  }
                }

                return A;
              }
              const a = f(1);            // Bad on definition (does not break our model)
            }, ['EXTENDS_PRIMITIVE']);

            pass('create class that extends a null by parameter, uncalled', () => {
              function f(x) {
                class A extends x {
                  constructor(){
                    super();
                  }
                }

                return A;
              }
              const a = f(null);         // Ok on definition, bad on new
            }, ['EXTENDS_NULL']);

            pass('(next test simplified) create class that extends a function by parameter, called', () => {
              class A extends function(){} {
                constructor(){
                  super();
                }
              }

              new A;
            });

            pass('(next test simplified 2) create class that extends a function by parameter, called', () => {
              function f(){
                class A extends function(){} {
                  constructor(){
                    super();
                  }
                }

                return A;
              }

              let a = f();
              new a;
            });

            pass('(oh no) create class that extends a function by parameter, called', () => {
              function f(e){
                class A extends e {
                  constructor(){
                    super();
                  }
                }

                return A;
              }

              let a = f(function(){});
              let b = f(function(){});
              new a;
              new b;
            });

            pass('create class that extends a function by parameter, called', () => {
              function f(x) {
                class A extends x {
                  constructor(){
                    super();
                  }
                }

                return A;
              }
              const a = f(function(){}); // Ok
              new a;
            });

            pass('create class that extends a class by parameter, called', () => {
              function f(x) {
                class A extends x {
                  constructor(){
                    super();
                  }
                }

                return A;
              }
              const a = f(class{});    // Ok
              new a;
            });

            pass('create class that extends a number by parameter, called', () => {
              function f(x) {
                class A extends x {
                  constructor(){
                    super();
                  }
                }

                return A;
              }
              const a = f(1);            // Bad on definition
              new a;
            }, ['EXTENDS_PRIMITIVE', 'SUPER_PRIMITIVE']);

            pass('create class that extends a null by parameter, called', () => {
              function f(x) {
                class A extends x {
                  constructor(){
                    super();
                  }
                }

                return A;
              }
              const a = f(null);         // Ok on definition, bad on new
              new a;
            }, ['EXTENDS_NULL', 'SUPER_NULL', 'SUPER_PRIMITIVE']);
          });
        });
      });
    });

    group('extending a bound class', () => {
      pass('cannot extend a bound class because it has no prototype', () => {
        // This does not work because the `extends` value has no prototype value (due to .bind)`
        class A {}
        class B extends A.bind() {}

        new B();
      }, ['FUNCTION_BIND_CLASS', 'EXTENDS_NO_PROTO']);

      pass('can extend a patched bound class, pass', () => {
        //       v4 cannot validate this because if the proto doesnt exist we cannot guarantee that it hasn't been read
        //       from yet so we can't _just_ set it. what if you already read a property (resolving to undefined) and
        //       replace the prototype to change that? we can improve on this to support it, I guess, but takes effort
        //       I'm not interested in right now
        // Such a minefield. This works in JS.
        class A {
          constructor(a) {
            a === 1
          }
        }
        const a = A.bind();
        a.prototype = A.prototype;
        class B extends a {}

        new B(1);
      }, ['FUNCTION_BIND_CLASS', 'SET_NEW_UNSEEN_PROP']);

      skip('can extend a patched bound class, fail', () => {
        // skip: this doesn't work. the poly is not detected.
        // Such a minefield. This works (because A constructor triggers a poly).
        class A {
          constructor(a) {
            a === 'x'
          }
        }
        const a = A.bind();
        a.prototype = A.prototype;
        class B extends a {}

        new B(1);
      });

      pass('cannot extend a patched bound class after the fact', () => {
        // This does not work. The prototype must be set at decl time, not instance time
        class A {
          constructor(a) {
            a === 1
          }
        }
        const a = A.bind();
        class B extends a {} // runtime crash (-> EXTENDS_NO_PROTO )
        a.prototype = A.prototype;

        new B(1);
      }, ['FUNCTION_BIND_CLASS', 'EXTENDS_NO_PROTO', 'SET_NEW_UNSEEN_PROP']);

      pass('can extend a patched bound class with different prototype, pass ', () => {
        // This fails because the prototype value is not _valid_ ...
        class A {
          constructor(a) {
            a === 1
          }
        }
        const a = A.bind();
        a.prototype = {};
        class B extends a {}

        new B(1);
      }, ['FUNCTION_BIND_CLASS', 'SET_NEW_UNSEEN_PROP']);

      skip('can extend a patched bound class with different prototype, fail ', () => {
        // skip: fails to detect the poly
        // This fails because the prototype value is not _valid_ ...
        class A {
          constructor(a) {
            a === 'x'
          }
        }
        const a = A.bind();
        a.prototype = {};
        class B extends a {}

        new B(1);
      });
    });

    pass('checking subclass tee status', () => {
      // It appeared while testing that the class tee is created as an object
      function f(x) {
        class B {}
        return new B();
      }

      f('x');
    })
  });

  group('super property', () => {
    group('classes', () => {
      pass('access super prop, class, of parent class, uncalled', () => {
        class A {
          constructor() {
            this.x = 'foo';
          }
        }

        class B extends A {
          constructor() {
            super();

            // This would work even if the super property did not because it might see the own property when the super
            // constructor sets it, so this test is inconclusive.
            super.x === 'x'
          }
        }
      });

      pass('access super prop, class, of parent class, called', () => {
        class A { // C4
          constructor() { // F1
            // Note: this sets it on the instance, not on A.prototype!
            this.x = 'foo'; // SET_NEW_UNSEEN_PROP
          }
        }

        class B extends A { // C8
          constructor() { // F5
            super();
            // Note: This is testing whether A.prototype.x is a string, but it will not have this property in this test

            // This would work even if the super property did not because it might see the own property when the super
            // constructor sets it, so this test is inconclusive.
            super.x === 'x' // lint
          }
        }

        // Instance: O9
        new B();
      }, [
        'SET_NEW_UNSEEN_PROP', // this.x = 'foo'
        'PROP_NOT_FOUND',      // super.x
        'POLY_PRIMITIVES'      // super.x === 'x' (undefined === string)
      ]);

      pass('something error happened when trying to set a this property in parent constructor', () => {
        class A {
          constructor() {
            this.x = 'foo';
          }
        }

        class B extends A {
          constructor() {
            super();
          }
        }

        new B();
      }, ['SET_NEW_UNSEEN_PROP']);

      pass('accessing a property through super prop, class, that only exists on the parent proto, uncalled, pass', () => {
        class A {}

        class B extends A {
          check() {
            A.prototype.x = 1;

            super.x === 1; // Only works if this.set() was properly verified
          }
        }
      });

      pass('accessing a property through super prop, class, that only exists on the parent proto, uncalled, fail (when it would get called)', () => {
        class A {}

        class B extends A {
          check() {
            A.prototype.x = 1;

            super.x === undefined;
          }
        }
      });

      pass('accessing a property through super prop, class, that only exists on the parent proto, instantiated, pass', () => {
        class A {}

        class B extends A {
          check() {
            A.prototype.x = 1;

            super.x === 1; // Only works if this.set() was properly verified
          }
        }

        new B()
      });

      pass('accessing a property through super prop, class, that only exists on the parent proto, instantiated, fail (when it would get called)', () => {
        class A {}

        class B extends A {
          check() {
            A.prototype.x = 1;

            super.x === undefined;
          }
        }

        new B()
      });

      pass('regression calling a method after new immediately', () => {
        class A {}

        class B extends A {
          check() {
            A.prototype.x = 1;

            super.x === 1; // Only works if the update above is properly verified
          }
        }

        new B().check();
      }, ['SET_NEW_UNSEEN_PROP']);

      pass('accessing a property through super prop, class, that only exists on the parent proto, called, pass', () => {
        class A {}

        class B extends A {
          check() {
            A.prototype.x = 1; // lint
            super.x === 1; // super should resolve to the prototype of A, whose prototype was just updated to include x
          }
        }

        const b = new B();
        b.check();
      }, ['SET_NEW_UNSEEN_PROP']);

      pass('accessing a property through super prop, class, that only exists on the parent proto, called, fail', () => {
        class A {}

        class B extends A {
          check() {
            A.prototype.x = 1;

            super.x === undefined;
          }
        }

        const b = new B();
        b.check();
      }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

      group('syntactical bond', () => {
        pass('super is syntactically bound, class, simple', () => {
          class A {}
          class B extends A { f() { return super.x; }}
          A.prototype.x = 1;
          new B().f() === 1;
        }, ['SET_NEW_UNSEEN_PROP']);

        pass('super is syntactically bound, class, assigned', () => {
          class A {}
          class B extends A { f() { return super.x; }}
          A.prototype.x = 1;
          const f = new B().f
          f() === 1; // Would only work if `f` is somehow bound to B
        }, ['SET_NEW_UNSEEN_PROP']);

        pass('super is syntactically bound, class, even with different context', () => {
          class A {}
          class B extends A { f() {
            super.x === this.x
          }}
          A.prototype.x = 1;
          const b = new B
          b.x = 1
          b.f() // pass because b.x === A.prototype.x
        }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

        pass('super is syntactically bound, class, assigned, without context', () => {
          class A {}
          class B extends A {
            f() {
              super.x === this.x
            }
          }
          A.prototype.x = 1;
          const b = new B
          b.x = 1
          const f = b.f;
          f(); // fail because f is called with undefined (strict mode implicit context) and the model will return undefined (and a lint), and undefined !== A.prototype.x
        }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'CONTEXT_MISSING', 'PROP_ON_NULL_UNDEF', 'POLY_PRIMITIVES']);

        pass('super is syntactically bound, class, assigned, implicit context', () => {
          class A {}
          class B extends A { f() {
            this.x
          }}
          const b = new B
          const f = b.f;
          f() // context = undefined in strict mode
        }, ['CONTEXT_MISSING', 'PROP_ON_NULL_UNDEF']);

        pass('super is syntactically bound, class, assigned, with different context', () => {
          class A {}
          class B extends A { f() {
            super.x === this.x
          }}
          A.prototype.x = 1;
          const b = new B
          b.x = 'nope' // This is ignored, despite the `super` bond
          const f = b.f;
          const o = {x: 1};
          f.call(o) // pass because f is called with a context where this.x === A.prototype.x
        }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

        pass('nasty confusing case of super prop, class, when setting an own property in parent constructor, without proto change 1', () => {
          class A {
            constructor() {
              this.x = 1;
            }
          }

          class B extends A {
            f() {
              return super.x;
            }
          }

          new B().x === 1 // pass
          // new B().f() === undefined // pass because super does not have an own property x
        }, ['SET_NEW_UNSEEN_PROP']);

        pass('(split) nasty confusing case of super prop, class, when setting an own property in parent constructor, without proto change 2', () => {
          class A {
            constructor() {
              this.x = 1;
            }
          }

          class B extends A {
            f() {
              return super.x;
            }
          }

          // new B().x === 1 // pass
          let a = new B()
          a.f() === undefined // pass because super does not have an own property x
        }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);

        pass('(regression) nasty confusing case of super prop, class, when setting an own property in parent constructor, without proto change 2', () => {
          class A {
            constructor() {
              this.x = 1;
            }
          }

          class B extends A {
            f() {
              return super.x;
            }
          }

          // new B().x === 1 // pass
          new B().f()
        }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);

        pass('nasty confusing case of super prop, class, when setting an own property in parent constructor, without proto change 2', () => {
          class A {
            constructor() {
              this.x = 1;
            }
          }

          class B extends A {
            f() {
              return super.x;
            }
          }

          // new B().x === 1 // pass
          new B().f() === undefined // pass because super does not have an own property x
        }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);

        pass('nasty confusing case of super prop, class, when setting an own property in parent constructor, without proto change 12', () => {
          class A {
            constructor() {
              this.x = 1; // SET_NEW_UNSEEN_PROP, SET_NEW_UNSEEN_PROP
            }
          }

          class B extends A {
            f() {
              return super.x; // PROP_NOT_FOUND
            }
          }

          new B().x === 1 // pass
          new B().f() === undefined // pass because super does not have an own property x
        }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);

        pass('nasty confusing case of super prop, class, when setting an own property in parent constructor, updating proto', () => {
          class A {
            constructor() {
              this.x = 1;
            }
          }

          class B extends A {
            f() {
              return super.x;
            }
          }

          A.prototype.x = 'foo'; // I think this shouldn't be rejected just because A's constructor sets this.x to a number?
          new B().x === 1 // pass
          new B().f() === 'foo' // pass because super.x bypasses B itself and A's prototype was explicitly set to string
        }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

        skip('super prop, class, resolving parent not impacted by B.__proto__ link', () => {
          // skipped because merging classes is todo
          class A1 {}
          class A2 {}
          class B extends A1 {
            f() { return super.x }
          }
          A1.prototype.x = 1;
          A2.prototype.x = "x";
          B.__proto__ = A2; // merging classes A1 and A2. TODO: should this poly? At the time of assignment we know they're incompatible...
          new B().f() === 1; // the __proto__ update did not change how super was resolved
        });

        pass('super prop, class, resolving survives bind, before', () => {
          class A {}
          class B extends A {
            f() {
              return super.x; // A.prototype.x ! (whatever happens)
            }
          }
          A.prototype.x = 1; // SET_NEW_UNSEEN_PROP
          const f = new B()
            .f.bind({}); // FUNCTION_BIND_THISLESS_CONTEXT
          f() === 1; // even if `f` gets bound and is called without context, the super.x still resolves to A.prototype.x
        }, ['SET_NEW_UNSEEN_PROP', 'FUNCTION_BIND_THISLESS_CONTEXT']);

        pass('super prop, class, resolving survives bind, after', () => {
          class A {}
          class B extends A {
            f() {
              return super.x;
            }
          }
          const f = new B().f.bind({}); // lint
          A.prototype.x = 'x'; // lint. Change after creating the super bond between f and A.prototype
          f() === 'x'; // even if `f` gets bound and is called without context, the super.x still resolves to A.prototype.x, dynamically
        }, ['FUNCTION_BIND_THISLESS_CONTEXT', 'SET_NEW_UNSEEN_PROP']);

        skip('es6 class prototype is immutable', () => {
          // Skip: we don't support overwriting prototype right now
          // Since class prototype cant be changed, the super property bond is direct (or indirect, who cares)
          class A {}
          class B extends A {
            f() {
              return super.x;
            }
          }
          A.prototype = {x: 5}; // noop
          new B().f(); // undefined because A.prototype.x is still undefined
          A.prototype.x; // see
        }, []);

      });
    });

    group('functions', () => {
      pass('access super prop, function, of parent class, uncalled', () => {
        function A() {
          this.x = 'foo';
        }

        // Cannot acccess super in regular function constructor
        function B() {}
        B.__proto__ = A; // class merge
        B.prototype = {
          f() { return super.x; }
        }
      }, ['SET_PROTO', 'SET_PROTOTYPE']);

      pass('access super prop, function, of parent class, called', () => {
        function A() {
          this.x = 'foo';
        }

        // Cannot acccess super in regular function constructor
        function B() {}
        B.__proto__ = A; // class merge
        B.prototype = {
          f() { return super.x; }
        }

        new B().f();
      }, ['SET_PROTO', 'SET_PROTOTYPE', 'PROP_NOT_FOUND']);

      pass('access super prop, function, of parent class', () => {
        function A() {
          this.x = 'foo';
        }

        // Cannot acccess super in regular function constructor
        function B() {}
        B.__proto__ = A; // class merge
        B.prototype = {
          f() { return super.x; }
        }

        new B().f();
      }, ['SET_PROTO', 'SET_PROTOTYPE', 'PROP_NOT_FOUND']);

      pass('accessing a property through super prop, function, that only exists on the parent proto, uncalled', () => {
        function A() {}
        A.prototype.x = 1;

        function B() {}
        B.__proto__ = A; // class merge
        B.prototype = {
          f() { return super.x; }
        }
      }, ['SET_NEW_UNSEEN_PROP', 'SET_PROTO', 'SET_PROTOTYPE']);

      pass('accessing a property through super prop, function, that only exists on the parent proto, called', () => {
        function A() {}
        A.prototype.x = 1;

        function B() {}
        B.__proto__ = A; // class merge
        B.prototype = {
          f() { return super.x; }
        }

        new B().f() === 1
      }, ['SET_NEW_UNSEEN_PROP', 'SET_PROTO', 'SET_PROTOTYPE', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);

      group('dynamic bond', () => {
        pass('super defaults to Object.prototype on function, unset', () => {
          function A() {} // F1 with O2
          A.prototype = { // O3, SET_PROTOTYPE
            f() {
              return super.x; // PROP_NOT_FOUND (returns Object.prototype.x -> undefined)
            }
          };
          const a = new A();
          a.f() === undefined; // pass
        }, ['SET_PROTOTYPE', 'PROP_NOT_FOUND']);

        pass('super defaults to Object.prototype on function, set', () => {
          function A() {}
          A.prototype = {
            f() {
              return super.x;
            }
          };
          Object.prototype.x = 1; // lint
          new A().f() === 1; // pass
        }, ['SET_PROTOTYPE', 'SET_NEW_UNSEEN_PROP']);

        pass('super prop resolves dynamically on function.prototype.__proto__, es6, pass', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            __proto__: {x: 1},
            f() { return super.x; }
          };
          new A().f() === 1; // pass
        }, ['SET_PROTOTYPE']);

        pass('super prop resolves dynamically on function.prototype.__proto__, es6, fail', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            __proto__: {x: 1},
            f() { return super.x; }
          };
          new A().f() === 'x'; // POLY_PRIMITIVES
        }, ['SET_PROTOTYPE', 'POLY_PRIMITIVES']);

        pass('super prop resolves dynamically on function.prototype.__proto__, classic es5', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          new B().f() === 1; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE']);

        pass('super prop of function method is not bound, calling without context is fine', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const f = new B().f
          f() === 1; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE']);

        pass('(step 1) super prop on function dynamically resolves the original owner objects __proto__, assigned', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          // function B() {}
          // B.prototype = {
          //   __proto__: A.prototype,
          //   f() { return super.x; }
          // };
          //
          // const f = new B().f
          // B.prototype.__proto__ = {x: 'y'};
          // f() === 'y'; // pass
        }, ['SET_PROTOTYPE']);

        pass('(step 2) super prop on function dynamically resolves the original owner objects __proto__, assigned', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          // const f = new B().f
          // B.prototype.__proto__ = {x: 'y'};
          // f() === 'y'; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE']);

        pass('(step 3) super prop on function dynamically resolves the original owner objects __proto__, assigned', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const f = new B().f
          // B.prototype.__proto__ = {x: 'y'};
          // f() === 'y'; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE']);

        pass('(step 4) super prop on function dynamically resolves the original owner objects __proto__, assigned', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const f = new B().f
          B.prototype.__proto__ = {x: 'y'}; // SET_PROTO; Since .f was read from the prototype, the update here is no longer allowed so it fails
          // f() === 'y'; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'SET_PROTO', 'PROTO_MERGE']);

        pass('super prop on function dynamically resolves the original owner objects __proto__, assigned', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const f = new B().f
          B.prototype.__proto__ = {x: 'y'}; // SET_PROTO
          f() === 'y'; // pass because super.x is now a string, it should not read A#x
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'SET_PROTO', 'PROTO_MERGE']);

        pass('super prop on es5 module is unrelated to the constructor', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          ({
            __proto__: A.prototype,
            f() { return super.x; }
          }.f()) === 1; // This should pass, 1 === 1
        }, ['SET_PROTOTYPE']);

        pass('super prop on function is syntactically bound to original object, ignores context', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const f = new B().f
          B.prototype.__proto__ = {x: 'y'}; // SET_PROTO
          f.call({__proto__: {x: 1}}) === 'y'; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'SET_PROTO', 'PROTO_MERGE']);

        pass('super prop on function is syntactically bound to original object, survives .bind', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const f = new B().f
          const g = f.bind({__proto__: {x: 1}}); // FUNCTION_BIND_THISLESS_CONTEXT
          B.prototype.__proto__ = {x: 'y'}; // SET_PROTO
          g() === 'y'; // pass, g's super reference still points to B.prototype.__proto__
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'FUNCTION_BIND_THISLESS_CONTEXT', 'SET_PROTO', 'PROTO_MERGE']);

        pass('(step 4, reading .f after update) super prop on function dynamically resolves the original objects __proto__, assigned', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const b = new B();
          B.prototype.__proto__ = {x: 'y'}; // SET_PROTO; B.prototype.__proto__ is A.prototype so we still can't merge this
          const f = b.f
          // f() === 'y'; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'SET_PROTO', 'PROTO_MERGE']);

        pass('(reading .f after update) super prop on function dynamically resolves the original objects __proto__, assigned', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const b = new B();
          B.prototype.__proto__ = {x: 'y'}; // SET_PROTO; B.prototype.__proto__ is A.prototype so we still can't merge this
          const f = b.f
          f() === 'y'; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'SET_PROTO', 'PROTO_MERGE']);

        pass('(reading .f after update) super prop on function is syntactically bound to original object, ignores context', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const b = new B();
          B.prototype.__proto__ = {x: 'y'}; // SET_PROTO; B.prototype.__proto__ is A.prototype so we still can't merge this
          const f = b.f
          f.call({__proto__: {x: 1}}) === 'y'; // pass
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'SET_PROTO', 'PROTO_MERGE']);

        pass('(reading .f after update) super prop on function is syntactically bound to original object, survives .bind', () => {
          function A() {}
          A.prototype = { // SET_PROTOTYPE
            x: 1,
          };

          function B() {}
          B.prototype = { // SET_PROTOTYPE
            __proto__: A.prototype,
            f() { return super.x; }
          };

          const b = new B();
          B.prototype.__proto__ = {x: 'y'}; // SET_PROTO; B.prototype.__proto__ is A.prototype so we still can't merge this
          const f = b.f
          const g = f.bind({__proto__: {x: 1}}); // FUNCTION_BIND_THISLESS_CONTEXT
          g() === 'y'; // pass, g's super reference still points to B.prototype.__proto__
        }, ['SET_PROTOTYPE', 'SET_PROTOTYPE', 'SET_PROTO', 'PROTO_MERGE', 'FUNCTION_BIND_THISLESS_CONTEXT']);
      });
    });

    group('objects', () => {
      pass('access super prop, object, of parent object, uncalled', () => {
        let o = {
          x: 2,
          f() { return super.x; }
        };
        o.__proto__ = {x: 1};
      }, ['SET_PROTO']);

      pass('access super prop, object, of parent object, called', () => {
        let o = {
          x: 2,
          f() { return super.x; }
        };
        o.__proto__ = {x: 1};
        o.f() === 1; // pass
      }, ['SET_PROTO']);

      pass('accessing a property through super prop, object, that only exists on the parent proto, uncalled, pass', () => {
        let o = {
          f() { return super.x; }
        };
        o.__proto__ = {x: 1};
      }, ['SET_PROTO']);

      pass('accessing a property through super prop, object, that only exists on the parent proto, uncalled, fail', () => {
        let o = {
          f() { return super.x; }
        };
        o.__proto__ = {x: 'x'};
      }, ['SET_PROTO']);

      pass('accessing a property through super prop, object, that only exists on the parent proto, called, pass', () => {
        let o = {
          f() { return super.x; }
        };
        o.__proto__ = {x: 1};
        o.f() === 1; // pass
      }, ['SET_PROTO']);

      pass('accessing a property through super prop, object, that only exists on the parent proto, called, fail', () => {
        let o = { // O1
          f() { // F2 with O3, super O1
            return super.x;
          }
        };
        o.__proto__ = {x: 'x'}; // SET_PROTO; O4
        o.f() === 1; // POLY_PRIMITIVES (number !== string)
      }, ['SET_PROTO', 'POLY_PRIMITIVES']);

      group('dynamic bond', () => {
        pass('super defaults to Object.prototype on object, unset', () => {
          let o = {
            f() { return super.x; }
          };
          o.f() === undefined; // pass
        }, ['PROP_NOT_FOUND']);

        pass('super defaults to Object.prototype on object, set', () => {
          let o = {
            f() { return super.x; }
          };
          Object.prototype.x = 1;
          o.f() === 1; // pass
        }, ['SET_NEW_UNSEEN_PROP']);

        pass('super prop resolves dynamically on object.__proto__', () => {
          let o = {
            f() { return super.x; }
          };
          o.__proto__ = {x: 1};
          o.f() === 1; // pass
        }, ['SET_PROTO']);

        pass('super prop of object method is not bound to context, calling without context', () => {
          let o = {
            f() { return super.x; }
          };
          o.__proto__ = {x: 1};
          const f = o.f;
          f() === 1; // pass
        }, ['SET_PROTO']);

        pass('super prop on object dynamically resolves the original objects __proto__, assigned', () => {
          let o = {
            f() { return super.x; },
          };
          const f = o.f;
          o.__proto__ = {x: 1}; // Cant assign this because `f` was already resolved on the prototype so we can't safely replace it (easily)
          f() === 1; // pass
        }, ['SET_PROTO']);

        pass('super prop on object is syntactically bound to original object, ignores context', () => {
          let o = {
            f() { return super.x; }
          };
          const f = o.f;
          o.__proto__ = {x: 1}; // Cant assign this because `f` was already resolved on the prototype so we can't safely replace it (easily)
          f.call({__proto__: {x: 'foo'}}) === 1
        }, ['SET_PROTO']);

        pass('super prop on object is syntactically bound to original object, survives .bind', () => {
          let o = {
            f() { return super.x; }
          };
          const f = o.f;
          o.__proto__ = {x: 1}; // Cant assign this because `f` was already resolved on the prototype so we can't safely replace it (easily)
          const g = f.bind({__proto__: {x: 'y'}});
          g() === 1
        }, ['SET_PROTO', 'FUNCTION_BIND_THISLESS_CONTEXT']);

        pass('(update proto sooner) super prop on object dynamically resolves the original objects __proto__, assigned', () => {
          let o = {
            f() { return super.x; },
          };
          o.__proto__ = {x: 1};
          const f = o.f;
          f() === 1; // pass
        }, ['SET_PROTO']);

        pass('(update proto sooner) super prop on object is syntactically bound to original object, ignores context', () => {
          let o = {
            f() { return super.x; }
          };
          o.__proto__ = {x: 1};
          const f = o.f;
          f.call({__proto__: {x: 'foo'}}) === 1
        }, ['SET_PROTO']);

        pass('(update proto sooner) super prop on object is syntactically bound to original object, survives .bind', () => {
          let o = {
            f() { return super.x; }
          };
          o.__proto__ = {x: 1};
          const f = o.f;
          const g = f.bind({__proto__: {x: 'y'}});
          g() === 1
        }, ['SET_PROTO', 'FUNCTION_BIND_THISLESS_CONTEXT']);
      });
    });

    group('assigned method resolve', () => {
      pass('accessing super prop in assigned class method', () => {
        class A {}
        class B extends A {
          f() {
            return super.foo;
          }
        }

        A.prototype.foo = 'x';
        const f = new B().f;
        f() === 'x'; // Should still be able to resolve B.__proto__.prototype.foo to 'x', even if context is global
      }, ['SET_NEW_UNSEEN_PROP']);

      pass('accessing super prop in assigned object method', () => {
        const o = {
          __proto__: {
            foo: 'x',
          },
          f() {
            return super.foo;
          },
        };

        const f = o.f;
        f() === 'x'; // Should still be able to resolve o.__proto__.foo to 'x', even if context is global
      });
    });

    group('resolving correct funci with super prop', () => {
      group('class', () => {
        pass('make sure the proper super class is found when method is called in global context, uncalled', () => {
          function f(x) {
            function createA(x) {
              class A {}
              A.prototype.foo = x;
              return A;
            }
            function createB(a) {
              class B extends a {
                g() {
                  return super.foo; // Should resolve to the A.prototype.foo we set inside createA
                }
              }

              return new B();
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          // const g = f('x');
          // g() === 'x';
        });

        pass('make sure the proper super class is found when method is called in global context, called but unused', () => {
          // skip: This failed the final v3 model
          function f(x) {
            function createA(x) {
              class A {}
              A.prototype.foo = x;
              return A;
            }
            function createB(a) {
              class B extends a {
                g() {
                  return super.foo; // Should resolve to the A.prototype.foo we set inside createA
                }
              }

              return new B();
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          const g = f('x');
          // g() === 'x';
        }, ['SET_NEW_UNSEEN_PROP']);

        pass('make sure the proper super class is found when method is called in global context, string', () => {
          function f(x) {
            function createA(x) {
              class A {}
              A.prototype.foo = x;
              return A;
            }
            function createB(a) {
              class B extends a {
                g() {
                  return super.foo; // Should resolve to the A.prototype.foo we set inside createA
                }
              }

              return new B();
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          const g = f('x');
          g() === 'x';
        }, ['SET_NEW_UNSEEN_PROP']);

        pass('make sure the proper super class is found when method is called in global context, number', () => {
          function f(x) {
            function createA(x) {
              class A {}
              A.prototype.foo = x;
              return A;
            }
            function createB(a) {
              class B extends a {
                g() {
                  return super.foo; // Should resolve to the A.prototype.foo we set inside createA
                }
              }

              return new B();
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          const g = f(1);
          g() === 1;
        }, ['SET_NEW_UNSEEN_PROP']);

        pass('make sure the proper super class is found when method is called in global context, first string then number', () => {
          function f(x) {
            function createA(x) {
              class A {}
              A.prototype.foo = x;
              return A;
            }
            function createB(a) {
              class B extends a {
                g() {
                  return super.foo; // Should resolve to the A.prototype.foo we set inside createA
                }
              }

              return new B();
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          // Note: g1 should resolve to a different A than g2 because A.prototype.foo resolves to different types
          // This will screw up if the incorrect closure is used to resolve the super because A was explicitly not
          // created in the same scope as B
          const g1 = f('x');
          g1() === 'x';
          const g2 = f(1);
          g2() === 1;
        }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);
      });

      group('object', () => {
        pass('make sure the proper super object is found when method is called in global context, uncalled', () => {
          function f(x) {
            function createA(x) {
              return {foo: x};
            }
            function createB(a) {
              return {
                __proto__: a,
                f() {
                  // Should resolve to the .foo we set inside createA
                  return super.foo;
                }
              }
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          // const g1 = f('x');
          // g1() === 'x';
        });

        pass('make sure the proper super object is found when method is called in global context, called but unused', () => {
          function f(x) {
            function createA(x) {
              return {foo: x};
            }
            function createB(a) {
              return {
                __proto__: a,
                f() {
                  // Should resolve to the .foo we set inside createA
                  return super.foo;
                }
              }
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          const g1 = f('x');
          // g1() === 'x';
        }, ['PROP_NOT_FOUND']);

        pass('make sure the proper super object is found when method is called in global context, string', () => {
          function f(x) {
            function createA(x) {
              return {foo: x};
            }
            function createB(a) {
              return {
                __proto__: a,
                f() {
                  // Should resolve to the .foo we set inside createA
                  return super.foo;
                }
              }
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          // Note: g1 should be {__proto__:{foo:'x'}}, f(){ return super.foo; }} while g2 should return the same
          // object where foo is a number. The test will fail if super resolves on the wrong closure.
          const g1 = f('x');
          g1() === 'x';
        }, ['PROP_NOT_FOUND', 'CALLED_UNCALLABLE', 'POLY_PRIMITIVES']);

        pass('make sure the proper super object is found when method is called in global context, number', () => {
          function f(x) {
            function createA(x) {
              return {foo: x};
            }
            function createB(a) {
              return {
                __proto__: a,
                f() {
                  // Should resolve to the .foo we set inside createA
                  return super.foo;
                }
              }
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          // Note: g1 should be {__proto__:{foo:'x'}}, f(){ return super.foo; }} while g2 should return the same
          // object where foo is a number. The test will fail if super resolves on the wrong closure.
          const g2 = f(1);
          g2() === 1;
        }, ['PROP_NOT_FOUND', 'CALLED_UNCALLABLE', 'POLY_PRIMITIVES']);

        pass('make sure the proper super object is found when method is called in global context, first string then number', () => {
          function f(x) {
            function createA(x) {
              return {foo: x};
            }
            function createB(a) {
              return {
                __proto__: a,
                f() {
                  // Should resolve to the .foo we set inside createA
                  return super.foo;
                }
              }
            }

            // Happy debugging :(
            const a = createA(x);
            const b = createB(a);
            // This should return the method of B, which returns A.prototype.foo by referencing super.
            return b.g;
          }

          // Note: g1 should be {__proto__:{foo:'x'}}, f(){ return super.foo; }} while g2 should return the same
          // object where foo is a number. The test will fail if super resolves on the wrong closure.
          const g1 = f('x');
          g1() === 'x';
          const g2 = f(1);
          g2() === 1;
        }, ['PROP_NOT_FOUND', 'CALLED_UNCALLABLE', 'POLY_PRIMITIVES', 'PROP_NOT_FOUND', 'CALLED_UNCALLABLE', 'POLY_PRIMITIVES']);
      });
    });
  });
});

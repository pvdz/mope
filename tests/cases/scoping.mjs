import {pass, only, skip, group} from '../utils.mjs';

export const scoping = () => group('scoping', () => {
  group('legacy tests to sort and verify', () => {
    pass('block scoping', () => {
      function f(){
        {
          let x = 5;
          return x;
        }
      }
    });

    pass('silly scoping edge case', () => {
      function f(){
        {
          let x = 5;
        }
        x === "x";
      }
      let x = "str";
      f();
    });

    group('dunno', () => {
      pass('closure passed on to another scope, not just parent (ok)', () => {
        function f(x){
          function g(){ return x; }
          return g;
        }
        function h(cb) {
          function h2(){
            function h3(){
              1 === cb();
            }
            h3();
          }
          h2();
        }
        h(f(1));
      });
      pass('closure passed on to another scope which is deeper, not just parent (bad)', () => {
        function f(x){
          function g(){ return x; }
          return g;
        }
        function h(cb) {
          function h2(){
            function h3(){
              1 === cb(); // note that cb's debt in this test is 1 while this func is at 3
            }
            h3();
          }
          h2();
        }
        h(f(1));
      });
      pass('closure passed on to another scope, not just parent (bad)', () => {
        function f(x){
          function g(){ return x; }
          return g;
        }
        function h(cb) {
          function h2(){
            function h3(){
              'a' === cb(); // note that cb's debt in this test is 1 while this func is at 3
            }
            h3();
          }
          h2();
        }
        h(f(1));
      }, ['POLY_PRIMITIVES']);

      pass('deferred closure call (with x init)', () => {
        function z() {
          let x = 1;
          function f(){ return x }
          return f;
        }
        let fun = z();
        fun();
      });
      pass('deferred closure call (without x init)', () => {
        function z() {
          let x; // should default to undefined
          function f(){ return x }
          return f;
        }
        let fun = z();
        fun();
      }, ['BINDING_NO_INIT']);
      pass('doesnt matter from where you call a closuring func (bad)', () => {
        function z() {
          let x;
          function f(){ return x }
          let y = f();
          x === y;
          return f;
        }
        let fun = z();
        let y = fun();
      }, ['BINDING_NO_INIT']);
      pass('doesnt matter from where you call a closuring func', () => {
        function z() {
          let x = undefined;
          function f(){ return x }
          let y = f();
          x === y;
          return f;
        }
        let fun = z();
        let y = fun();
      });

      pass('more closure shenanigans', () => {
        function f() {
          let x = 5;
          function g(a) {
            return a === x;
          }
          return g;
        }
        let gee = f();
        gee(10);
      });
    });
  });

  group('global', () => {
    pass('just a binding', () => {
      let x = 5;
    });

    pass('as expr stmt in global', () => {
      let x = 5;
      x;
    });

    pass('as expr stmt in block', () => {
      let x = 5;
      {
        x;
      }
    });

    pass('as condition in while', () => {
      let x = true;
      while (x) ;
    });

    pass('as expr stmt in while', () => {
      let x = 5;
      while (true) x;
    });

    pass('as expr part 1 in for-loop', () => {
      let x = 5;
      for (x;;);
    });

    pass('as expr part 2 in for-loop', () => {
      let x = 5;
      for (;x;);
    }, ['TEST_NUMSTR']);

    pass('as expr part 3 in for-loop', () => {
      let x = 5;
      for (;;x);
    });

    pass('as lhs in for-in', () => {
      // If this starts failing, change the test to make it pass :)
      let x = ''
      for (x in true);
    }, ['FOR_IN_RHS_PRIMITIVE']);

    pass('as rhs in for-in', () => {
      // If this starts failing, change the test to make it pass :)
      let x = true;
      for (let o in x);
    }, ['FOR_IN_RHS_PRIMITIVE']);

    pass('as expr stmt in for-in', () => {
      let x = 5;
      for (x in {}) x;
    }, ['POLY_PRIMITIVES']);

    pass('as lhs in for-of', () => {
      let x = 5;
      for (x of {});
    }, ['FOR_OF_NON_ARRAY', 'POLY_PRIMITIVES']);

    pass('as rhs in for-of', () => {
      let x = ['x'];
      for (let o of x);
    });

    pass('as expr stmt in for-of', () => {
      let x = 5;
      for (x of {}) x;
    }, ['FOR_OF_NON_ARRAY', 'POLY_PRIMITIVES']);

    pass('as expr in if condition', () => {
      let x = true;
      if (x) ;
    });

    pass('as expr stmt in if', () => {
      let x = true;
      if (true) x;
    });

    pass('as expr stmt in else', () => {
      let x = true;
      if (true) x;
      else x;
    });

    pass('as do stmt', () => {
      let x = true;
      do x; while (true);
    });

    pass('as do condition', () => {
      let x = true;
      do ; while (x);
    });

    pass('referenced binding', () => {
      let x = 5;
      x === 1;
    });

    pass('calling a binding', () => {
      let x = 5;
      x();
    }, ['CALLED_UNCALLABLE']);

    pass('property access on binding', () => {
      let x = 5;
      x.toString();
    });

    pass('dont connect property name to binding', () => {
      let toString = 5;
      true.toString();
    });

    pass('update expression', () => {
      let x = 5;
      ++x;
    });

    pass('typeof arg', () => {
      let x = 10;
      typeof x === 'number';
    });

    pass('in a block', () => {
      let x = 1;
      {
        x === 1;
      }
    });
  });

  pass('lexical explos', () => {
    function f() {
      let a = null;
      {
        let b = 'x';
        {
          let c = 1;
        }
        {
          let d = 'x';
        }
        {
          let e = null;
        }
      }
      {
        let f = 'x';
        {
          let g = true;
        }
        {
          let n = 1;
        }
        {
          let i = 1;
        }
      }
      {
        let j = 'x';
        {
          let k = null;
        }
        {
          let l = undefined;
        }
        {
          let m = 1;
        }
      }
    }
  });

  pass('lexical explo', () => {
    function f() {
      let x = null;
      {
        let x = 'x';
        {
          let x = 1;
        }
        {
          let x = 'x';
        }
        {
          let x = null;
        }
      }
      {
        let x = 'x';
        {
          let x = true;
        }
        {
          let x = 1;
        }
        {
          let x = 1;
        }
      }
      {
        let x = 'x';
        {
          let x = null;
        }
        {
          let x = undefined;
        }
        {
          let x = 1;
        }
      }
    }
  });
});

// esbuild plugin: resolve react, react-dom and the JSX runtime to the page's React 18 globals.
export const reactGlobals = {
  name: "react-globals",
  setup(build) {
    const map = {
      react: "module.exports = window.React;",
      "react-dom": "module.exports = window.ReactDOM;",
      "react-dom/client": "module.exports = window.ReactDOM;",
      "react/jsx-runtime": `
        var R = window.React;
        function split(props, key) {
          var p = {}, c;
          for (var k in props) { if (k === "children") c = props[k]; else p[k] = props[k]; }
          if (key !== undefined) p.key = key;
          return [p, c];
        }
        exports.Fragment = R.Fragment;
        exports.jsx = function (type, props, key) {
          var s = split(props || {}, key);
          return s[1] === undefined ? R.createElement(type, s[0]) : R.createElement(type, s[0], s[1]);
        };
        exports.jsxs = function (type, props, key) {
          var s = split(props || {}, key);
          return R.createElement.apply(null, [type, s[0]].concat(s[1] || []));
        };
      `,
    };
    map["react/jsx-dev-runtime"] = map["react/jsx-runtime"];
    build.onResolve({ filter: /^(react|react-dom|react-dom\/client|react\/jsx-runtime|react\/jsx-dev-runtime)$/ }, (args) => ({
      path: args.path,
      namespace: "react-globals",
    }));
    build.onLoad({ filter: /.*/, namespace: "react-globals" }, (args) => ({ contents: map[args.path], loader: "js" }));
  },
};

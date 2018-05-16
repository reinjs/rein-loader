# rein-loader

The framework loader of rein.

## Install

```shell
npm i @reinjs/rein-loader
```

## Usage

We can use `addCompiler` to expose compilers.

```javascript
const Loader = require('@reinjs/rein-loader');
const loader = new Loader();
loader.addCompiler(name, callback);
loader.addProgram(dir);
loader.compile();
```

- `addCompiler` it has two args.
  - `name` the compiler name
  - `callback` how to build data with args of `dir`
- `addProgram` it has one arg of `dir` which tell compiler how to build under the dir.
- `compile` build the data method.

## System Compilers

We can got some compilers easily by system.

### Controller Compiler

**Arguments:**

- `options`
  - `pathname` <function> how to build dir by arg of dir.
  - ...args

e.g.

```javascript
loader.addControllerCompiler(Object.assign(
  config.controller || {},
  {
    inject: this.app,
    target: this.app.controller = {},
    pathname: this.makePathname(scope, 'controller')
  }
));
```

### Middleware Compiler

**Arguments:**

- `options`
  - `pathname` <function> how to build dir by arg of dir.
  - ...args

e.g.

```javascript
loader.addMiddlewareCompiler(Object.assign(
  config.middleware || {},
  {
    inject: this.app,
    target: this.app.middleware = {},
    pathname: this.makePathname(scope, 'middleware')
  }
));
```

### Service Compiler

**Arguments:**

- `options`
  - `pathname` <function> how to build dir by arg of dir.
  - ...args

e.g.

```javascript
loader.addServiceCompiler(Object.assign(
  config.service || {},
  {
    inject: this.app,
    target: this.app.service = {},
    pathname: this.makePathname(scope, 'service')
  }
));
```

### Extend Compiler

`loader.addExtendCompiler(property, file, options)`

**Arguments:**

- `property` <string> the name of extending
- `filecallback` <function> hwo to get dir by arg of dir?
- `options` <object>
 * `target` which object can been built on?
 * `inject` inject object
 * `override` can override properties?
 * `originalPrototypes` original prototypes from koa or other framework




It also has four custom methods by alias name:

In KOA:

- `addContextCompiler` extend context.js
- `addRequestCompiler` extend request.js
- `addResponseCompiler` extend response.js
- `addApplicationCompiler` extend application.js

```javascript
this.loader
  .addContextCompiler(this.extendCondition(this.app.context, scope, 'extend/context.js'))
  .addRequestCompiler(this.extendCondition(this.app.request, scope, 'extend/request.js'))
  .addResponseCompiler(this.extendCondition(this.app.response, scope, 'extend/response.js'))
  .addApplicationCompiler(this.extendCondition(this.app, scope, 'extend/application.js'));
```

# License

It is [MIT licensed](https://opensource.org/licenses/MIT).

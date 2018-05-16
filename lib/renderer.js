const fs = require('fs');
const path = require('path');
const globby = require('globby');
const is = require('is-type-of');
const utils = require('@reinjs/rein-utils');

const CLASSLOADER = Symbol('classLoader');
const defaultConfigs = {
  match: null,
  directory: null,
  ignore: null,
  caseStyle: 'camel',
  lowercaseFirst: true,
  initializer: null,
  call: true,
  inject: null, // 一般指 `app` 对象
  target: null, // inContext 模式下指 app.controller等 其他都指app
  override: false,
  inContext: false,
  runtime: null
};

class ClassLoader {
  constructor(options) {
    if (!options.ctx) {
      throw new Error('options.ctx is required');
    }
    const properties = options.properties;
    this._cache = new Map();
    this._ctx = options.ctx;
    
    for (const property in properties) {
      this.defineProperty(property, properties[property], options.runtime);
    }
  }
  
  defineProperty(property, values, runtime) {
    Object.defineProperty(this, property, {
      get() {
        let instance = this._cache.get(property);
        if (!instance) {
          instance = getInstance(values, this._ctx, runtime);
          this._cache.set(property, instance);
        }
        return instance;
      },
    });
  }
}

module.exports = class Renderer {
  constructor(options = {}) {
    this.options = Object.assign({}, defaultConfigs, options);
    if (!this.options.inject) throw new Error('options.inject is required');
    if (this.options.inContext) {
      if (!this.options.property) throw new Error('options.property is required');
      
      const runtime = this.options.runtime;
      const target = this.options.target || {};
      const app = this.options.inject;
      const property = this.options.property;
      
      Object.defineProperty(app.context, property, {
        get() {
          if (!this[CLASSLOADER]) this[CLASSLOADER] = new Map();
          const classLoader = this[CLASSLOADER];
          let instance = classLoader.get(property);
          if (!instance) {
            instance = getInstance(target, this, runtime);
            classLoader.set(property, instance);
          }
          return instance;
        }
      });
    }
  }
  
  load() {
    const items = this.parse();
    const target = this.options.target;
    for (let i = 0; i < items.length; i++) {
      /**
       * item:
       *  { fullpath: '/Users/shenyunjie/CodeBox/reinjs/rein/test/app/controller/auth/c.js', properties: [ 'auth', 'c' ], exports: [Function: CController] }
       */
      const item = items[i];
      item.properties.reduce((target, property, index) => {
        let obj;
        /**
         * properties
         *  auth.c
         * @type {string}
         */
        const properties = item.properties.slice(0, index + 1).join('.');
        if (index === item.properties.length - 1) {
          if (property in target) {
            if (!this.options.override) {
              throw new Error(`can't overwrite property '${properties}' from ${target[property].FULLPATH} by ${item.fullpath}`);
            }
          }
          obj = item.exports;
          // 如果是函数类型
          if (obj && !is.primitive(obj)) {
            obj.FULLPATH = item.fullpath;
            obj.EXPORTS = true;
          }
        } else {
          obj = target[property] || {};
        }
  
        target[property] = obj;
        return obj;
      }, target);
    }
    return items.length;
  }
  
  parse() {
    let files = this.options.match;
    files = is.array(files) ? files : [files];
    let ignore = this.options.ignore;
    if (ignore) {
      ignore = is.array(ignore) ? ignore : [ignore];
      ignore = ignore.filter(f => !!f).map(f => '!' + f);
      files = files.concat(ignore);
    }
    let directories = this.options.directory;
    if (is.function(directories)) {
      directories = directories();
    }
    if (!is.array(directories)) {
      directories = [ directories ];
    }
    const items = [];
    for (const directory of directories) {
      
      /**
       * filepaths:
       *  [ 'a.js', 'b.js', 'auth/c.js' ]
       */
      const filepaths = globby.sync(files, { cwd: directory });
      for (const filepath of filepaths) {
        const fullpath = path.join(directory, filepath);
        if (!fs.statSync(fullpath).isFile()) continue;
        
        /**
         * properties:
         *  [ 'a' ]
         *  [ 'b' ]
         *  [ 'auth', 'c' ]
         */
        const properties = this.getProperties(filepath);
        
        /**
         * pathName:
         *  controller.a
         *  controller.b
         *  controller.auth.c
         * @type {string}
         */
        const pathName = directory.split(/\/|\\/).slice(-1) + '.' + properties.join('.');
        const result = this.getExports(fullpath, pathName);
        if (!result) continue;
        if (is.class(result)) {
          result.prototype.pathName = pathName;
          result.prototype.fullPath = fullpath;
        }
        items.push({ fullpath, properties, exports: result });
      }
    }
  
    /**
     * items:
     *  { fullpath: '/Users/shenyunjie/CodeBox/reinjs/rein/test/app/controller/a.js', properties: [ 'a' ], exports: [Function: AController] }
     *  { fullpath: '/Users/shenyunjie/CodeBox/reinjs/rein/test/app/controller/b.js', properties: [ 'b' ], exports: [AsyncFunction] }
     *  { fullpath: '/Users/shenyunjie/CodeBox/reinjs/rein/test/app/controller/auth/c.js', properties: [ 'auth', 'c' ], exports: [Function: CController] }
     */
    return items;
  }
  
  getProperties(filepath) {
    const { caseStyle } = this.options;
    // if caseStyle is function, return the result of function
    if (is.function(caseStyle)) {
      const result = caseStyle(filepath);
      if (!is.array(result)) {
        throw new Error(`caseStyle expect an array, but got ${result}`);
      }
      return result;
    }
    // use default camelize
    return this.defaultCamelize(filepath);
  }
  
  defaultCamelize(filepath) {
    const { caseStyle, lowercaseFirst } = this.options;
    const properties = filepath.substring(0, filepath.lastIndexOf('.')).split('/');
    return properties.map(property => {
      if (!/^[a-z][a-z0-9_-]*$/i.test(property)) {
        throw new Error(`${property} is not match 'a-z0-9_-' in ${filepath}`);
      }
    
      // use default camelize, will capitalize the first letter
      // foo_bar.js > FooBar
      // fooBar.js  > FooBar
      // FooBar.js  > FooBar
      // FooBar.js  > FooBar
      // FooBar.js  > fooBar (if lowercaseFirst is true)
      property = property.replace(/[_-][a-z]/ig, s => s.substring(1).toUpperCase());
      let first = property[0];
      switch (caseStyle) {
        case 'lower':
          first = first.toLowerCase();
          break;
        case 'upper':
          first = first.toUpperCase();
          break;
        case 'camel':
        default:
      }
      if (lowercaseFirst) first = first.toLowerCase();
      return first + property.substring(1);
    });
  }
  
  getExports(fullpath, pathName) {
    const { initializer, call, inject } = this.options;
    let result = utils.loadFile(fullpath);
    
    if (initializer) {
      result = initializer(result, { path: fullpath, pathName }, this.options);
    }
  
    if (is.class(result) || is.generatorFunction(result) || is.asyncFunction(result)) {
      return result;
    }
  
    if (call && is.function(result) && inject) {
      result = result(inject);
      if (result != null) {
        return result;
      }
    }
  
    return result;
  }
};

function getInstance(values, ctx, runtime) {
  // it's a directory when it has no exports
  // then use ClassLoader
  const Class = values.EXPORTS ? values : null;
  let instance;
  if (Class) {
    instance = is.class(Class) && is.function(runtime)
      ? runtime(Class, ctx)
      : new Class(ctx);
  }
  else if (is.primitive(values)) { instance = values; }
  else { instance = new ClassLoader({ ctx, properties: values, runtime }); }
  return instance;
}
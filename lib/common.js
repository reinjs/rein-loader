const fs = require('fs');
const is = require('is-type-of');
const utility = require('utility');
const utils = require('@reinjs/rein-utils');

module.exports = class Common {
  controller(obj, opt, options) {
    if (
      is.function(obj) &&
      !is.generatorFunction(obj) &&
      !is.class(obj) &&
      !is.asyncFunction(obj)
    ) obj = obj(options.inject);
    
    if (is.class(obj)) {
      obj.prototype.pathName = opt.pathName;
      obj.prototype.fullPath = opt.path;
      return this.wrapClass(obj);
    }
    if (is.object(obj)) {
      return this.wrapObject(obj, opt.path);
    }
    // support generatorFunction for forward compatbility
    if (is.generatorFunction(obj) || is.asyncFunction(obj)) {
      return this.wrapObject({ 'module.exports': obj }, opt.path)['module.exports'];
    }
    return obj;
  }
  
  wrapClass(Controller) {
    let proto = Controller.prototype;
    const ret = {};
    // tracing the prototype chain
    while (proto !== Object.prototype) {
      const keys = Object.getOwnPropertyNames(proto);
      for (const key of keys) {
        // getOwnPropertyNames will return constructor
        // that should be ignored
        if (key === 'constructor') {
          continue;
        }
        // skip getter, setter & non-function properties
        const d = Object.getOwnPropertyDescriptor(proto, key);
        // prevent to override sub method
        if (is.function(d.value) && !ret.hasOwnProperty(key)) {
          ret[key] = methodToMiddleware(Controller, key);
          ret[key].FULLPATH = Controller.prototype.fullPath + '#' + Controller.name + '.' + key + '()';
        }
      }
      proto = Object.getPrototypeOf(proto);
    }
    
    return ret;
    
    function methodToMiddleware(Controller, key) {
      return function classControllerMiddleware(ctx, next) {
        const controller = new Controller(ctx);
        return controller[key].call(controller, ctx, next);
      };
    }
  }
  
  wrapObject(obj, path, prefix) {
    const keys = Object.keys(obj);
    const ret = {};
    for (const key of keys) {
      if (is.function(obj[key])) {
        const names = utility.getParamNames(obj[key]);
        if (names[0] === 'next') {
          throw new Error(`controller \`${prefix || ''}${key}\` should not use next as argument from file ${path}`);
        }
        ret[key] = functionToMiddleware(obj[key]);
        ret[key].FULLPATH = `${path}#${prefix || ''}${key}()`;
      } else if (is.object(obj[key])) {
        ret[key] = this.wrapObject(obj[key], path, `${prefix || ''}${key}.`);
      }
    }
    return ret;
    
    function functionToMiddleware(func) {
      const objectControllerMiddleware = async function(ctx, next) {
        return func.call(ctx, ctx, next);
      };
      for (const key in func) {
        objectControllerMiddleware[key] = func[key];
      }
      return objectControllerMiddleware;
    }
  }
  
  extends(name, files, proto, options = {}) {
    const { inject, override, originalPrototypes } = options;
    for (let i = 0, j = files.length; i < j; i++) {
      const file = files[i];
      if (fs.existsSync(file)) {
        let fileExports = utils.loadFile(file);
        if (fileExports) {
          if (is.function(fileExports)) fileExports = fileExports(inject);
          const mergedRecords = new Map();
          const properties = Object.getOwnPropertyNames(fileExports).concat(Object.getOwnPropertySymbols(fileExports));
          for (const property of properties) {
            if (mergedRecords.has(property) && !override) {
              throw new Error(`Property: "${property}" already exists in "${mergedRecords.get(property)}"，it will be redefined by "${file}"`);
            }
            let descriptor = Object.getOwnPropertyDescriptor(fileExports, property);
            let originalDescriptor = Object.getOwnPropertyDescriptor(proto, property);
            if (!originalDescriptor) {
              // try to get descriptor from originalPrototypes
              const originalProto = originalPrototypes[name];
              if (originalProto) {
                originalDescriptor = Object.getOwnPropertyDescriptor(originalProto, property);
              }
            }
            if (originalDescriptor) {
              // don't override descriptor
              descriptor = Object.assign({}, descriptor);
              if (!descriptor.set && originalDescriptor.set) {
                descriptor.set = originalDescriptor.set;
              }
              if (!descriptor.get && originalDescriptor.get) {
                descriptor.get = originalDescriptor.get;
              }
            }
            Object.defineProperty(proto, property, descriptor);
            mergedRecords.set(property, file);
          }
        }
      }
    }
  }
  
  router(files = [], inject) {
    files.forEach(file => {
      if (fs.existsSync(file)) {
        const Exports = utils.loadFile(file);
        if (is.function(Exports)) {
          Exports(inject);
        }
      }
    });
  }
};
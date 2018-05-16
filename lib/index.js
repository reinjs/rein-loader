const path = require('path');
const Loader = require('./renderer');
const Common = require('./common');
const hasOwnProperty = Object.prototype.hasOwnProperty;

module.exports = class LoaderMaker {
  constructor() {
    this.common = new Common();
    this.compiler = {};
    this.dirs = [];
  }
  
  format(dir) {
    const re = /^([^:]+):\/(.+)$/.exec(dir);
    return {
      type: re[1],
      pathname: re[2]
    }
  }
  
  addProgram(dir) {
    if (this.dirs.indexOf(dir) === -1) this.dirs.push(dir);
    return this;
  }
  
  addCompiler(name, callback) {
    this.compiler[name] = callback;
    return this;
  }
  
  async compile() {
    const result = this.dirs.map(dir => {
      const { type, pathname } = this.format(dir);
      return {
        type, pathname
      }
    });
    for (const compiler in this.compiler) {
      if (hasOwnProperty.call(this.compiler, compiler)) {
        await this.compiler[compiler](result);
      }
    }
  }
  
  addControllerCompiler(options) {
    return this.addCompiler('controller', dirs => {
      const directory = dirs.map(dir => options.pathname(dir));
      const _options = Object.assign({
        match: ['**/*.js'],
        initializer: this.common.controller.bind(this.common),
      }, options, { directory });
      new Loader(_options).load();
    });
  }
  
  addMiddlewareCompiler(options) {
    return this.addCompiler('middleware', dirs => {
      const directory = dirs.map(dir => options.pathname(dir));
      const _options = Object.assign({
        match: ['**/*.js']
      }, options, { directory });
      new Loader(_options).load();
    });
  }
  
  addServiceCompiler(options) {
    return this.addCompiler('service', dirs => {
      const directory = dirs.map(dir => options.pathname(dir));
      const _options = Object.assign({
        match: ['**/*.js'],
        inContext: true,
        property: 'service'
      }, options, { directory });
      new Loader(_options).load();
    });
  }
  
  addExtendCompiler(property, file, options) {
    return this.addCompiler(property, dirs => {
      const files = dirs.map(dir => file(dir));
      this.common.extends(property, files, options.target, {
        inject: options.inject,
        override: options.override,
        originalPrototypes: options.originalPrototypes
      });
    });
  }
  
  addContextCompiler(options) {
    return this.addExtendCompiler('context', options.file, options);
  }
  
  addRequestCompiler(options) {
    return this.addExtendCompiler('request', options.file, options);
  }
  
  addResponseCompiler(options) {
    return this.addExtendCompiler('response', options.file, options);
  }
  
  addApplicationCompiler(options) {
    return this.addExtendCompiler('application', options.file, options);
  }
  
  addRouterCompiler(inject, fileCallback) {
    return this.addCompiler('router', dirs => {
      const files = dirs.map(dir => fileCallback(dir));
      this.common.router(files, inject);
    });
  }
};
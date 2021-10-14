'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const isBuiltinModule = require('is-builtin-module');
const logStats = require('./logStats');
const { progress, legacy } = require('./log');

function ensureArray(obj) {
  return _.isArray(obj) ? obj : [obj];
}

function getStatsLogger(statsConfig) {
  return stats => {
    logStats(stats, statsConfig);
  };
}

function getExternalModuleName(module) {
  const pathArray = /^external .*"(.*?)"$/.exec(module.identifier());
  if (!pathArray) {
    throw new Error(`Unable to extract module name from Webpack identifier: ${module.identifier()}`);
  }

  const path = pathArray[1];
  const pathComponents = path.split('/');
  const main = pathComponents[0];

  // this is a package within a namespace
  if (main.charAt(0) == '@') {
    return `${main}/${pathComponents[1]}`;
  }

  return main;
}

function isExternalModule(module) {
  return _.startsWith(module.identifier(), 'external ') && !isBuiltinModule(getExternalModuleName(module));
}

/**
 * Gets the module issuer. The ModuleGraph api does not exists in webpack@4
 * so falls back to using module.issuer.
 */
function getIssuerCompat(moduleGraph, module) {
  if (moduleGraph) {
    return moduleGraph.getIssuer(module);
  }

  return module.issuer;
}

/**
 * Find the original module that required the transient dependency. Returns
 * undefined if the module is a first level dependency.
 * @param {Object} moduleGraph - Webpack module graph
 * @param {Object} issuer - Module issuer
 */
function findExternalOrigin(moduleGraph, issuer) {
  if (!_.isNil(issuer) && _.startsWith(issuer.rawRequest, './')) {
    return findExternalOrigin(moduleGraph, getIssuerCompat(moduleGraph, issuer));
  }
  return issuer;
}

function getExternalModules({ compilation }) {
  const externals = new Set();
  for (const module of compilation.modules) {
    if (isExternalModule(module)) {
      externals.add({
        origin: _.get(
          findExternalOrigin(compilation.moduleGraph, getIssuerCompat(compilation.moduleGraph, module)),
          'rawRequest'
        ),
        external: getExternalModuleName(module)
      });
    }
  }
  return Array.from(externals);
}

function webpackCompile(config, logStats) {
  return BbPromise.fromCallback(cb => webpack(config).run(cb)).then(stats => {
    // ensure stats in any array in the case of concurrent build.
    stats = stats.stats ? stats.stats : [stats];

    _.forEach(stats, compileStats => {
      logStats(compileStats);
    });

    return _.map(stats, compileStats => ({
      outputPath: compileStats.compilation.compiler.outputPath,
      externalModules: getExternalModules(compileStats),
      error: _.split(
        _.trim(
          _.replace(
            compileStats.toString({
              all: false,
              errors: true,
              errorsCount: false,
              warnings: false,
              warningsCount: false,
              logging: 'error'
            }),
            /ERROR /g,
            ''
          )
        ),
        '\n'
      ).join('\n  ')
    }));
  });
}

function webpackConcurrentCompile(configs, logStats, concurrency) {
  return BbPromise.map(configs, config => webpackCompile(config, logStats), { concurrency }).then(stats =>
    _.flatten(stats)
  );
}

module.exports = {
  compile() {
    legacy.log('Bundling with Webpack...');
    progress.get('webpack').notice('[Webpack] Building with Webpack');

    const configs = ensureArray(this.webpackConfig);
    const logStats = getStatsLogger(configs[0].stats);

    if (!this.configuration) {
      return BbPromise.reject(new this.serverless.classes.Error('Missing plugin configuration'));
    }
    const concurrency = this.configuration.concurrency;

    return webpackConcurrentCompile(configs, logStats, concurrency).then(stats => {
      this.compileStats = { stats };

      // If there was any error we stop
      const errors = _.map(this.compileStats.stats, compileStats => compileStats.error).join('\n\n');
      if (errors) {
        throw new this.serverless.classes.Error(`Webpack compilation failed:\n\n${errors}`);
      }

      return BbPromise.resolve();
    });
  }
};

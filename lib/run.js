'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const webpack = require('webpack');
const { progress, log, legacy } = require('./log');

module.exports = {
  watch(command) {
    const functionName = this.options.function;
    const watchProgress = progress.get('webpack');
    if (functionName) {
      legacy.log(`Watch function ${functionName}...`);
      watchProgress.notice(`[Webpack] Watch function "${functionName}"`);
    } else {
      legacy.log('Watch service...');
      watchProgress.notice('[Webpack] Watch service');
    }

    const compiler = webpack(this.webpackConfig);
    const watchOptions = {};
    const usePolling = this.options['webpack-use-polling'];
    if (usePolling) {
      watchOptions.poll = _.isInteger(usePolling) ? usePolling : 3000;
      legacy.log(`Enabled polling (${watchOptions.poll} ms)`);
      log.notice(`Enabled polling (${watchOptions.poll} ms)`);
    }

    return new BbPromise((resolve, reject) => {
      compiler.watch(watchOptions, (err /*, stats */) => {
        if (err) {
          reject(err);
          return;
        }

        // eslint-disable-next-line promise/catch-or-return, promise/no-promise-in-callback
        BbPromise.try(() => {
          if (this.originalServicePath) {
            process.chdir(this.originalServicePath);
            this.serverless.config.servicePath = this.originalServicePath;
          }

          if (!this.isWatching) {
            this.isWatching = true;
            return BbPromise.resolve();
          }

          legacy.log('Sources changed.');
          log.notice('Sources changed.');
          if (_.isFunction(command)) {
            return command();
          }
          this.options.verbose && legacy.log(`Invoke ${command}`);
          log.info(`Invoke ${command}`);
          return this.serverless.pluginManager.spawn(command);
        }).then(() => {
          legacy.log('Waiting for changes ...');
          if (functionName) {
            watchProgress.notice(`[Webpack] Watch function "${functionName}"`);
          } else {
            watchProgress.notice('[Webpack] Watch service');
          }
          return null;
        }, reject);
      });
    });
  }
};

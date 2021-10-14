'use strict';

const _ = require('lodash');
const BbPromise = require('bluebird');
const fse = require('fs-extra');
const { log, legacy } = require('./log');

module.exports = {
  cleanup() {
    const webpackOutputPath = this.webpackOutputPath;
    const keepOutputDirectory = this.keepOutputDirectory || this.configuration.keepOutputDirectory;
    const cli = this.options.verbose ? legacy : { log: _.noop };

    if (!keepOutputDirectory) {
      cli.log(`Remove ${webpackOutputPath}`);
      log.info(`Remove ${webpackOutputPath}`);
      if (this.serverless.utils.dirExistsSync(webpackOutputPath)) {
        // Remove async to speed up process
        fse
          .remove(webpackOutputPath)
          .then(() => {
            cli.log(`Removing ${webpackOutputPath} done`);
            log.info(`Removing ${webpackOutputPath} done`);
            return null;
          })
          .catch(error => {
            cli.log(`Error occurred while removing ${webpackOutputPath}: ${error}`);
            log.error(`Error occurred while removing ${webpackOutputPath}: ${error}`);
          });
      }
    } else {
      cli.log(`Keeping ${webpackOutputPath}`);
    }

    return BbPromise.resolve();
  }
};

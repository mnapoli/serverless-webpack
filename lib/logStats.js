'use strict';

const _ = require('lodash');
const tty = require('tty');
const { log, legacy } = require('./log');

const defaultStatsConfig = {
  colors: tty.isatty(process.stdout.fd),
  hash: false,
  version: false,
  chunks: false,
  children: false
};

module.exports = function (stats, statsConfig) {
  const legacyStatsOutput = stats.toString(statsConfig || defaultStatsConfig);
  if (legacyStatsOutput) {
    legacy.consoleLog(legacyStatsOutput);
  }
  if (statsConfig) {
    if (!legacyStatsOutput) return;
    log.notice();
    log.notice(`${_.split(_.trim(warningsOutput), '\n').join('\n  ')}`);
    return;
  }
  const warningsOutput = stats.toString({
    all: false,
    errors: false,
    errorsCount: false,
    warnings: true,
    warningsCount: false,
    logging: 'warn'
  });

  if (warningsOutput) {
    log.warning();
    log.warning(`${_.split(_.trim(_.replace(warningsOutput, /WARNING /g, '')), '\n').join('\n  ')}`);
  }
};

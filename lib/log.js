'use strict';

const { getPluginWriters, legacy, style } = require('@serverless/utils/log');

module.exports = { legacy, style, ...getPluginWriters('serverless-webpack') };

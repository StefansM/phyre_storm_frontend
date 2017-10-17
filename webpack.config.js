const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');

const parts = require('./webpack.parts.js');

const PATHS = {
  js: path.join(__dirname, 'js'),
  build: path.join(__dirname, 'static'),
};

const common_config = merge([
  {
    output: {
      path: PATHS.build,
      filename: '[name].bundle.js',
      library: 'PhyreStorm',
      libraryTarget: 'var',
    },
    entry: {
      results: './js/results.js',
    },
    externals: {
      jquery: 'jQuery',
    },
  },
  //parts.eslint(),
  parts.load_javascript({ include: PATHS.js }),
  // parts.provide(),
]);

const production_config = merge([
  parts.extract_css({ use: ['css-loader'] }),
  parts.extract_bundles([{ name: 'common' }]),
]);

const development_config = merge([
  parts.source_maps({ type: 'source-map' }),
  parts.load_images({
    options: {
      limit: 15000,
      name: '[name].[hash:8].[ext]',
    },
  }),
  parts.extract_css({ use: ['css-loader'] }),
  parts.extract_bundles([{ name: 'common' }]),
]);

module.exports = (env) => {
  const config = env === 'production' ? production_config : development_config;
  return merge([common_config, config]);
};

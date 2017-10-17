const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');

exports.extract_css = ({ include, exclude, use }) => {
  // Write extracted CSS to a file
  const plugin = new ExtractTextPlugin({ filename: '[name].css' });
  return {
    module: {
      rules: [{
        test: /\.css$/,
        include,
        exclude,
        use: plugin.extract({
          use,
          fallback: 'style-loader',
        }),
      }],
    },
    plugins: [plugin],
  };
};

exports.extract_bundles = bundles => ({
  plugins: bundles.map(bundle => (
    new webpack.optimize.CommonsChunkPlugin(bundle)
  )),
});

exports.load_javascript = ({ include, exclude }) => ({
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /(node_modules|bower_components)/,
      use: {
        loader: 'babel-loader',
        options: {
          presets: ['env'],
        },
      },
    }],
  },
});

exports.dev_server = ({ host, port } = {}) => ({
  devServer: {
    historyApiFallback: true,
    stats: 'errors-only',
    host, // Defaults to `localhost`
    port, // Defaults to 8080
    overlay: {
      errors: true,
      warnings: true,
    },
  },
});


exports.load_css = ({ include, exclude } = {}) => ({
  module: {
    rules: [
      {
        test: /\.css$/,
        include,
        exclude,

        use: ['style-loader', 'css-loader'],
      },
    ],
  },
});

exports.provide = () => ({
  plugins: [
    new webpack.ProvidePlugin({
      $: 'jquery',
      jQuery: 'jquery',
      'window.jQuery': 'jquery',
      Popper: ['popper.js', 'default'],
    }),
  ],
});

exports.load_images = ({ include, exclude, options } = {}) => ({
  module: {
    rules: [
      {
        test: /\.(png|jpg|svg|gif)$/,
        include,
        exclude,

        use: {
          loader: 'url-loader',
          options,
        },
      },
    ],
  },
});

exports.source_maps = ({ type }) => ({
  devtool: type,
});

exports.eslint = () => ({
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        loader: 'eslint-loader',
        options: {
          emitWarning: true,
        },
      },
    ],
  },
});

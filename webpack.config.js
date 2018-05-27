const path = require('path');
const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const Uglify = require('uglifyjs-webpack-plugin');

/* global __dirname */
console.log(`Building ${process.env.NODE_ENV}`);
const config = {
  entry: ['./src/js/index.js'], // './src/index.js'],
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: (process.env.NODE_ENV !== 'production') ? '/' : '/static/gql/',
    filename: '[name].[chunkhash].js'
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules(?!\/webpack-dev-server)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [['env', { targets: { browsers: ['chrome >= 60'] } }]],
            plugins: ['angularjs-annotate']
          }
        }
      },
      {
        test: /templates/,
        use: 'raw-loader'
      },
      {
        test: /\.html$/,
        use: ['file-loader?name=pages/[name].[ext]'],
        exclude: [path.resolve(__dirname, 'src/templates'), path.resolve(__dirname, 'src/html/index.html')]
      },
      {
        test: /\.(png|jpe?g|gif|svg)(\?.*)?$/,
        loader: 'url-loader'
      },
      {
        test: /\.(mp4|webm|ogg|mp3|wav|flac|aac)(\?.*)?$/,
        loader: 'url-loader'
      },
      {
        test: /\.scss$/,
        use: [{
          loader: 'style-loader' // creates style nodes from JS strings
        }, {
          loader: 'css-loader' // translates CSS into CommonJS
        }, {
          loader: 'sass-loader' // compiles Sass to CSS
        }]
      },
      {
        test: /\.less$/,
        use: [{
          loader: 'style-loader' // creates style nodes from JS strings
        }, {
          loader: 'css-loader' // translates CSS into CommonJS
        }, {
          loader: 'less-loader' // compiles Less to CSS
        }]
      }
    ]
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/html/index.html' }),
    new ExtractTextPlugin({
      filename: '[name].[contenthash].css',
      disable: process.env.NODE_ENV === 'development'
    }),
    new CopyWebpackPlugin([{ from: './src/assets', to: 'assets' }], {
      devServer: {
        outputPath: path.join(__dirname, 'dist/assets')
      }
    })
  ]
};

if (process.env.NODE_ENV === 'production') {
  config.plugins.push(new Uglify({ sourceMap: true }));
}

module.exports = config;

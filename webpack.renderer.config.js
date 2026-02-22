const rules = require('./webpack.rules');
const path = require('path');

rules.push({
  test: /\.css$/,
  use: [{ loader: 'style-loader' }, { loader: 'css-loader' }],
});

module.exports = {
  // Put your normal webpack config below here
  module: {
    rules,
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.scss'],
	alias: {
		'@': path.resolve(__dirname, './src'),
		'@comp': path.resolve(__dirname, './src/components'),
		// '@feat': path.resolve(__dirname, '../src/features'),
	},
  },
};

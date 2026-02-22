const path = require('path');

module.exports = {
	/**
	 * This is the main entry point for your application, it's the first file
	 * that runs in the main process.
	 */
	entry: './src/main.js',
	// Put your normal webpack config below here
	module: {
		rules: require('./webpack.rules'),
	},
	resolve: {
		extensions: ['.ts', '.tsx', '.js', '.css', '.scss'],
		alias: {
			'@': path.resolve(__dirname, 'src'),
			// '@comp': path.resolve(__dirname, 'src/components'),
			// '@feat': path.resolve(__dirname, 'src/features'),
		},
	},
};

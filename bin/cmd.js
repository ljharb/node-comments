#!/usr/bin/env node

/*jslint node: true */
'use strict';

var fs = require('fs');
var path = require('path');
var transform = require('../lib/comments.js');
var styles = Object.keys(transform.STYLES);
var listify = require('listify');

var opt = require('optimist')
	.usage('Usage: $0 --style [style] [file1.js] [file2.js] … [fileN.js]')
	.describe('style', 'Specify a style. Currently supported: ' + listify(styles))
	.demand('style')
	.describe('save', 'Save the transformed code back to the original file.')
	.boolean('save')
	.check(function (opt) {
		if (styles.indexOf(opt.style) === -1) {
			throw new SyntaxError('--style must be one of: ' + listify(styles));
		} else if (!Array.isArray(opt._) || opt._.length === 0) {
			throw new ReferenceError('please specify one or more files');
		} else {
			var nonexistent = opt._.filter(function (filename) {
				return !fs.existsSync(filename);
			});
			if (nonexistent.length > 0) {
				var message = nonexistent.map(function (filename) {
					return opt.$0 + ': ' + filename + ': no such file or directory';
				}).join('\n');
				throw new ReferenceError('\n' + message + '\n');
			}
		}
	})
	.argv;

var files = opt._;

if (opt.help) {
	opt.showHelp();
} else {
	var filenames = files.map(function (filename) {
		return path.resolve(String(filename));
	});
	filenames.forEach(function (filename) {
		var code = fs.readFileSync(filename).toString();
		transform(code, transform.STYLES[opt.style], function (err, transformed) {
			if (opt.save) {
				fs.writeFile(filename, transformed, function (err) {
					if (err) { throw err; }
					console.log(filename + ' transformed successfully');
				});
			} else {
				console.log(transformed);
			}
		});
	});
}


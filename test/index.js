/*jslint node: true */
"use strict";

var test = require('tape');
var transform = require('../lib/comments.js');
var fs = require('fs');
var path = require('path');
var samplesDir = path.join(__dirname, 'samples');

var originalRegex = /\.original\.js$/;
var files = fs.readdirSync(samplesDir);
files.forEach(function (filename) {
	var prefix = filename.replace(originalRegex, '');
	if (originalRegex.test(filename)) {
		var code = fs.readFileSync(path.join(samplesDir, filename)).toString();
		test('test case #' + prefix, function (t) {
			t.notEqual(code.trim(), '', 'code is not empty');
			t.end();
		});
		if (code.trim() === '') { return; }

		var samples = Object.keys(transform.STYLES).reduce(function (map, style) {
			var variantFilename = path.join(samplesDir, filename.replace('original', style));
			if (fs.existsSync(variantFilename)) {
				map[style] = fs.readFileSync(variantFilename).toString();
			}
			return map;
		}, { none: code });

		var supported = ['none', 'single', 'multi'];
		supported.forEach(function (style) {
			test(prefix + ': ' + style, function (t) {
				var expected = samples[style];
				t.plan(2);
				transform(code, transform.STYLES[style], function (err, transformed) {
					t.notOk(err, 'no error');
					t.equal(transformed, expected, style + ' transformed as expected');
				});
				t.end();
			});
		});
	}
});


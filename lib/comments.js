/*jslint node: true */

var literalizer = require('literalizer');
var extend = require('extend');

var STYLES = {
	none: null,
	multi: '/**/'
};
Object.freeze(STYLES);

var helpers = {
	isComment: function (chunk) {
		return chunk && chunk.type === literalizer.SEGMENT.COMMENT;
	},
	isNewline: function (chunk) {
		return chunk && chunk.val === '\n';
	}
};

var mapComments = function (chunks, iterator) {
	return chunks.map(function (chunk) {
        var newChunk = chunk;
		if (helpers.isComment(chunk)) {
			newChunk = iterator(extend({}, chunk));
		}
		return newChunk;
	});
};

var groupComments = function (chunks) {
	var groupedChunks = [];
	var inCommentBlock = false;
	chunks.forEach(function (chunk) {
		var isComment = helpers.isComment(chunk);
		var isNewline = helpers.isNewline(chunk);
		if (isComment) {
			inCommentBlock = true;
		} else if (inCommentBlock && !isNewline) {
			inCommentBlock = false;
		}

		var previous = groupedChunks[groupedChunks.length - 1];
		var previousIsComment = helpers.isComment(previous);
		var previousIsNewline = helpers.isNewline(previous);
		var previousIsArray = Array.isArray(previous);
        if (groupedChunks.length > 0 && inCommentBlock && (previousIsComment || previousIsNewline || previousIsArray)) {
			if (previousIsArray) {
				previous.push(chunk);
			} else if (previousIsComment) {
				groupedChunks[groupedChunks.length - 1] = [].concat(previous, chunk);
			} else {
				groupedChunks.push(chunk);
			}
		} else {
			groupedChunks.push(chunk);
		}
	});
	return groupedChunks;
};

var ungroupComments = function (groupedChunks) {
	return groupedChunks.reduce(function (chunks, group) {
		return chunks.concat(group);
	}, []);
};

var transformers = {};
transformers[STYLES.none] = function noop(chunks) { return chunks; };

var transformGroupToMulti = function (lines) {
	var first = lines[0];
	var last = lines[lines.length - 1];
	first.val = first.val.replace(/^([^\S\n]*)(?:\/\/|\/\*)?/, '/*$1').replace(/[^\S\n]+$/, '');
	lines.slice(1).forEach(function (line) {
		line.val = line.val.replace(/(\/\/|\/\*|\*\/)/g, '');
	});
	last.val = last.val.replace(/(?:\*\/)?[^\S\n]*$/, '').replace(/[^\S\n]+$/, '') + ' */';
};
transformers[STYLES.multi] = function makeMultiLineComments(chunks) {
	var groupedChunks = groupComments(chunks);
	groupedChunks.forEach(function (group) {
		if (Array.isArray(group) || helpers.isComment(group)) {
			var lines = Array.isArray(group) ? group : [group];
			if (lines.length > 0) {
				while (helpers.isNewline(lines[lines.length - 1])) {
					lines = lines.slice(0, -1);
				}
				transformGroupToMulti(lines);
			}
		}
	});
	return ungroupComments(groupedChunks);
};

var unlex = function (chunks) {
	return chunks.map(function (p) { return p.val }).join('');
};

var transform = function transform(code, style, callback) {
	var transformer = transformers[style] || transformers[STYLES.none];

	var parsed = literalizer.lex(String(code));
	var chunks = transformer(parsed);
	callback(null, unlex(chunks));
};

transform.STYLES = STYLES;

module.exports = transform;


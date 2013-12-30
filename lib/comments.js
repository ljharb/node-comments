/*jslint node: true */

var literalizer = require('literalizer');
var extend = require('extend');
var promiseback = require('promiseback');

var STYLES = {
	none: null,
	single: '//',
	multi: '/**/',
	singleMulti: '///**/'
};
Object.freeze(STYLES);

var helpers = {
	isComment: function (chunk) {
		return chunk && chunk.type === literalizer.SEGMENT.COMMENT;
	},
	isNewline: function (chunk) {
		return chunk && chunk.val === '\n';
	},
	startsWithNewline: function (chunk) {
		return chunk && (/^\n+/).test(chunk.val);
	},
	endsWithNewline: function (chunk) {
		return chunk && (/\n+$/).test(chunk.val);
	},
	startsWithSingleLineComment: function (chunk) {
		return chunk && (/^[^\S\n]*\/\//).test(chunk.val);
	}
};

/*
var mapComments = function (chunks, iterator) {
	return chunks.map(function (chunk) {
		var newChunk = chunk;
		if (helpers.isComment(chunk)) {
			newChunk = iterator(extend({}, chunk));
		}
		return newChunk;
	});
};
*/

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
		var previousIsArray = Array.isArray(previous);
		if (groupedChunks.length > 0 && inCommentBlock && (previousIsComment || previousIsArray)) {
			if (previousIsArray) {
				previous.push(chunk);
			} else if (previousIsComment) {
				groupedChunks[groupedChunks.length - 1] = [].concat(previous, chunk);
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

var transformChunkToSingle = function transformChunkToSingle(chunk) {
	if (!helpers.startsWithSingleLineComment(chunk)) {
		var lines = chunk.val.split('\n');
		chunk.val = lines.map(function (line) {
			return line.replace('/*', '//').replace('*/', '')
				.replace(/[^\S\n]+$/, '')
				.replace(/^([^\S\n]*)(?!\/\/)/, '//$1').trim();
		}).join('\n');
	}
	return chunk;
};
transformers[STYLES.single] = function makeSingleLineComments(chunks) {
	return chunks.map(function (chunk, index) {
		var prevChunk = chunks[index - 1];
		var nextChunk = chunks[index + 1];
		var isComment = helpers.isComment(chunk);
		var prevIsNotSameLineCode = !prevChunk || helpers.endsWithNewline(prevChunk) || helpers.isComment(prevChunk);
		if (isComment && prevIsNotSameLineCode) {
			if (helpers.startsWithNewline(nextChunk)) {
				chunk = transformChunkToSingle(chunk);
			} else {
				var lines = chunk.val.split('\n');
				var temp = transformChunkToSingle({ val: lines.slice(0, -1).join('\n') });
				chunk.val = temp.val.split('\n').concat('/*' + lines.slice(-1)[0]).join('\n');
			}
		}
		return chunk;
	});
};

var transformGroupToMulti = function (lines) {
	var first = lines[0];
	var last = lines[lines.length - 1];
	first.val = first.val.replace(/^([^\S\n]*)(?:\/\/|\/\*)?/, '/*$1').replace(/[^\S\n]+$/, '');
	lines.slice(1).forEach(function (line) {
		line.val = line.val.replace(/(\/\/|\/\*|\*\/)/g, '');
	});
	var endsInFlushStarSlash = (/\n\*\/$/).test(last.val);
	last.val = last.val.replace(/(?:\*\/)?[^\S\n]*$/, '').replace(/[^\S\n]+$/, '');
	last.val += (endsInFlushStarSlash ? '' : ' ') + '*/';
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

transformers[STYLES.singleMulti] = function makeSingleMultiLineCommentCombos(chunks) {
	var groupedChunks = groupComments(chunks);
	groupedChunks.forEach(function (group, index) {
		var groupArray = Array.isArray(group) ? group : null;
		if (helpers.isComment(group)) {
			var lines = group.val.split('\n');
			if (lines.length === 1) {
				var nextChunk = groupedChunks[index + 1];
				if (helpers.startsWithNewline(nextChunk)) {
					transformChunkToSingle(group);
				}
			} else {
				groupArray = [group];
			}
		}
		if (Array.isArray(groupArray)) {
			if (groupArray.length > 0) {
				while (helpers.isNewline(groupArray[groupArray.length - 1])) {
					groupArray = groupArray.slice(0, -1);
				}
				if (groupArray.length === 1 && groupArray[0].val.split('\n').length === 1) {
					transformChunkToSingle(groupArray[0]);
				} else {
					transformGroupToMulti(groupArray);
				}
			}
		}
	});
	return ungroupComments(groupedChunks);
};

var transform = function transform(code, style, callback) {
	if (arguments.length === 2) {
		callback = style;
		style = undefined;
	}
	var transformer = transformers[style] || transformers[STYLES.none];

	var parsed = literalizer.lex(String(code));
	var chunks = transformer(parsed);
	return promiseback(literalizer.generate(chunks), callback);
};

transform.STYLES = STYLES;

module.exports = transform;


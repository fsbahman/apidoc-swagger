#!/usr/bin/env node

'use strict';

/*
 * apidoc-swagger
 *
 * Copyright (c) 2015 Exact
 * Author Bahman Fakhr Sabahi <bahman.sabahi@exact.com>
 * Licensed under the MIT license.
 */

var path   = require('path');
var nomnom = require('nomnom');
var apidocSwagger = require('../lib/index');

var argv = nomnom
    .option('file-filters', { abbr: 'f', 'default': '.*\\.(clj|coffee|cs|dart|erl|go|java|scala|js|php?|py|rb|ts|pm)$',
            help: 'RegEx-Filter to select files that should be parsed (multiple -f can be used).' })

    .option('exclude-filters', { abbr: 'e', 'default': '',
            help: 'RegEx-Filter to select files / dirs that should not be parsed (many -e can be used).', })

    .option('input', { abbr: 'i', 'default': './', help: 'Input / source dirname.' })

    .option('output', { abbr: 'o', 'default': './doc/', help: 'Output dirname.' })    

    .option('verbose', { abbr: 'v', flag: true, 'default': false, help: 'Verbose debug output.' })

    .option('help', { abbr: 'h', flag: true, help: 'Show this help information.' })

    .option('debug', { flag: true, 'default': false, help: 'Show debug messages.' })

    .option('color', { flag: true, 'default': true, help: 'Turn off log color.' })

    .option('parse', { flag: true, 'default': false,
            help: 'Parse only the files and return the data, no file creation.' })

    .option('parse-filters'  , { help: 'Optional user defined filters. Format name=filename' })
    .option('parse-languages', { help: 'Optional user defined languages. Format name=filename' })
    .option('parse-parsers'  , { help: 'Optional user defined parsers. Format name=filename' })
    .option('parse-workers'  , { help: 'Optional user defined workers. Format name=filename' })

    .option('silent', { flag: true, 'default': false, help: 'Turn all output off.' })

    .option('simulate', { flag: true, 'default': false, help: 'Execute but not write any file.' })

    // markdown settings
    .option('markdown', { flag: true, 'default': true, help: 'Turn off markdown parser.' })

    .parse()
;

/**
 * Transform parameters to object
 *
 * @param {String|String[]} filters
 * @returns {Object}
 */
function transformToObject(filters) {
    if ( ! filters)
        return;

    if (typeof(filters) === 'string')
        filters = [ filters ];

    var result = {};
    filters.forEach(function(filter) {
        var splits = filter.split('=');
        if (splits.length === 2) {
            var obj = {};
            result[splits[0]] = path.resolve(splits[1], '');
        }
    });
    return result;
}

var options = {
    excludeFilters: argv['exclude-filters'],
    includeFilters: argv['file-filters'],
    src           : argv['input'],
    dest          : argv['output'],
    verbose       : argv['verbose'],
    debug         : argv['debug'],
    parse         : argv['parse'],
    colorize      : argv['color'],
    filters       : transformToObject(argv['parse-filters']),
    languages     : transformToObject(argv['parse-languages']),
    parsers       : transformToObject(argv['parse-parsers']),
    workers       : transformToObject(argv['parse-workers']),
    silent        : argv['silent'],
    simulate      : argv['simulate'],
    markdown      : argv['markdown']
};

if (apidocSwagger.createApidocSwagger(options) === false) {
    process.exit(1);
}

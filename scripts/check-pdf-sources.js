#!/usr/bin/env node
'use strict';

/*
 * The redesigned downloads' sources match the catalogue they are read from.
 *
 *   node scripts/check-pdf-sources.js        (part of `npm test`)
 *
 * scripts/build-pdf-sources.js writes each redesigned spec sheet's HTML from
 * catalog/print and ar/catalog/print. Change a product there and this fails
 * until the sources are rebuilt; check-guide-pdfs.js then fails until the
 * PDFs are printed again, so a sheet cannot quietly say something the
 * catalogue no longer does.
 */

process.argv.push('--check');
require('./build-pdf-sources');

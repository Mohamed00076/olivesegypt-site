#!/usr/bin/env node
'use strict';

/*
 * The redesigned downloads' sources match the pages they are read from.
 *
 *   node scripts/check-pdf-sources.js        (part of `npm test`)
 *
 * scripts/build-pdf-documents.js writes the company profile's and each
 * guide's A4 source from the profile page and the guide's HTML. Change one
 * of those and this fails until the sources are rebuilt; check-guide-pdfs.js
 * then fails until the PDFs are printed again, so a PDF cannot quietly say
 * something its page no longer does.
 */

require('./build-pdf-documents').run(true);

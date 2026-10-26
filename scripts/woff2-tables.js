'use strict';

/*
 * The table tags of a WOFF2 font file, read from its table directory, which
 * is not compressed (WOFF2 spec, section 5). Enough to tell a static font
 * from a variable one -- a variable font carries 'fvar' -- without a font
 * library. Used by scripts/check-crm-document-print.js.
 */

// The spec's known-table list: a directory entry names one by its index.
const KNOWN = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT',
  'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH',
  'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar',
  'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

function woff2Tables(buf) {
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error('not a WOFF2 file');
  const count = buf.readUInt16BE(12);
  let at = 48;
  const base128 = () => {
    let value = 0;
    for (let i = 0; i < 5; i++) {
      const b = buf[at++];
      value = value * 128 + (b & 0x7f);
      if (!(b & 0x80)) return value;
    }
    throw new Error('bad UIntBase128');
  };
  const tags = [];
  for (let i = 0; i < count; i++) {
    const flags = buf[at++];
    let tag;
    if ((flags & 0x3f) === 0x3f) { tag = buf.toString('latin1', at, at + 4); at += 4; } else tag = KNOWN[flags & 0x3f];
    base128(); // origLength
    const version = (flags >> 6) & 3;
    const glyfOrLoca = tag === 'glyf' || tag === 'loca';
    if (glyfOrLoca ? version === 0 : version !== 0) base128(); // transformLength
    tags.push(tag);
  }
  return tags;
}

module.exports = { woff2Tables };

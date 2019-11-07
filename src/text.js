'use strict';

const path = require('path');
const PDFDocument = require('pdfkit');

let doc = new PDFDocument({ size: 'A4', layout: 'landscape' });
try {
  doc = doc.font(path.join(__dirname, '..', 'Verdana.ttf'));
} catch (err) {
  doc = doc.font('Helvetica-Bold');
  console.warn(
    'Could not load font file "Verdana.ttf", ' +
      'text widths will therefore be approximate.'
  );
}
doc = doc.fontSize(11);

function measureTextWidth(text, rounding = 'floor') {
  return Math[rounding](doc.widthOfString(text));
}

module.exports = { measureTextWidth };

if (require.main === module) {
  const TEST_STRINGS = [
    'FF',
    'Google Chrome',
    'Microsoft Internet Explorer',
    'Safari'
  ];
  TEST_STRINGS.forEach(str => {
    console.log(`${str} [${measureTextWidth(str)}]`);
  });
}

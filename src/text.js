'use strict';

const PDFDocument = require('pdfkit');

const doc = new PDFDocument({ size: 'A4', layout: 'landscape' })
  .font('Helvetica-Bold')
  .fontSize(11);

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

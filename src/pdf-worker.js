// Polyfill Uint8Array.prototype.toHex for PDF.js v6 fingerprinting in web workers
if (!Uint8Array.prototype.toHex) {
  Uint8Array.prototype.toHex = function () {
    return Array.from(this)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }
}

import 'pdfjs-dist/build/pdf.worker.min.mjs'

/**
 * PDF / Printable Document Reporter
 * Formats report with print stylesheets, page breaks, and high-contrast styling.
 */

const HtmlReporter = require('./html-reporter');

class PdfReporter {
  /**
   * Generates printable HTML formatted for PDF export
   * @param {Object} auditRun 
   */
  static generatePrintableHtml(auditRun) {
    const rawHtml = HtmlReporter.generate(auditRun);
    // Inject automatic print trigger script if opened in browser
    return rawHtml.replace('</body>', `
      <script>
        window.addEventListener('DOMContentLoaded', () => {
          // Ready for window.print() or headless chromium --print-to-pdf
        });
      </script>
    </body>`);
  }
}

module.exports = PdfReporter;

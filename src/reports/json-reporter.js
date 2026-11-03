/**
 * JSON Report Generator
 */

class JsonReporter {
  static generate(auditRun) {
    return JSON.stringify(auditRun, null, 2);
  }
}

module.exports = JsonReporter;

// This error is thrown for configurable problems that don't necessarily cause problems for the model but are probably
// things you'd want to know about, anyways.
export class LintError extends Error {
  toString() {
    return 'Lint' + super.toString();
  }
}

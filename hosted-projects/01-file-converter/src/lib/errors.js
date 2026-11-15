/** An error whose message is safe (and useful) to show the user verbatim. */
export class ConversionError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ConversionError'
  }
}

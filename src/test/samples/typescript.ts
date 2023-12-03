export class TestClass {
  /**
   * Test Method
   * * Important information is highlighted
   * ! Deprecated method, do not use
   * ? Should this method be exposed through API?
   * TODO: refactor this method to conform to API
   * @param param === condition
   *     ? true          This line should not be highlighted
   *     : false
   */
  public TestMethod(param: any): void {
    const testVar = 123;

    //* This should not be highlighted
    if (testVar > 0) {
      throw new TypeError('Some error'); // ! this is an alert
    }

    // ? This is a query
    const x = 1;

    // // this.lineOfCode() == commentedOut;

    // TODO: write some test cases
  }
}



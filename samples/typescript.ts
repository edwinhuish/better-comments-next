export class TestClass {
  /**
   * Test Method
   * * Important information is highlighted
   * ! Deprecated method, do not use
   * ? Should this method be exposed through API?
   * TODO: refactor this method to conform to API
   *       Ensure continuous lines with indentation.
   *       This is a multi-line TODO comment that
   *       should be highlighted properly.
   *
   * @param param === condition
   *     ? true          This line should not be highlighted
   *     : false
   */
  public TestMethod(param: any): void {
    /* # this is inline block comment */
    const testVar = 123;

    //* This should not be highlighted
    if (testVar > 0) {
      throw new TypeError('Some error'); // ! this is an alert
    }

    // ? This is a query
    const x = 1;

    // // this.lineOfCode() == commentedOut;

    // TODO: write some test cases

    /*
      todo: multi-line in block comment example
            Ensure continuous lines with indentation.
            This is a multi-line TODO comment
            that should be highlighted properly.
    */


    // ! line comment multi-line mode
    //
    // TODO: multi-line in block comment example
    //       Ensure continuous lines with indentation.
    //       This is a multi-line TODO comment
    //       that should be highlighted properly.
    //
  }
}

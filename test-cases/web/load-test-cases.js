var rootEl = document.getElementById('root');

var testCases = [];

for (var caseName in MultimediaTestCasesWeb) {
  var TestCase =  MultimediaTestCasesWeb[caseName];
  testCases.push([new TestCase(rootEl), caseName]);
}

function setupTestCase(i) {
  testCases[i][0].setup();
}

function runTestCase(i) {
  testCases[i][0].run();
}

function printTestCases() {
  testCases.forEach(([, name]) => console.log('Found test case:', name))
}

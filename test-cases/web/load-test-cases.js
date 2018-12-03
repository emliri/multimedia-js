var rootEl = document.getElementById('root');

var testCases = [];
let i = 0;
for (var caseName in MMTestCasesWeb) {
  if (caseName === 'mmjs') {
    continue;
  }
  var TestCase =  MMTestCasesWeb[caseName];
  console.log(`Initializing test-case #${i++}:`, caseName);
  testCases.push([new TestCase(rootEl), caseName]);
}

function setupTestCase(i) {
  if (i >= testCases.length) {
    console.error('Bad test-case index:', i);
    window.alert('Query a valid test case please.');
    return;
  }
  console.log('Calling setup for test-case index:', i)
  testCases[i][0].setup();
}

function runTestCase(i) {
  if (i >= testCases.length) {
    console.error('Bad test-case index:', i);
    return;
  }
  console.log('Calling run for test-case index:', i)
  testCases[i][0].run();
}

function printTestCases() {
  testCases.forEach(([, name]) => console.log('Ready test-case:', name))
}

var rootEl = document.getElementById('root');
var runButtonEl = document.getElementById('runButton')
var runButtonLabelEl = document.getElementById('runButtonLabel')
var testCaseIndex = MMTestCasesWeb.mmjs.Common.Utils.parseOptionsFromQueryString().case || 0;

var testCases = [];

// fill up test-case array
{
  var i = 0;
  for (var caseName in MMTestCasesWeb) {
    if (caseName === 'mmjs') {
      continue;
    }
    var TestCase =  MMTestCasesWeb[caseName];
    console.log(`Initializing test-case #${i++}:`, caseName);
    testCases.push([new TestCase(rootEl), caseName]);
  }
}

// print test-cases list, call async set-up function and install UI
{
  printTestCases();

  var caseName = testCases[testCaseIndex][1];

  runButtonLabelEl.innerHTML = caseName;

  setupTestCase(testCaseIndex, function() {
    console.log('Test-case setup done')
    runButtonEl.disabled = false;
  });

}

function printTestCases() {
  testCases.forEach(([, name]) => console.log('Ready test-case:', name))
}

function onClickRun() {
  runButtonEl.disabled = true;
  runTestCase(testCaseIndex)
}


function setupTestCase(i, done) {
  if (i >= testCases.length) {
    console.error('Bad test-case index:', i);
    window.alert('Query a valid test case please.');
    return;
  }
  console.log('Calling setup for test-case index:', i)
  testCases[i][0].setup(done);
}

function runTestCase(i) {
  if (i >= testCases.length) {
    console.error('Bad test-case index:', i);
    return;
  }
  console.log('Calling run for test-case index:', i)
  testCases[i][0].run();
}

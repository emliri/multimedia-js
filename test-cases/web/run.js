const rootEl = document.getElementById('root');
const runButtonEl = document.getElementById('runButton');
const runButtonLabelEl = document.getElementById('runButtonLabel');
const testCaseIndex = MMTestCasesWeb.mmjs.Common.Utils.parseOptionsFromQueryString().case || 0;

const testCases = [];

// fill up test-case array
{
  let i = 0;
  for (const caseName in MMTestCasesWeb) {
    if (caseName === 'mmjs') {
      continue;
    }
    const TestCase = MMTestCasesWeb[caseName];
    console.info(`Initializing test-case #${i++}:`, caseName);
    testCases.push([new TestCase(rootEl), caseName]);
  }
}

// print test-cases list, call async set-up function and install UI
{
  printTestCases();

  const caseName = testCases[testCaseIndex][1];

  runButtonLabelEl.innerHTML = caseName;

  setupTestCase(testCaseIndex, function () {
    console.log('Test-case setup done');
    runButtonEl.disabled = false;
  });
}

function printTestCases () {
  testCases.forEach(([, name]) => console.log('Ready test-case:', name));
}

function onClickRun () {
  runButtonEl.disabled = true;
  runTestCase(testCaseIndex);
}

function setupTestCase (i, done) {
  if (i >= testCases.length) {
    console.error('Bad test-case index:', i);
    window.alert('Query a valid test case please.');
    return;
  }
  console.log('Calling setup for test-case index:', i);
  testCases[i][0].setup(done);
}

function runTestCase (i) {
  if (i >= testCases.length) {
    console.error('Bad test-case index:', i);
    return;
  }
  console.log('Calling run for test-case index:', i);
  testCases[i][0].run();
}

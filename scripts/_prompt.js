'use strict';

/*
 * Asking for a password in a terminal without it ever being an argument.
 *
 * A password on the command line ("node script.js set 'secret'") lands in
 * the shell's history file and, while the command runs, in the process list
 * other users can read. These scripts ask for it instead, and hide what is
 * typed.
 *
 * When stdin is not a terminal (a test feeding answers through a pipe), the
 * answers are read from stdin one line at a time -- still never from argv.
 */

const readline = require('readline');

let pipedLines = null;
async function nextPipedLine() {
  if (pipedLines === null) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    pipedLines = Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
  }
  return pipedLines.length ? pipedLines.shift() : '';
}

function ask(question, opts) {
  const hidden = !!(opts && opts.hidden);
  if (!process.stdin.isTTY) {
    process.stderr.write(question + (hidden ? '[hidden]\n' : '\n'));
    return nextPipedLine();
  }
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    if (hidden) {
      // Show the question; show nothing of what is typed.
      rl._writeToOutput = (s) => {
        if (s.startsWith(question)) rl.output.write(question);
        else if (/[\r\n]/.test(s)) rl.output.write('\n');
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

module.exports = { ask };

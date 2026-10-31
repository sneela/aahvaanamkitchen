import { randomBytes, scryptSync } from 'node:crypto';

// Read passwords without terminal echo. Never accept a password as a command-line
// argument (shell history) or an environment variable (accidental logging).
function hiddenPrompt(prompt) {
  if (!process.stdin.isTTY || typeof process.stdin.setRawMode !== 'function') {
    throw new Error('Run this command in an interactive terminal to enter the administrator password privately');
  }
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const wasRaw = Boolean(input.isRaw);
    let value = '';
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(wasRaw);
      input.pause();
    };
    const onData = chunk => {
      for (const char of chunk.toString('utf8')) {
        if (char === '\r' || char === '\n') {
          cleanup();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003' || char === '\u0004') {
          cleanup();
          process.stdout.write('\n');
          reject(new Error('Password entry cancelled'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = value.slice(0, -1);
        } else if (char.codePointAt(0) >= 32) {
          value += char;
        }
      }
    };
    // Enable no-echo mode before displaying the prompt so fast paste/input
    // cannot race the terminal's echo setting.
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
    process.stdout.write(prompt);
  });
}

try {
  const password = await hiddenPrompt('Administrator password (hidden): ');
  if (password.length < 14) throw new Error('Use at least 14 characters');
  const confirmation = await hiddenPrompt('Confirm administrator password (hidden): ');
  if (password !== confirmation) throw new Error('Passwords do not match');
  const salt = randomBytes(32);
  console.log('ADMIN_PASSWORD_HASH=' + salt.toString('hex') + ':' + scryptSync(password, salt, 64).toString('hex'));
  console.log('SESSION_SECRET=' + randomBytes(48).toString('hex'));
  console.log('Save these only in your hosting environment. Never commit them.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Unable to generate credentials');
  process.exitCode = 1;
}

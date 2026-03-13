process.stdin.setEncoding('utf8');
process.stdout.write('READY\n');

let buffer = '';
process.stdin.on('data', (chunk) => {
  buffer += String(chunk || '');
  const lines = buffer.split(/\r?\n/);
  buffer = lines.pop() || '';
  for (const line of lines) {
    const text = line.trim();
    if (!text) continue;
    process.stdout.write(`ACK:${text}\n`);
  }
});

setInterval(() => {}, 60_000);

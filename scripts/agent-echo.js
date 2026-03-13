const command = process.argv.slice(2).join(' ').trim();
if (command) {
  console.log(`AGENT-ECHO:${command}`);
}

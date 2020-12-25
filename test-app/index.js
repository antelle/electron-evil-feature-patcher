console.log('Test app started');
setTimeout(() => process.exit(0), 5000);
process.stdin.on('data', () => process.exit(0));

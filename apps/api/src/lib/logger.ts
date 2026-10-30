export function createLogger() {
  return {
    info(message: string) {
      process.stdout.write(`${JSON.stringify({ level: 'info', message })}\n`);
    },
    warn(message: string) {
      process.stderr.write(`${JSON.stringify({ level: 'warn', message })}\n`);
    },
  };
}

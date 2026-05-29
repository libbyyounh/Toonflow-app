export function resolveListenPort(randomPort = false, env: NodeJS.ProcessEnv = process.env): number {
  if (randomPort) return 0;

  const rawPort = env.PORT;
  const parsedPort = rawPort ? Number.parseInt(rawPort, 10) : NaN;

  if (Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort <= 65535) {
    return parsedPort;
  }

  return 10588;
}

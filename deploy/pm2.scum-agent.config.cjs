module.exports = {
  apps: [
    {
      name: 'scum-console-agent',
      script: 'src/scum-console-agent.js',
      cwd: '.',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      restart_delay: 3000,
      env: {
        NODE_ENV: 'production',
        SCUM_CONSOLE_AGENT_HOST: '127.0.0.1',
        SCUM_CONSOLE_AGENT_PORT: '3213',
      },
    },
  ],
};

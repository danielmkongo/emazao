// pm2 process definition — `pm2 start ecosystem.config.cjs`
//
// Deliberately carries NO secrets: the app calls dotenv at startup and reads
// backend/.env itself, so the live domain and keys stay in that one file and
// this config is safe to commit. cwd must be backend/ so dotenv and the
// frontend/dist lookup in src/app.ts both resolve.
module.exports = {
  apps: [
    {
      name: 'emazao',
      script: 'dist/app.js',
      cwd: './backend',
      instances: 1,
      // Socket.IO holds long-lived connections and the app keeps live-session
      // state in memory, so clustering would split viewers across workers.
      exec_mode: 'fork',
      autorestart: true,
      max_restarts: 10,
      // Startup throws on a missing Atlas allowlist entry or absent .env. Without
      // a pause, pm2 burns through its restart budget in seconds and reports the
      // app as errored long before anyone reads the real message.
      restart_delay: 5000,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      merge_logs: true,
      time: true,
    },
  ],
}

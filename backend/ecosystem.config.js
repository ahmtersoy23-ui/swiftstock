module.exports = {
  apps: [{
    name: 'swiftstock-backend',
    script: 'dist/index.js',
    instances: 1,
    exec_mode: 'cluster',

    // Environment variables
    env: {
      NODE_ENV: 'production',
      PORT: 3006,
    },

    // Auto restart configuration
    autorestart: true,
    watch: false,
    max_memory_restart: '384M',  // Restart if memory exceeds 384MB

    // Logs
    error_file: '/var/log/swiftstock/error.log',
    out_file: '/var/log/swiftstock/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Advanced features
    min_uptime: '10s',          // Consider app crashed if uptime < 10s
    max_restarts: 10,           // Max 10 restarts in listen_timeout period
    listen_timeout: 3000,       // Wait 3s before considering app online
    kill_timeout: 5000,         // Wait 5s for graceful shutdown

    // Cluster mode settings (if instances > 1)
    instance_var: 'INSTANCE_ID',
  }]
}

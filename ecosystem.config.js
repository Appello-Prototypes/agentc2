/**
 * PM2 Ecosystem Configuration
 *
 * Production process management for Mastra AI Agent Framework on Digital Ocean
 *
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
    apps: [
        {
            name: "frontend",
            cwd: "./apps/frontend",
            script: "node_modules/.bin/next",
            args: "start",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3000
            },
            // Restart policy
            max_restarts: 10,
            min_uptime: "10s",
            restart_delay: 4000,
            // Logging
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "/var/log/pm2/frontend-error.log",
            out_file: "/var/log/pm2/frontend-out.log",
            merge_logs: true,
            // Memory management
            max_memory_restart: "1G"
        },
        {
            name: "agent",
            cwd: "./apps/agent",
            script: "node_modules/.bin/next",
            args: "start",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3001,
                // Enable reverse proxy mode for /agent basePath
                BEHIND_PROXY: "true",
                // Include uvx in PATH for Python-based MCP servers
                PATH: process.env.PATH + ":/root/.local/bin"
            },
            // Restart policy
            max_restarts: 10,
            min_uptime: "10s",
            restart_delay: 4000,
            // Logging
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "/var/log/pm2/agent-error.log",
            out_file: "/var/log/pm2/agent-out.log",
            merge_logs: true,
            // Memory management - agent needs more for MCP processes
            max_memory_restart: "2G"
        },
        {
            name: "admin",
            cwd: "./apps/admin",
            script: "node_modules/.bin/next",
            args: "start",
            instances: 1,
            exec_mode: "fork",
            env: {
                NODE_ENV: "production",
                PORT: 3003
            },
            // Restart policy
            max_restarts: 10,
            min_uptime: "10s",
            restart_delay: 4000,
            // Logging
            log_date_format: "YYYY-MM-DD HH:mm:ss Z",
            error_file: "/var/log/pm2/admin-error.log",
            out_file: "/var/log/pm2/admin-out.log",
            merge_logs: true,
            // Memory management
            max_memory_restart: "512M"
        }
    ],

    // Deployment configuration (optional - for pm2 deploy)
    deploy: {
        production: {
            user: "deploy",
            host: "your-droplet-ip",
            ref: "origin/main",
            repo: "git@github.com:your-org/mastra-experiment.git",
            path: "/var/www/mastra",
            "pre-deploy-local": "",
            "post-deploy":
                "bun install && bun run db:generate && bun run build && pm2 reload ecosystem.config.js --env production",
            "pre-setup": ""
        }
    }
};

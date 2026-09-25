
/**
 * TEAM PULSE — Main Express Server
 *
 * Startup sequence:
 *  1. Load environment variables
 *  2. Initialize PostgreSQL database
 *  3. Configure Express middleware
 *  4. Configure PostgreSQL session store
 *  5. Register all API routes
 *  6. Serve frontend static files
 *  7. Start cron jobs
 *  8. Listen on configured port
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cors = require('cors');
const path = require('path');
const http = require('http');

const {
  initDatabase,
  pool
} = require('./database/database');

const {
  startCronJobs
} = require('./services/cronService');

// Route modules
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const teamsRoutes = require('./routes/teams');
const tasksRoutes = require('./routes/tasks');
const doubtsRoutes = require('./routes/doubts');
const suggestionsRoutes = require('./routes/suggestions');
const activitiesRoutes = require('./routes/activities');
const reportsRoutes = require('./routes/reports');
const notificationsRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/admin');

// Migration route
const migrationRoutes = require('./routes/migration');

const app = express();

let PORT = parseInt(
  process.env.PORT || '5000',
  10
);

// ─────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────

app.set('trust proxy', 1);

app.use(cors({
  origin: true,
  credentials: true,
}));

app.use((req, res, next) => {
  res.set(
    'Cache-Control',
    'no-cache, no-store, must-revalidate'
  );

  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');

  next();
});

app.use(express.json({
  limit: '10mb',
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb',
}));

// ─────────────────────────────────────────────
// PostgreSQL Session Configuration
// ─────────────────────────────────────────────
//
// Sessions are now stored in Supabase PostgreSQL.
// SQLite sessions are no longer used.
//
// connect-pg-simple will automatically create the
// "session" table when createTableIfMissing is true.
// ─────────────────────────────────────────────

app.use(session({

  store: new pgSession({
    pool: pool,

    tableName: 'session',

    createTableIfMissing: true,
  }),

  secret:
    process.env.SESSION_SECRET ||
    'teampulse-secret-fallback',

  resave: false,

  saveUninitialized: false,

  cookie: {
    httpOnly: true,

    sameSite: 'lax',

    secure:
      process.env.NODE_ENV === 'production',

    maxAge: 8 * 60 * 60 * 1000,
  },

  name: 'teampulse.sid',
}));

// ─────────────────────────────────────────────
// API Routes
// ─────────────────────────────────────────────

app.use(
  '/api/auth',
  authRoutes
);

app.use(
  '/api/users',
  usersRoutes
);

app.use(
  '/api/teams',
  teamsRoutes
);

app.use(
  '/api/tasks',
  tasksRoutes
);

app.use(
  '/api/doubts',
  doubtsRoutes
);

app.use(
  '/api/suggestions',
  suggestionsRoutes
);

app.use(
  '/api/activities',
  activitiesRoutes
);

app.use(
  '/api/reports',
  reportsRoutes
);

app.use(
  '/api/notifications',
  notificationsRoutes
);

app.use(
  '/api/admin',
  adminRoutes
);

// ─────────────────────────────────────────────
// Migration API
// ─────────────────────────────────────────────

app.use(
  '/api/migration',
  migrationRoutes
);

// ─────────────────────────────────────────────
// Serve Frontend Static Files
// ─────────────────────────────────────────────

const FRONTEND_DIR = path.join(
  __dirname,
  '..',
  'frontend'
);

app.use(
  express.static(
    FRONTEND_DIR,
    {
      etag: false,

      lastModified: false,

      setHeaders: (res) => {

        res.set(
          'Cache-Control',
          'no-cache, no-store, must-revalidate'
        );

        res.set(
          'Pragma',
          'no-cache'
        );

        res.set(
          'Expires',
          '0'
        );
      },
    }
  )
);

// ─────────────────────────────────────────────
// SPA Fallback
// ─────────────────────────────────────────────

app.get(
  /^(?!\/api\/).*/,
  (req, res) => {

    res.set(
      'Cache-Control',
      'no-cache, no-store, must-revalidate'
    );

    res.set(
      'Pragma',
      'no-cache'
    );

    res.set(
      'Expires',
      '0'
    );

    const reqPath = req.path;

    // Root / index.html
    if (
      reqPath === '/' ||
      reqPath === '/index.html'
    ) {

      return res.sendFile(
        path.join(
          FRONTEND_DIR,
          'index.html'
        ),
        (err) => {

          if (err) {

            return res.sendFile(
              path.join(
                FRONTEND_DIR,
                'login.html'
              )
            );
          }
        }
      );
    }

    // HTML files
    if (
      reqPath.endsWith('.html')
    ) {

      const filePath = path.join(
        FRONTEND_DIR,
        reqPath
      );

      return res.sendFile(
        filePath,
        (err) => {

          if (err) {

            return res.sendFile(
              path.join(
                FRONTEND_DIR,
                'login.html'
              )
            );
          }
        }
      );
    }

    // SPA fallback
    return res.sendFile(
      path.join(
        FRONTEND_DIR,
        'login.html'
      )
    );
  }
);

// ─────────────────────────────────────────────
// Centralized Error Handler
// ─────────────────────────────────────────────

app.use(
  (err, req, res, _next) => {

    console.error(
      '[Server] Unhandled error:',
      err.message
    );

    const statusCode =
      err.status || 500;

    const message =
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong. Please try again.'
        : err.message;

    if (
      req.path.startsWith('/api/')
    ) {

      return res
        .status(statusCode)
        .json({
          success: false,
          message,
        });
    }

    return res
      .status(statusCode)
      .sendFile(
        path.join(
          FRONTEND_DIR,
          'error.html'
        )
      );
  }
);

// ─────────────────────────────────────────────
// Process Global Error Guards
// ─────────────────────────────────────────────

process.on(
  'uncaughtException',
  (err) => {

    console.error(
      '[Server] Safeguard caught uncaughtException:',
      err.stack || err.message
    );
  }
);

process.on(
  'unhandledRejection',
  (reason) => {

    console.error(
      '[Server] Safeguard caught unhandledRejection:',
      reason
    );
  }
);

// ─────────────────────────────────────────────
// Bootstrap & Server Start
// ─────────────────────────────────────────────

let activeHttpServer = null;

function startServer(
  portToUse,
  retries = 2
) {

  const server =
    http.createServer(app);

  server.on(
    'error',
    (err) => {

      if (
        err.code === 'EADDRINUSE'
      ) {

        if (retries > 0) {

          console.warn(
            '[Server] Port ' +
            portToUse +
            ' is busy. ' +
            'Retrying in 500ms (' +
            retries +
            ' attempts left)...'
          );

          setTimeout(
            () => {

              startServer(
                portToUse,
                retries - 1
              );

            },
            500
          );

        } else {

          const nextPort =
            portToUse + 1;

          console.warn(
            '[Server] Port ' +
            portToUse +
            ' is in use. ' +
            'Attempting fallback to port ' +
            nextPort +
            '...'
          );

          startServer(
            nextPort,
            0
          );
        }

      } else {

        console.error(
          '[Server] Fatal server error:',
          err.message
        );
      }
    }
  );

  server.listen(
    portToUse,
    '0.0.0.0',
    () => {

      activeHttpServer =
        server;

      console.log('');

      console.log(
        '╔═══════════════════════════════════════════════╗'
      );

      console.log(
        '║          TEAM PULSE — Node.js Server         ║'
      );

      console.log(
        '╠═══════════════════════════════════════════════╣'
      );

      console.log(
        '║  Server  : http://localhost:' +
        portToUse +
        '             ║'
      );

      console.log(
        '║  API     : http://localhost:' +
        portToUse +
        '/api         ║'
      );

      console.log(
        '║  Mode    : ' +
        (
          process.env.NODE_ENV ||
          'development'
        ).padEnd(35) +
        '║'
      );

      console.log(
        '║  Database: Supabase PostgreSQL              ║'
      );

      console.log(
        '║  Sessions: PostgreSQL                        ║'
      );

      console.log(
        '╚═══════════════════════════════════════════════╝'
      );

      console.log('');

      // Start scheduled cron jobs
      startCronJobs();
    }
  );
}

// ─────────────────────────────────────────────
// Graceful Shutdown
// ─────────────────────────────────────────────

function handleShutdown(
  signal
) {

  console.log(
    '\n[Server] Received ' +
    signal +
    '. Shutting down smoothly...'
  );

  if (activeHttpServer) {

    activeHttpServer.close(
      async () => {

        console.log(
          '[Server] HTTP connections closed.'
        );

        try {

          await pool.end();

          console.log(
            '[Server] PostgreSQL pool closed.'
          );

        } catch (err) {

          console.error(
            '[Server] Error closing PostgreSQL pool:',
            err.message
          );
        }

        process.exit(0);
      }
    );

    setTimeout(
      () => {
        process.exit(0);
      },
      1500
    ).unref();

  } else {

    process.exit(0);
  }
}

process.on(
  'SIGTERM',
  () => {
    handleShutdown('SIGTERM');
  }
);

process.on(
  'SIGINT',
  () => {
    handleShutdown('SIGINT');
  }
);

// ─────────────────────────────────────────────
// Application Bootstrap
// ─────────────────────────────────────────────

async function bootstrap() {

  try {

    console.log(
      '[Server] Initializing Team Pulse...'
    );

    // Initialize PostgreSQL database
    await initDatabase();

    console.log(
      '[Server] PostgreSQL database ready.'
    );

    // Start Express server
    startServer(PORT);

  } catch (err) {

    console.error(
      '[Server] Fatal startup error:',
      err.message
    );

    console.error(
      err.stack
    );

    process.exit(1);
  }
}

// Start application
bootstrap();


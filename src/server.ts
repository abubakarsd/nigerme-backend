import express from "express";
import http from "http";
import helmet from "helmet";
import cors from "cors";
import mongoSanitize from "express-mongo-sanitize";
import morgan from "morgan";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { env } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { typeDefs } from "./graphql/typeDefs.js";
import { resolvers } from "./graphql/resolvers.js";
import { buildGraphQLContext } from "./graphql/context.js";
import { globalLimiter } from "./interfaces/http/middlewares/rateLimiter.middleware.js";
import { errorHandler } from "./interfaces/http/middlewares/error.middleware.js";
import { PaymentController } from "./interfaces/http/controllers/payment.controller.js";
import apiRouter from "./interfaces/http/routes/index.js";

const app = express();
const httpServer = http.createServer(app);

// ─── Trust Proxy for Render / Cloudflare Reverse Proxies ───
app.set("trust proxy", 1);

// ─── 1. Security & Hardening Middlewares ───
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: env.NODE_ENV === "production" ? undefined : false, // Allows Apollo Sandbox in dev
  })
);

const allowedOrigins =
  env.CORS_ORIGIN === "*"
    ? true
    : env.CORS_ORIGIN.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-paystack-signature", "x-api-key", "Accept", "Origin"],
    optionsSuccessStatus: 204,
  })
);

// ─── 2. Enforce Allowed HTTP Methods (Deny Unknown Access) ───
app.use((req, res, next) => {
  const allowedMethods = ["GET", "POST", "HEAD", "OPTIONS"];
  if (!allowedMethods.includes(req.method.toUpperCase())) {
    res.setHeader("Allow", "GET, POST, OPTIONS");
    res.status(405).json({
      success: false,
      error: {
        message: `HTTP Method ${req.method} is not allowed on this API.`,
        allowedMethods: ["GET", "POST", "OPTIONS"],
      },
    });
    return;
  }
  next();
});

// ─── 3. Block Sensitive Path Probing ───
// Immediately return 403 for bots scanning for .env files, .git repos,
// config leaks etc. These are real automated attacks that hit every
// public server within minutes of deployment.
app.use((req, res, next) => {
  const blocked = /(\.(env|git|htaccess|htpasswd|config|yml|yaml|json|lock)|\/config\/|\/secrets?\/|\/\.well-known\/sensitive)/i;
  if (blocked.test(req.path)) {
    res.status(403).json({ error: "Access Denied: Forbidden Path." });
    return;
  }
  next();
});

// ─── 3. Rate Limiting ───
app.use("/graphql", globalLimiter);

// ─── 3. Body Parsing & Raw Body Capture (For Paystack Webhooks) ───
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── 4. NoSQL Injection Sanitization ───
app.use(
  mongoSanitize({
    replaceWith: "_",
  })
);

// ─── 5. HTTP Logging ───
if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

// ─── 6. Dedicated Paystack Webhook REST Route ───
// (Paystack server sends standard HTTP POST webhooks with HMAC headers)
app.post("/webhooks/paystack", PaymentController.handleWebhook);

// ─── Favicon Handler ───
app.get("/favicon.ico", (_req, res) => {
  res.status(204).end();
});

// ─── 7. Root Route — API Info ───
app.get("/", (_req, res) => {
  res.status(200).json({
    service: "Nigerme Enterprise GraphQL API",
    version: "1.0.0",
    status: "operational",
    endpoints: {
      graphql: "/graphql",
      health: "/health",
      webhook: "/webhooks/paystack",
    },
    docs: "Use /graphql for all API queries and mutations.",
    timestamp: new Date().toISOString(),
  });
});

// ─── 8. Health Check REST Endpoint ───
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    service: "nigerme-enterprise-graphql-backend",
    timestamp: new Date().toISOString(),
  });
});

// ─── 8. Initialize Apollo Server & Bootstrap ───
async function bootstrap() {
  try {
    console.log("🚀 Starting Nigerme Enterprise GraphQL Backend...");

    // Connect to MongoDB
    await connectDatabase();

    // Create Apollo GraphQL Server
    const apolloServer = new ApolloServer({
      typeDefs,
      resolvers,
      plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
      introspection: true, // Enables Schema explorer / playground
      formatError: (formattedError) => {
        const message = formattedError.message || "An unexpected error occurred.";
        let code = formattedError.extensions?.code || "INTERNAL_SERVER_ERROR";

        if (
          message.includes("Invalid email or password") ||
          message.includes("Unauthorized") ||
          message.includes("Incorrect verification code")
        ) {
          code = "UNAUTHENTICATED";
        } else if (
          message.includes("expired") ||
          message.includes("validity") ||
          message.includes("Too many failed attempts")
        ) {
          code = "OTP_EXPIRED";
        } else if (
          message.includes("already exists") ||
          message.includes("not found") ||
          message.includes("required")
        ) {
          code = "BAD_USER_INPUT";
        }

        return {
          message,
          locations: formattedError.locations,
          path: formattedError.path,
          extensions: {
            ...formattedError.extensions,
            code,
          },
        };
      },
    });

    await apolloServer.start();

    // ─── Mount Express REST API Routes ───
    app.use("/api", apiRouter);
    app.use("/api/v1", apiRouter);

    // Mount GraphQL Middleware on /graphql
    app.use(
      "/graphql",
      expressMiddleware(apolloServer, {
        context: async ({ req }) => buildGraphQLContext({ req: req as any }),
      }) as any
    );

    // ─── 9. Deny Unknown API Access (Catch-All 404) ───
    app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: {
          message: `Access Denied: Unknown resource ${req.method} ${req.path}`,
          docs: "Access /graphql for all queries and mutations.",
        },
      });
    });

    // ─── 10. Global Error Handler ───
    app.use(errorHandler);

    // Start HTTP Server
    httpServer.listen(env.PORT, () => {
      console.log(`✅ Backend server listening on http://localhost:${env.PORT}`);
      console.log(`🔮 GraphQL API & Studio Sandbox: http://localhost:${env.PORT}/graphql`);
      console.log(`💳 Paystack Webhook Listener: http://localhost:${env.PORT}/webhooks/paystack`);
      console.log(`🔒 Environment: ${env.NODE_ENV}`);
    });

    // Graceful Shutdown
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
      httpServer.close(async () => {
        await apolloServer.stop();
        await disconnectDatabase();
        console.log("👋 Process terminated cleanly.");
        process.exit(0);
      });
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  } catch (error) {
    console.error("❌ Fatal Bootstrap Error:", error);
    process.exit(1);
  }
}

bootstrap();

export default app;

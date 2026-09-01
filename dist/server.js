"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const morgan_1 = __importDefault(require("morgan"));
const server_1 = require("@apollo/server");
const express4_1 = require("@apollo/server/express4");
const drainHttpServer_1 = require("@apollo/server/plugin/drainHttpServer");
const env_js_1 = require("./config/env.js");
const database_js_1 = require("./config/database.js");
const typeDefs_js_1 = require("./graphql/typeDefs.js");
const resolvers_js_1 = require("./graphql/resolvers.js");
const context_js_1 = require("./graphql/context.js");
const rateLimiter_middleware_js_1 = require("./interfaces/http/middlewares/rateLimiter.middleware.js");
const error_middleware_js_1 = require("./interfaces/http/middlewares/error.middleware.js");
const payment_controller_js_1 = require("./interfaces/http/controllers/payment.controller.js");
const mail_controller_js_1 = require("./interfaces/http/controllers/mail.controller.js");
const index_js_1 = __importDefault(require("./interfaces/http/routes/index.js"));
const subscription_cron_service_js_1 = require("./services/billing/subscription-cron.service.js");
const app = (0, express_1.default)();
const httpServer = http_1.default.createServer(app);
// ─── Trust Proxy for Render / Cloudflare Reverse Proxies ───
app.set("trust proxy", 1);
// ─── 1. Security & Hardening Middlewares ───
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: env_js_1.env.NODE_ENV === "production" ? undefined : false, // Allows Apollo Sandbox in dev
}));
const corsOriginValidator = (origin, callback) => {
    if (!origin)
        return callback(null, true);
    if (env_js_1.env.CORS_ORIGIN === "*" ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1") ||
        origin.endsWith(".vercel.app") ||
        origin.includes("onrender.com") ||
        (env_js_1.env.CORS_ORIGIN && env_js_1.env.CORS_ORIGIN.split(",").map((o) => o.trim()).includes(origin))) {
        return callback(null, true);
    }
    return callback(null, true);
};
app.use((0, cors_1.default)({
    origin: corsOriginValidator,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
        "Content-Type",
        "Authorization",
        "x-paystack-signature",
        "x-api-key",
        "Accept",
        "Origin",
    ],
    optionsSuccessStatus: 204,
}));
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
app.use("/graphql", rateLimiter_middleware_js_1.globalLimiter);
// ─── 3. Body Parsing & Raw Body Capture (For Paystack Webhooks) ───
app.use(express_1.default.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
        req.rawBody = buf;
    },
}));
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// ─── 4. NoSQL Injection Sanitization ───
app.use((0, express_mongo_sanitize_1.default)({
    replaceWith: "_",
}));
// ─── 5. HTTP Logging ───
if (env_js_1.env.NODE_ENV !== "test") {
    app.use((0, morgan_1.default)(env_js_1.env.NODE_ENV === "production" ? "combined" : "dev"));
}
// ─── 6. Dedicated Webhook REST Routes ───
// (Paystack payments webhook & Resend inbound email webhook)
app.post("/webhooks/paystack", payment_controller_js_1.PaymentController.handleWebhook);
app.post("/webhooks/resend", mail_controller_js_1.MailWebhookController.handleResendWebhook);
app.post("/api/webhooks/resend", mail_controller_js_1.MailWebhookController.handleResendWebhook);
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
            webhook_paystack: "/webhooks/paystack",
            webhook_resend: "/webhooks/resend",
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
        await (0, database_js_1.connectDatabase)();
        // Create Apollo GraphQL Server
        const apolloServer = new server_1.ApolloServer({
            typeDefs: typeDefs_js_1.typeDefs,
            resolvers: resolvers_js_1.resolvers,
            plugins: [(0, drainHttpServer_1.ApolloServerPluginDrainHttpServer)({ httpServer })],
            introspection: true, // Enables Schema explorer / playground
            formatError: (formattedError) => {
                const message = formattedError.message || "An unexpected error occurred.";
                let code = formattedError.extensions?.code || "INTERNAL_SERVER_ERROR";
                if (message.includes("Invalid email or password") ||
                    message.includes("Unauthorized") ||
                    message.includes("Incorrect verification code")) {
                    code = "UNAUTHENTICATED";
                }
                else if (message.includes("expired") ||
                    message.includes("validity") ||
                    message.includes("Too many failed attempts")) {
                    code = "OTP_EXPIRED";
                }
                else if (message.includes("already exists") ||
                    message.includes("not found") ||
                    message.includes("required")) {
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
        app.use("/api", index_js_1.default);
        app.use("/api/v1", index_js_1.default);
        // Mount GraphQL Middleware on /graphql
        app.use("/graphql", (0, express4_1.expressMiddleware)(apolloServer, {
            context: async ({ req }) => (0, context_js_1.buildGraphQLContext)({ req: req }),
        }));
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
        app.use(error_middleware_js_1.errorHandler);
        // Start HTTP Server
        httpServer.listen(env_js_1.env.PORT, () => {
            console.log(`✅ Backend server listening on http://localhost:${env_js_1.env.PORT}`);
            console.log(`🔮 GraphQL API & Studio Sandbox: http://localhost:${env_js_1.env.PORT}/graphql`);
            console.log(`💳 Paystack Webhook Listener: http://localhost:${env_js_1.env.PORT}/webhooks/paystack`);
            console.log(`🔒 Environment: ${env_js_1.env.NODE_ENV}`);
            // Launch recurring subscription lifecycle & auto-debit worker
            subscription_cron_service_js_1.SubscriptionCronService.startScheduler();
        });
        // Graceful Shutdown
        const gracefulShutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
            httpServer.close(async () => {
                await apolloServer.stop();
                await (0, database_js_1.disconnectDatabase)();
                console.log("👋 Process terminated cleanly.");
                process.exit(0);
            });
        };
        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
    }
    catch (error) {
        console.error("❌ Fatal Bootstrap Error:", error);
        process.exit(1);
    }
}
bootstrap();
exports.default = app;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
const zod_1 = require("zod");
function validate(schema) {
    return async (req, res, next) => {
        try {
            req.body = await schema.parseAsync(req.body);
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                res.status(400).json({
                    success: false,
                    error: {
                        message: "Validation Error",
                        details: error.errors.map((e) => ({
                            field: e.path.join("."),
                            message: e.message,
                        })),
                    },
                });
                return;
            }
            next(error);
        }
    };
}

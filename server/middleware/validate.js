const { z } = require('zod');

const deliverySchema = z.object({
  clientEntryId: z.string().uuid("Invalid clientEntryId format"),
  over: z.number().int().min(0),
  ballInOver: z.number().int().min(1).max(10),
  bowler: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid bowler ID"),
  bowlerName: z.string(),
  batsman: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid batsman ID"),
  batsmanName: z.string(),
  runs: z.number().int().min(0).max(6),
  extraType: z.string().optional(),
  wicket: z.object({
    type: z.string(),
    fielder: z.string().optional()
  }).optional()
});

const validateDelivery = (req, res, next) => {
  try {
    req.body = deliverySchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation Error', errors: error.errors });
    }
    next(error);
  }
};

module.exports = {
  validateDelivery
};

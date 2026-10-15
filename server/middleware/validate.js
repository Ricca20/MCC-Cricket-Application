const mongoose = require('mongoose');
const { z } = require('zod');
const { EXTRA_TYPES, WICKET_TYPES } = require('../lib/cricketRules');

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');
const name = z.string().trim().min(1).max(80);
const optionalText = z.string().trim().max(80).optional();

// A person on a scorecard: always a name, plus the user ID for registered members
const playerRef = { id: objectId.nullish(), name };

const rosterPlayer = z.object({ name, userId: objectId.nullish() });

const schemas = {
  register: z.object({
    name,
    email: z.email().max(254),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    battingStyle: optionalText,
    bowlingStyle: optionalText
  }),

  login: z.object({
    email: z.email().max(254),
    password: z.string().min(1).max(128)
  }),

  updateProfile: z.object({
    name: name.optional(),
    nickname: z.string().trim().max(40).optional(),
    profilePhoto: z.url({ protocol: /^https$/ }).max(500).or(z.literal('')).optional(),
    battingStyle: optionalText,
    bowlingStyle: optionalText,
    jerseyNumber: z.union([z.coerce.number().int().min(1).max(999), z.literal('')]).optional()
  }),

  updateRole: z.object({
    role: z.enum(['admin', 'scorer', 'player']),
    action: z.enum(['grant', 'revoke']).default('grant')
  }),

  createTeam: z.object({
    name,
    isClubTeam: z.boolean().optional(),
    players: z.array(rosterPlayer).max(30).optional()
  }),

  createMatch: z.object({
    matchType: z.enum(['practice', 'friendly', 'tournament']),
    date: z.coerce.date(),
    venue: z.string().trim().max(120).optional(),
    oversLimit: z.number().int().min(1).max(50),
    teamA: objectId.optional(),
    teamB: objectId.optional(),
    fixtureId: objectId.optional(),
    scorerId: objectId.optional(),
    isPublic: z.boolean().optional()
  }).refine((m) => m.fixtureId || (m.teamA && m.teamB && m.teamA !== m.teamB), {
    message: 'Choose two different teams, or a fixture'
  }),

  startMatch: z.object({
    tossWinner: z.enum(['A', 'B']),
    decision: z.enum(['bat', 'bowl'])
  }),

  delivery: z.object({
    clientEntryId: z.uuid('Invalid clientEntryId format'),
    inningsNumber: z.union([z.literal(1), z.literal(2)]),
    batsman: z.object(playerRef),
    nonStriker: z.object(playerRef).optional(),
    bowler: z.object(playerRef),
    runs: z.number().int().min(0).max(7),
    extraType: z.enum(EXTRA_TYPES).nullish(),
    wicket: z.object({
      type: z.enum(WICKET_TYPES),
      playerOut: z.object(playerRef),
      fielder: z.object(playerRef).optional()
    }).nullish()
  }),

  updateDelivery: z.object({
    runs: z.number().int().min(0).max(7).optional(),
    extraType: z.enum(EXTRA_TYPES).nullable().optional(),
    wicket: z.object({
      type: z.enum(WICKET_TYPES),
      playerOut: z.object(playerRef),
      fielder: z.object(playerRef).optional()
    }).nullable().optional(),
    batsman: z.object(playerRef).optional(),
    bowler: z.object(playerRef).optional()
  }),

  completeMatch: z.object({
    result: z.string().trim().max(120).optional()
  }),

  createTournament: z.object({
    name,
    format: z.enum(['round-robin', 'knockout', 'groups-knockout']),
    startDate: z.coerce.date().optional()
  }),

  tournamentTeams: z.object({
    teamIds: z.array(objectId).max(64)
  }),

  generateDraw: z.object({
    groupCount: z.number().int().min(2).max(8).optional()
  }),

  sendNotification: z.object({
    userId: objectId.optional(),
    title: z.string().trim().min(1).max(80),
    body: z.string().trim().max(200).optional()
  })
};

const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.notify\.windows\.com$/, /^web\.push\.apple\.com$/, /\.push\.apple\.com$/];

schemas.pushSubscription = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000).refine((url) => {
    const host = new URL(url).hostname;
    return PUSH_HOSTS.some((pattern) => pattern.test(host));
  }, 'Unsupported push service'),
  expirationTime: z.number().nullish(),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) })
});

// Parses req.body against a named schema; unknown keys are stripped
const validate = (schemaName) => (req, res, next) => {
  const result = schemas[schemaName].safeParse(req.body ?? {});
  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message || 'Validation Error',
      errors: result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
    });
  }
  req.body = result.data;
  next();
};

// Rejects malformed :param IDs with 400 rather than letting Mongoose throw
const validateObjectId = (...params) => (req, res, next) => {
  for (const param of params) {
    if (!mongoose.isValidObjectId(req.params[param])) {
      return res.status(400).json({ message: `Invalid ${param}` });
    }
  }
  next();
};

module.exports = { validate, validateObjectId, schemas };

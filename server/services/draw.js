const mongoose = require('mongoose');
const { shuffle } = require('../lib/slug');

// Circle method: every team plays every other team once, in balanced rounds
const roundRobinPairs = (teams) => {
  const list = [...teams];
  if (list.length % 2) list.push(null); // null = bye this round
  const n = list.length;
  const pairs = [];
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const teamA = list[i];
      const teamB = list[n - 1 - i];
      if (teamA && teamB) pairs.push({ roundNumber: round + 1, teamA, teamB });
    }
    list.splice(1, 0, list.pop()); // rotate everyone except the first team
  }
  return pairs;
};

const roundRobinFixtures = (tournamentId, teams) =>
  roundRobinPairs(shuffle(teams)).map((p) => ({
    tournamentId,
    stage: 'league',
    round: `Round ${p.roundNumber}`,
    roundNumber: p.roundNumber,
    teamA: p.teamA,
    teamB: p.teamB
  }));

const knockoutRoundName = (teamsInRound) => {
  if (teamsInRound === 2) return 'Final';
  if (teamsInRound === 4) return 'Semi-final';
  if (teamsInRound === 8) return 'Quarter-final';
  return `Round of ${teamsInRound}`;
};

// Full bracket: byes pad the field to a power of 2, and every later round is
// created up front with empty slots that winners advance into.
const knockoutFixtures = (tournamentId, orderedTeams) => {
  const n = orderedTeams.length;
  const size = 2 ** Math.ceil(Math.log2(n));
  const roundCount = Math.log2(size);

  const rounds = [];
  for (let r = 0; r < roundCount; r++) {
    const count = size / 2 ** (r + 1);
    rounds.push(Array.from({ length: count }, () => ({
      _id: new mongoose.Types.ObjectId(),
      tournamentId,
      stage: 'knockout',
      round: knockoutRoundName(count * 2),
      roundNumber: r + 1,
      teamA: null,
      teamB: null,
      isBye: false,
      winner: null,
      nextFixture: null,
      nextSlot: null
    })));
  }
  for (let r = 0; r < roundCount - 1; r++) {
    rounds[r].forEach((fixture, i) => {
      fixture.nextFixture = rounds[r + 1][Math.floor(i / 2)]._id;
      fixture.nextSlot = i % 2 === 0 ? 'A' : 'B';
    });
  }

  // Spread the byes evenly through round 1 so bye teams don't all meet next
  const first = rounds[0];
  const byes = size - n;
  const byeSlots = new Set(Array.from({ length: byes }, (_, i) => Math.floor((i * first.length) / byes)));
  const queue = [...orderedTeams];
  first.forEach((fixture, i) => {
    fixture.teamA = queue.shift();
    if (byeSlots.has(i)) {
      fixture.isBye = true;
      fixture.winner = fixture.teamA;
    } else {
      fixture.teamB = queue.shift();
    }
  });

  // Advance bye winners straight into round 2
  const byId = new Map(rounds.flat().map((f) => [f._id.toString(), f]));
  for (const fixture of first) {
    if (fixture.isBye && fixture.nextFixture) {
      const next = byId.get(fixture.nextFixture.toString());
      next[fixture.nextSlot === 'A' ? 'teamA' : 'teamB'] = fixture.winner;
    }
  }

  return rounds.flat();
};

const GROUP_NAMES = 'ABCDEFGH';

// Snake-distributes shuffled teams into groups, then round-robin within each
const groupFixtures = (tournamentId, teams, groupCount) => {
  const groups = Array.from({ length: groupCount }, () => []);
  shuffle(teams).forEach((team, i) => {
    const lap = Math.floor(i / groupCount);
    const index = lap % 2 === 0 ? i % groupCount : groupCount - 1 - (i % groupCount);
    groups[index].push(team);
  });

  return groups.flatMap((groupTeams, g) =>
    roundRobinPairs(groupTeams).map((p) => ({
      tournamentId,
      stage: 'group',
      group: `Group ${GROUP_NAMES[g]}`,
      round: `Group ${GROUP_NAMES[g]}`,
      roundNumber: p.roundNumber,
      teamA: p.teamA,
      teamB: p.teamB
    }))
  );
};

// Group winners meet the next group's runner-up: [A1, B2, B1, C2, ...]
const crossSeedQualifiers = (groupTables) => {
  const ordered = [];
  groupTables.forEach((table, i) => {
    const next = groupTables[(i + 1) % groupTables.length];
    ordered.push(table[0].teamId, next[1].teamId);
  });
  return ordered;
};

module.exports = { roundRobinFixtures, knockoutFixtures, groupFixtures, crossSeedQualifiers };

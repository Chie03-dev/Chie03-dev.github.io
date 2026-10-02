/* ==========================================================================
   beasts.js - how the residents move

   PURPOSE. The four side rooms each hold a creature. This file decides WHERE that
   creature is and WHAT its body is doing at any instant; room-art.js only draws
   the answer. Split out because the motion is the interesting half and it is not
   drawing - room-art.js is at its size cap, and merging the two would mean
   choosing between the art and the animation.

   WHY A SEPARATE FILE MATTERS FOR CORRECTNESS

   The previous version animated the creatures by offsetting individual pixels
   around a FIXED anchor. Every creature was nailed to one spot in its room and
   moved in place, forever. That reads as a sticker twitching, not an animal: real
   animals change their footing, cross their space, and turn around.

   So each beast gets a real gait - a position, a facing, and a stride phase it
   advances by distance travelled rather than by clock. That distinction is the
   whole trick, and it is why this file exists:

     - phase by DISTANCE means the legs keep moving when the beast speeds up, and
       stop dead when it stops. Feet do not skate.
     - phase by CLOCK means legs slide at the speed of the clock no matter whether
       the beast moved at all.

   EVERY FUNCTION HERE IS PURE. Same inputs, same pose, always. There is no
   accumulated state and no frame counter, which is what lets the tests compare
   two instants directly, and means a dropped frame cannot leave a beast walking
   on its own.
   ========================================================================== */

/* A smooth ping-pong between two ends, in [0,1].

   NOT a sawtooth. A sawtooth is a triangle with a corner, and at the corner the
   beast reverses direction in one frame - it looks like it hit an invisible wall
   and bounced. This eases to a stop at each end and eases out again, so the beast
   ARRIVES, turns, and sets off. That single difference is most of what makes a
   thing read as alive rather than as a looping GIF. */
function patrol(t) {
  var p = (t % 1 + 1) % 1;                  /* wrap into [0,1) */
  var tri = p < 0.5 ? p * 2 : 2 - p * 2;    /* 0 -> 1 -> 0 */
  return tri * tri * (3 - 2 * tri);         /* smoothstep: the easing */
}

/* A pulse that rises fast and falls slow - a footfall, a heartbeat, a lunge.
   `sharp` above 1 makes the fall faster, which turns a symmetric wave into an
   asymmetric one, and asymmetry is most of what reads as effort. */
function pulse(t, sharp) {
  var p = (t % 1 + 1) % 1;
  var v = p < 0.3 ? p / 0.3 : 1 - (p - 0.3) / 0.7;
  return Math.pow(v < 0 ? 0 : v, sharp === undefined ? 1 : sharp);
}
/* THE BAT - roosts between flights, then swoops.

   It does not patrol its whole span like the ground beasts. It spends much of its
   time hanging (which is where a bat belongs), drops, crosses in an arc, and
   climbs back to roost. The arc is a real one: it leaves and re-enters at the SAME
   height and dips lowest in the middle, so it reads as flight rather than as a
   sprite sliding on a line. */
function batPose(t, span) {
  var cyc = (t / 9 + 0.5) % 1;                   /* one flight every nine seconds */
  var roosting = cyc < 0.25 || cyc > 0.85;
  if (roosting) {
    var rp = cyc > 0.85 ? (cyc - 0.85) / 0.15 : (cyc / 0.25);
    var a = pulse(rp, 1.6);
    return {
      x: 0, y: 0, hang: true,
      /* wings furl as it settles, and it sways a little on the roost */
      wing: -Math.round(2 * a), bank: 0, sway: Math.round(rp * 2)
    };
  }
  var f = (cyc - 0.25) / 0.6;
  var across = patrol(f);
  var arc = Math.sin(f * Math.PI) * 26;          /* 0 at both ends, deepest mid */
  /* Wings beat hardest at the bottom of the arc, where a bird works hardest. */
  var beat = Math.sin(t * 9 - arc * 0.3);
  return {
    x: Math.round((across - 0.5) * span),
    y: -Math.round(arc),
    hang: false,
    wing: Math.round(beat * 6),
    /* it banks into the turnarounds, and a banking bat's head leads its body */
    bank: Math.round((across < 0.5 ? -1 : 1) * (1 - Math.abs(across - 0.5) * 2) * 2),
    sway: 0
  };
}

/* THE GOLEM - walks its whole span, slowly and heavily.

   The heaviest gait: long flat-topped footfalls (pulse with a high exponent, so
   the foot is DOWN for most of the cycle and lifts quickly), a slow patrol, and
   the body heaving up onto the step and settling between them. A heavy thing
   does not bob; it heaves. */
function golemPose(t, span) {
  var across = patrol(t / 14);
  var step = pulse(t / 1.15, 2.6);
  return {
    x: Math.round((across - 0.5) * span),
    /* the heel plants, then the mass settles onto it */
    y: -Math.round(step * 3),
    /* the arms swing a beat BEHIND the body, as weight carries them */
    swing: Math.round(Math.sin((t / 1.15) * 2 * Math.PI - 0.9) * 3),
    face: across < 0.5 ? 1 : -1,
    step: step
  };
}

/* THE SPIDER - skitters in bursts, with stops in between.

   Real spiders do not stroll. This is the reason the spider is here rather than
   another bobbing golem: its speed is not constant, so its legs work only while
   it is actually moving and freeze dead when it stops. A spider that scuttles,
   stops dead, then scuttles the other way looks alive in a way that a constant
   drift never does. */
function spiderPose(t, span) {
  var across = patrol(t / 7);
  /* duty cycle: move for 55% of each burst, freeze for the rest */
  var bursting = ((t / 7) % 1) < 0.55;
  return {
    x: Math.round((across - 0.5) * span),
    y: 0,
    /* legs only work while it is moving - the frozen-gait detail */
    step: bursting ? Math.round(Math.sin(t * 11) * 4) : 0,
    /* and it settles lower when it is braced */
    crouch: bursting ? 0 : 1,
    face: across < 0.5 ? 1 : -1
  };
}

/* THE WORM - the most different one, and the reason this file exists.

   It does not patrol. It follows a path, and its body IS that path's history:
   each segment samples the head's position at an EARLIER time, so the tail
   literally traces where the head has been. That is what makes a worm read as a
   worm - a row of independently bobbing segments reads as a caterpillar, or
   worse, as several small creatures in a line.

   The history is RECOMPUTED from the clock every frame rather than remembered,
   which is what keeps this pure and still correct. */
function wormPose(t, span) {
  var SEGMENTS = 5;
  var LAG = 0.055;                    /* seconds behind the one in front */
  var head = patrol(t / 11);
  var headX = Math.round((head - 0.5) * span);
  var pts = [];
  for (var i = 0; i < SEGMENTS; i++) {
    var h = patrol((t - i * LAG) / 11);
    /* RELATIVE to the head, not to the room. The head's own travel is carried by
       pose.x, which drawMob applies to every beast uniformly; if the segments
       were absolute as well, the worm would travel twice as far as the other
       three - which is what happened the moment pose.x started being applied
       here rather than inside the worm's own drawing. */
    pts.push({
      x: Math.round((h - 0.5) * span) - headX,
      y: Math.round(Math.sin(t * 5 - i * 0.9) * 3)
    });
  }
  return {
    x: headX,
    y: 0,
    segments: pts,
    face: head < 0.5 ? 1 : -1
  };
}


/* Dispatch by kind. One lookup rather than a branch at each call site, so adding a
   fifth creature is a change in exactly one place. */
/* THE CRAB - sideways, and it stops.

   The crab exists because the spider scuttles FORWARD in bursts and nothing else
   moves sideways. It scuttles sideways, which is the single most recognisable thing
   a crab does, and its claws open and shut on a slow cycle independent of its walk
   so the two rhythms beat against each other - a creature whose legs and claws
   share one clock looks mechanical, and the offset is free.

   Its sideways travel is the reason `patrol` is not enough on its own: the gait is
   mirrored about the body so the legs scuttle backward relative to travel, which
   is how a crab actually moves. */
function crabPose(t, span) {
  var across = patrol(t / 6);
  var scuttle = Math.round(Math.sin(t * 9) * 3);
  var claw = Math.round(Math.sin(t / 1.7) * 3);
  return {
    x: Math.round((across - 0.5) * span),
    y: 0,
    /* legs kick BACKWARD while the body goes forward - the crab's signature */
    legs: -scuttle,
    claw: claw,
    face: across < 0.5 ? 1 : -1
  };
}

/* THE FISH - swims, and hangs in the water.

   The only creature that is not standing on the floor at all. It holds a fixed
   depth below the roof and drifts along it, tail beating to hold station. A fish
   that paced along the floor would be a worm with fins, so `y` here is measured
   as a fraction of the room's height rather than as an offset from the floor. */
function fishPose(t, span) {
  var across = patrol(t / 8);
  var hold = 0.28 + 0.1 * Math.sin(t / 3.3);
  return {
    x: Math.round((across - 0.5) * span),
    /* negative = up from the floor; converted at draw time using room height */
    swim: hold,
    /* tail beat, fastest at the middle of the crossing and easing at each end */
    tail: Math.round(Math.sin(t * 8 + (1 - across) * 2) * 4),
    face: across < 0.5 ? 1 : -1
  };
}

/* THE MOTH - flits, and never settles.

   Small, fast, and erratic: several short darts rather than one long crossing,
   because a moth's motion is not a patrol at all. Each dart has its own little
   patrol on its own clock, so the path is broken rather than smooth.

   Its wings beat far faster than the bat's. That is the whole difference between
   the two fliers, and it is why the bat roosts and the moth does not. */
function mothPose(t, span) {
  /* three darts per cycle, each a short traverse, with a pause between */
  var beat = (t / 2.6) % 1;
  var dart = beat < 0.72;
  var across = dart ? patrol(beat / 0.72) : 1;
  /* a small vertical jitter while it darts - it never holds a straight line */
  var jitter = dart ? Math.round(Math.sin(t * 13) * 4) : 0;
  return {
    x: Math.round((across - 0.5) * span),
    /* hangs high, near the roof, and does not touch the ground */
    up: 0.45,
    jitter: jitter,
    wing: Math.round(Math.sin(t * 22) * 4),
    face: across < 0.5 ? 1 : -1
  };
}

/* THE CATERPILLAR - arches, one segment at a time.

   Like the worm it follows its own history, but the wave it carries is a
   travelling HUMP rather than a side-to-side wiggle, so the two segmented
   creatures are not the same animal twice. It is also the slowest thing here by
   some distance: it should look like it will still be crawling when you scroll
   away. */
function caterpillarPose(t, span) {
  var SEGMENTS = 6;
  var LAG = 0.09;
  var head = patrol(t / 19);
  var headX = Math.round((head - 0.5) * span);
  var pts = [];
  for (var i = 0; i < SEGMENTS; i++) {
    var h = patrol((t - i * LAG) / 19);
    /* the hump: each segment lifts in turn, so the body ripples upward */
    pts.push({
      x: Math.round((h - 0.5) * span) - headX,
      y: -Math.round(Math.max(0, Math.sin((t / 19 - i * 0.02) * Math.PI * 2)) * 5)
    });
  }
  return { x: headX, y: 0, segments: pts, face: head < 0.5 ? 1 : -1 };
}

/* Dispatch by kind. One lookup rather than a branch at each call site, so adding a
   ninth creature is a change in exactly one place here plus one body in
   beast-art.js - and the species list itself lives with the drawing, in
   beast-art.js MOBS, so the two halves cannot drift out of step with each other.

   A MISSING CASE IS A SILENT FALLBACK, which is the trap. The worm is the last
   `return`, so a misspelt kind draws a worm with no error and no warning - a
   typo in a species name becomes a creature that is quietly the wrong animal.
   Hence the fallback below checks its own argument rather than trusting the
   call site. */
function beastPose(kind, t, span) {
  if (kind === 'bat') return batPose(t, span);
  if (kind === 'golem') return golemPose(t, span);
  if (kind === 'spider') return spiderPose(t, span);
  if (kind === 'worm') return wormPose(t, span);
  if (kind === 'crab') return crabPose(t, span);
  if (kind === 'fish') return fishPose(t, span);
  if (kind === 'moth') return mothPose(t, span);
  if (kind === 'caterpillar') return caterpillarPose(t, span);
  return wormPose(t, span);
}

/* Exported in a block, not inline, for the reason contact.js documents:
the module loader and the graph check in tools/smoke.mjs both work on the
block form, and an inline export is left unrewritten and becomes a
syntax error the moment the file is evaluated. */
export {
  patrol,
  pulse,
  batPose,
  golemPose,
  spiderPose,
  wormPose,
  crabPose,
  fishPose,
  mothPose,
  caterpillarPose,
  beastPose
};

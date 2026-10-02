/* ==========================================================================
   beast-art.js - what the residents look like
   ==========================================================================
   PURPOSE. Draws one creature, from a pose handed over by beasts.js. It knows
   nothing about time and nothing about rooms - it is handed a position and a
   gait and it paints them.

   THIS IS THE THIRD HALF OF A SPLIT THAT NOW HAS THREE FILES, and the split
   exists for capacity as much as for clarity:

       room-art.js   the ROOM - walls, floor, cave formations, and who lives where
       beasts.js     the MOTION - where each creature is, and what its legs do
       beast-art.js  the PIXELS - the creature itself

   Adding more species is what forced the third file. Both of the others were
   within a few lines of this repo's 500-line cap, and a new species costs lines
   in TWO places at once - a pose and a body - so it could not have gone in
   either alone. Splitting drawing out meant room-art.js fell to 204 lines and
   beasts.js had room for four more species.

   The split also keeps the two mistakes I have already made structurally harder
   to repeat: motion cannot be pinned to an anchor that lives in the drawing, and
   a species cannot be added as a pose with no body to show it.
   ========================================================================== */

import { beastPose } from './beasts.js';

/* === The mobs ==============================================================
   One resident per gallery, and they are all different on purpose: this is a
   showcase, so the point is that a reader scrolling past sees four caves and four
   things living in them rather than four caves and the same rubble.

     ore gallery  - BAT, hanging from the roof. Wings out, upside down.
     stone chamber- GOLEM, standing. Squat, heavy, two lit eyes.
     deep cave    - SPIDER, low and wide. Eight legs, small body.
     bedrock      - WORM, segmented, half-buried. The oldest layer.

   Drawn AS BLOCKS like everything else on this page, and each one is a handful of
   rectangles - not because that is all there is room for, but because this is
   pixel art and a smooth sprite would be the one thing on screen that is not.

   EYES ARE THE ONLY LIT THING IN ANY OF THEM. Every mob has them and they use the
   accent colour, so at a glance you can tell what is in the dark before you can
   make out its shape. That is most of what makes a small creature read as alive
   rather than as a prop.

   Placement is seeded from the room, so a given mob stands in the same place on
   every reload. A creature that hops around between frames is not a resident. */
/* THE SPECIES LIST, and it lives here rather than in room-art.js because this is
   the file that draws them. A species needs a pose AND a body; if the list were in
   the other file, a name could be listed with no body to show it, and the result
   would be a room containing whatever the draw function falls through to.

   ORDER IS THE SHOWCASE. A gallery's first resident is MOBS[index], so the four
   signature creatures are bat / golem / spider / worm - one per room, one each.
   Everything after that is filler, and it is listed so that no room can end up
   with the same filler twice. */
var MOBS = ['bat', 'golem', 'spider', 'worm', 'crab', 'fish', 'moth', 'caterpillar'];

/* Draws a beast. EVERYTHING about its motion - where it is, which way it faces,
   what its legs are doing - arrives in `pose` from beasts.js. This function only
   paints. The line between those two jobs is the whole reason beasts.js is its
   own file: the previous version had both in one place and the motion was
   therefore stuck to a fixed anchor, because the thing that decided WHERE the
   creature was had already decided that was its spot. */
function drawMob(ctx, kind, x, floorY, h, pose) {
  var eye = '#ffd24a';
  var dark = '#0d1116';

  /* THE TRAVEL. `x` arrives as the beast's HOME - the middle of its room - and the
     pose carries how far it has walked from there. Without this line the pose's
     x is computed, returned, tested and then thrown away, and every beast stands
     still at the centre of its room waving its limbs. That is exactly what
     happened: three of the four creatures ignored their own x, because the line
     existed only for the worm, whose segments happen to carry absolute
     positions. One missing addition, and two beasts looked broken while their
     gait code ran perfectly.

     Everything below draws relative to this, so a creature turns around in its
     room for free. */
  x += (pose.x || 0);

  function eyes(dx, y, gap, size) {
    ctx.fillStyle = eye;
    ctx.fillRect(Math.round(x + dx - gap), y, size, size);
    ctx.fillRect(Math.round(x + dx + gap - size), y, size, size);
  }

  if (kind === 'bat') {
    /* HANGS, AND FLAPS - or swoops. pose.wing is signed, so the same number both
       beats (in flight) and furls (on the roost). */
    var wing = pose.wing;
    var len = Math.round(h * 0.24);
    var y0 = floorY - len + (pose.y || 0);
    var bx = x + (pose.bank || 0);      /* a banking head leads the body */
    ctx.fillStyle = dark;
    ctx.fillRect(bx - 22, y0 + 4 - wing, 12, 4);
    ctx.fillRect(bx + 10, y0 + 4 - wing, 12, 4);
    ctx.fillRect(bx - 26, y0 + 8 + wing, 6, 3);
    ctx.fillRect(bx + 20, y0 + 8 + wing, 6, 3);
    ctx.fillRect(bx - 5, y0, 10, 12);
    ctx.fillRect(bx - 4, y0 - 7, 8, 8);
    eyes(bx - x, y0 - 5, 3, 2);
  } else if (kind === 'golem') {
    /* HEAVES. The body rides up on the footfall; the shoulders swing a beat behind
       it, which is the detail that stops a walk reading as a slide. */
    var lift = (pose.y || 0);
    var gh = Math.round(h * 0.34);
    var sw = pose.swing || 0;
    ctx.fillStyle = dark;
    ctx.fillRect(x - 17, floorY - gh + lift, 34, gh - lift);
    /* legs, offset by the arm swing so the weight visibly shifts */
    ctx.fillRect(x - 20 + sw, floorY - Math.round(gh * 0.34), 12, Math.round(gh * 0.34));
    ctx.fillRect(x + 8 - sw, floorY - Math.round(gh * 0.34), 12, Math.round(gh * 0.34));
    ctx.fillRect(x - 22, floorY - gh - 6 + lift, 44, 8);
    eyes(0, floorY - gh - 2 + lift, 7, 3);
  } else if (kind === 'spider') {
    /* SCUTTLES, WITH STOPS. pose.step is zero when it is braced, so the legs go
       still - which is the whole reason a spider reads as deciding to move. */
    var step = pose.step || 0;
    var sy = floorY - 14 + (pose.crouch ? 2 : 0);
    var sk = pose.crouch ? 0 : step;      /* the body only shifts while it walks */
    ctx.fillStyle = dark;
    for (var i = 0; i < 4; i++) {
      var lx = x - 16 + i * 10;
      var dy = 6 + (i % 2) * 4;
      ctx.fillRect(lx, sy - dy + step, 3, dy + 14 - step);
    }
    ctx.fillRect(x - 11 + sk, sy - 5, 22, 14);
    ctx.fillRect(x - 7 + sk, sy - 11, 14, 8);
    eyes(sk, sy - 9, 4, 2);
  } else if (kind === 'worm') {
    /* CRAWLS, AND FOLLOWS ITS OWN PATH. Each segment is placed at the head's
       position from a moment ago, so the body trails behind the head instead of
       being a row of blocks that bob together. */
    ctx.fillStyle = dark;
    var pts = pose.segments;
    for (var s = 0; s < pts.length; s++) {
      var sw2 = 16 - s * 2;
      var sh = 12 - s;
      ctx.fillRect(x + pts[s].x, floorY - sh + pts[s].y, sw2, sh);
    }
    var head = pts[0];
    eyes(head.x, floorY - 11 + head.y, 3, 2);
  } else if (kind === 'crab') {
    /* SIDEWAYS. The legs kick BACKWARD while the body travels forward, which is
       the whole of what makes a crab a crab rather than a four-legged beetle.
       Claws open on a slower cycle than the legs, so the two rhythms disagree -
       one clock for everything reads as machinery. */
    var leg = pose.legs || 0;
    var claw = pose.claw || 0;
    var cy = floorY - 10;
    ctx.fillStyle = dark;
    ctx.fillRect(x - 14 + leg, cy - 4, 28, 10);
    /* claws out front, opening and closing */
    ctx.fillRect(x + 12, cy - 8 - claw, 10, 4);
    ctx.fillRect(x + 12, cy - 2 + claw, 10, 4);
    ctx.fillRect(x - 20, cy - 2 - claw, 8, 4);
    /* legs, kicked back */
    ctx.fillRect(x - 12, cy + 6, 3, 6);
    ctx.fillRect(x - 5, cy + 6, 3, 6 + (leg % 2));
    ctx.fillRect(x + 2, cy + 6, 3, 6);
    ctx.fillRect(x + 9, cy + 6, 3, 6 - (leg % 2));
    eyes(0, cy - 2, 8, 2);
  } else if (kind === 'fish') {
    /* SWIMS. The only resident that does not touch the floor: pose.swim is a
       DEPTH FRACTION of the room's height, not a pixel offset, because the fish
       has to hold station at the same relative depth in rooms of different
       sizes. A fish paced along the floor would be a worm with fins. */
    var depth = floorY - Math.round((pose.swim === undefined ? 0.3 : pose.swim) * h);
    var tail = pose.tail || 0;
    ctx.fillStyle = dark;
    ctx.fillRect(x - 16, depth - 5, 26, 11);          /* body */
    ctx.fillRect(x + 10, depth - 4, 10, 9);           /* head */
    /* the tail beats, and beats further as it goes back */
    ctx.fillRect(x - 22, depth - 6 + tail, 8, 5);
    ctx.fillRect(x - 22, depth + 2 - tail, 8, 5);
    ctx.fillRect(x - 4, depth - 9, 3, 5);             /* dorsal fin */
    eyes(14, depth - 2, 0, 2);
  } else if (kind === 'moth') {
    /* FLITS, HIGH UP, and never settles. Beating far faster than the bat's - the
       bat's slow, heavy beat is what makes it a bat, so the two fliers must not
       share a rate or they read as the same animal in two colours. */
    var mw = pose.wing || 0;
    var my = floorY - Math.round((pose.up === undefined ? 0.45 : pose.up) * h)
             + (pose.jitter || 0);
    ctx.fillStyle = dark;
    ctx.fillRect(x - 20, my - 3 - mw, 12, 5);
    ctx.fillRect(x + 8, my - 3 - mw, 12, 5);
    ctx.fillRect(x - 2, my - 3, 4, 8);
    ctx.fillRect(x - 1, my - 9, 2, 6);                /* antennae */
    ctx.fillRect(x + 1, my - 9, 2, 6);
    eyes(0, my - 1, 3, 2);
  } else if (kind === 'caterpillar') {
    /* ARCHES. Same history-follows-the-head idea as the worm, but the wave it
       carries is a travelling HUMP - each segment lifts in turn - so the two
       segmented creatures are not one animal drawn twice. More segments and a
       longer lag than the worm's, which is what makes it read as fat and slow. */
    ctx.fillStyle = dark;
    var cpts = pose.segments;
    for (var c = 0; c < cpts.length; c++) {
      var cw = 13 - c;
      var ch = 11 - Math.floor(c / 2);
      ctx.fillRect(x + cpts[c].x, floorY - ch + cpts[c].y, cw, ch);
    }
    var chead = cpts[0];
    eyes(chead.x, floorY - 9 + chead.y, 4, 2);
  } else {
    /* NOTHING ELSE. This used to be the worm, as a bare `else`, which meant any
       species this function did not know about - a typo, a new pose with no body
       yet - quietly drew a worm. Now an unknown kind paints nothing at all, so it
       shows up as a missing creature that a test can see, rather than as a
       plausible-looking wrong animal that a test cannot. */
    ctx.fillStyle = dark;
  }
}

/* Draw one room. `b` is the wall box from rooms.js bounds(), `floorY` and
   `roofY` are its screen-space floor and roof, `layer` is its palette key and
   `side` is which wall the entrance is in (+1 right, -1 left, 0 none).

   Every x here is bounded by `b`, which is the room's own column - with the one
   deliberate exception of the entrance's passage, which is drawn OUTSIDE b on
   purpose, because a doorway that stops at the wall is a doorway to nowhere.
   That is the point at which the shaft is. */
  /* How many live in each gallery. More than one is the point now: a cave with a
   single animal in it reads as a diorama, and a cave with three reads as a cave
   somebody lives in. Kept low deliberately - they are the thing you notice last
   when you scroll past, and a crowded cave stops being a gallery and becomes
   wallpaper.

   DECLARED HERE, AT MODULE SCOPE, NOT NEXT TO drawResidents. It was declared
   inside drawRoom's body, below the line that reads it. `var` hoists, so the
   name existed and was `undefined` rather than a ReferenceError - and
   `for (i = 0; i < undefined; i++)` runs zero times. Every gallery rendered
   silently empty, with no error anywhere, and the suite reported it as "the
   resident is missing", which reads as the creatures failing to draw rather than
   as a loop that never ran. */
var PER_ROOM = 5;

/* THE POPULATION.

   Each beast gets its own TERRITORY - a slice of the room's width - and patrols
   only within it. Without that they all walk the full width and pass through each
   other, which on a still frame reads as two creatures occupying one pixel and is
   the single ugliest thing a room like this can do.

   Each territory also gets its own SLICE OF THE CLOCK, so neighbours are never
   in step: two golems planted 200px apart and sharing a clock look like one
   creature copied and pasted, which is precisely the failure the mob layer work
   was about. Offsetting time is free - the poses are pure, so a shifted clock is
   just a shifted number. */
/* THE DEPTH STACK.

   More creatures in a fixed width is a space problem, and the honest answers are
   to overlap them or to make some of them smaller. Overlapping is out - two
   animals in one pixel is the failure this whole arrangement exists to avoid.

   So the rooms now have DEPTH as well as width, which is what a cave has anyway.
   Each resident gets a lane, a depth and a scale, and a creature at the back is
   drawn SMALLER, HIGHER and DIMMER than one at the front - the same three cues
   the rock layers use, so the population sits in the room rather than on it.

   The scale is a canvas transform rather than 35 multiplied coordinates in drawMob
   and a second copy of every creature to keep in step with the first. It is
   wrapped in save/restore so it cannot leak into the next resident.

   `y` rises with distance because the floor is a line, not a point: something
   standing further back along the floor appears higher up. */
/* THE TERRITORY ONE CREATURE GETS, as a function of how many share the room.

   Exported so the travel check in the suite asks the layout module the same
   question the layout module answers, instead of hardcoding the arithmetic. That
   hardcoded copy is now on its third revision - 150px, then 100px, then wrong
   again when the population changed - and every revision failed in the same way:
   the suite reported creatures as broken when they were fine, and the real fault
   was a stale number in the test.

   So this is derived from the same inputs drawResidents uses. If the layout
   changes, the check follows it. */
function territoryFor(roomW, margin, gap, count) {
  var usable = Math.max(60, roomW - margin * 2);
  return Math.max(18, (usable - Math.min(34, usable / (count * 2)) * (count - 1)) / count);
}

function drawResidents(ctx, b, floorY, roofY, index, r, now, reduced) {
  var mh = floorY - roofY;
  var mt = reduced ? 0 : now / 1000;

  var roomW = b.right - b.left;
  /* The margin the old single-mob placement used, kept so a turning beast never
     paints over the rock at the walls. */
  var margin = 56;
  var gap = Math.min(34, Math.max(60, roomW - margin * 2) / (PER_ROOM * 2));
  var span = territoryFor(roomW, margin, gap, PER_ROOM);

  /* Back to front: the FARTHEST lane is drawn first, so a creature at the front
     overlaps the ones behind it rather than the other way round. Depth order is
     what makes a crowd read as a crowd instead of a sticker sheet. */
  for (var i = 0; i < PER_ROOM; i++) {
    /* depth 0 = furthest back, PER_ROOM-1 = nearest the reader */
    var depth = i / Math.max(1, PER_ROOM - 1);
    var scale = 0.55 + 0.45 * depth;
    /* it sits higher up the further back it is, but never above the roof */
    var lift = Math.round((1 - depth) * mh * 0.16);

    /* The FIRST resident of each room is the room's signature, so the
       "four caves, four different creatures" showcase still reads. The rest are
       drawn from the same list, offset so they do not all match their own room's
       head creature. */
    var kind = MOBS[(index + i) % MOBS.length];

    /* Territory i's left edge, and a small seeded offset inside it. The offset is
       what stops every resident standing dead-centre in its own lane. */
    var laneX = b.left + margin + i * (span + gap);
    var home = Math.round(laneX + r() * Math.max(1, span - 30));

    /* Each beast runs its own clock, at its own rate - a golem should not be
       keeping a spider's time. The factor is per-room AND per-lane, so no two
       creatures anywhere on the page are ever in step. */
    var laneT = mt / (1 + i * 0.37) + index * 3.1 + i * 2.7;

    ctx.save();
    /* scale about the creature's own feet, so a smaller one is a smaller one
       STANDING there rather than a smaller one sinking into the floor */
    ctx.translate(home, floorY - lift);
    ctx.scale(scale, scale);
    ctx.translate(-home, -(floorY - lift));
    /* further back is dimmer - the same depth cue the cave layers already use */
    ctx.globalAlpha = 0.55 + 0.45 * depth;
    drawMob(ctx, kind, home, floorY, mh, beastPose(kind, laneT, span));
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}


/* Exported in a block rather than inline, for the reason contact.js documents: the
   module loader and the graph check in tools/smoke.mjs both work on the block
   form, and an inline export is left unrewritten and becomes a syntax error the
   moment the file is evaluated. */
export { drawMob, drawResidents, MOBS, territoryFor };

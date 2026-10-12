const fs = require("fs");
const file = "src/components/ui/chains-overlay.tsx";
let s = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
function must(from, to) {
  if (s.indexOf(from) < 0) throw new Error("NOT FOUND:\n" + from.slice(0, 90));
  s = s.replace(from, to);
}

// 5a. Drop hang/belts resets in build()
must("      hang = [];\n      belts = [];\n", "");

// 5b. Replace the lock + hang + belts block with a centred padlock only.
must(
  [
    "      // The visible padlock hangs from the top bar of the cage, clear of the",
    "      // The face stays clear: an invisible hub at collar-bone height gathers the",
    "      // diagonal and cross chains into the X across the torso. The lock anchors",
    "      // atop it, below the chin, so the padlock reads as hanging at the",
    "      // collarbone rather than strapped over the nose.",
    "      const hub = pt(cx, cy + fh * 0.32, 0);",
    "      // The padlock hangs right below the top spike where the corner",
    "      // X-chains converge -never on the face.",
    "      const S = pt(cx, cy - fh * 0.52 - rest * 1.1, 0);",
    "      const B = pt(cx, cy - fh * 0.52 + rest * 1.1, 0);",
    "      lock = { S, B, hub, sw: rest * 1.3, bh: rest * 4.2, bw: rest * 2.8 };",
    "      join(S, B, rest * 2.2);",
    "      // Suspend the lock from the top edge so it hangs above the portrait",
    "      // instead of needing undefined anchor points.",
    "      hang.push(chainTo(framePts[1], S, 1.1));",
    "      hang.push(chainTo(framePts[0], S, 1.25));",
    "      hang.push(chainTo(framePts[2], S, 1.25));",
    "",
    "      // Corner diagonals converge on the low hub (an X across the torso,",
    "      // clear of the face).",
    "      const lowCorners = [framePts[6], framePts[4], framePts[7], framePts[3]];",
    "      for (const c of lowCorners) {",
    "        hang.push(chainTo(c, hub, 1.12));",
    "      }",
    "      // Horizontal cross: left-mid → hub → right-mid (low, across the torso).",
    "      hang.push(chainTo(framePts[7], hub, 1.05));",
    "      hang.push(chainTo(hub, framePts[3], 1.05));",
    "      // Bottom tether only: hub → bottom-mid. No top-mid → hub chain, so",
    "      // nothing drops down the middle of the face.",
    "      hang.push(chainTo(hub, framePts[5], 1.05));",
    "",
    "      // Cage wraps the portrait from several directions: two horizontal belts",
    "      // (upper & lower) and two vertical belts (left & right), each offset from",
    "      // centre so they band the image at different spots - the \"contained\" look.",
    "      // All are axis-aligned (phi 0 or PI/2) and mirrored about the centre, so",
    "      // their solver forces cancel instead of drifting the cage sideways (a 45deg",
    "      // belt did exactly that and was removed). Verified drift-free in simulation.",
    "      const oy = 0.95 * (fh / 2);",
    "      const ox = 0.95 * (fw / 2);",
    "      makeBelt(0, cx, cy, 0.95, 0, -oy); // upper horizontal",
    "      makeBelt(0, cx, cy, 0.95, 0, oy); // lower horizontal",
    "      makeBelt(Math.PI / 2, cx, cy, 0.95, -ox, 0); // left vertical",
    "      makeBelt(Math.PI / 2, cx, cy, 0.95, ox, 0); // right vertical",
  ].join("\n"),
  [
    "      // A single centred padlock. Its S/B points are im:0 (fixed by the",
    "      // solver) and re-pinned to the portrait's centre every step, so it",
    "      // stays centred and sways with the box instead of drooping over the",
    "      // face. It clasps the middle vertical bar -no extra hang chains.",
    "      const S = pt(cx, cy - rest * 3, 0);",
    "      const B = pt(cx, cy - rest * 3 + rest * 2.2, 0);",
    "      lock = { S, B, sw: rest * 1.3, bh: rest * 4.2, bw: rest * 2.8 };",
    "      join(S, B, rest * 2.2);",
  ].join("\n")
);

fs.writeFileSync(file, s.replace(/\n/g, "\r\n"), "utf8");
console.log("PART2 OK");

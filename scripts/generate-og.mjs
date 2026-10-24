import sharp from "sharp";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const PUBLIC = path.join(ROOT, "public");

const NAVY = "#000b1e";
const FG = "#eaf1ff";
const MUTED = "#9fb0d6";
const ACCENT = "#5b8cff";

async function og() {
  const W = 1200, H = 630;
  const portraitSize = 300;
  const portrait = await sharp(path.join(PUBLIC, "portrait.webp"))
    .resize(portraitSize, portraitSize, { fit: "cover" })
    .toBuffer();

  // circular mask
  const circleMask = Buffer.from(
    `<svg width="${portraitSize}" height="${portraitSize}"><circle cx="${portraitSize/2}" cy="${portraitSize/2}" r="${portraitSize/2}" fill="white"/></svg>`
  );
  const portraitCircle = await sharp(portrait)
    .composite([{ input: circleMask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const textSvg = `
  <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .name { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 78px; font-weight: 800; fill: ${FG}; letter-spacing: -2px; }
        .role { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 34px; font-weight: 500; fill: ${ACCENT}; letter-spacing: 6px; }
        .tag  { font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 22px; font-weight: 400; fill: ${MUTED}; }
      </style>
    </defs>
    <text x="90" y="250" class="role">SOFTWARE DEVELOPER</text>
    <text x="90" y="340" class="name">Alchie O. Andilab</text>
    <text x="90" y="400" class="tag">Android · Web · Desktop</text>
    <text x="90" y="560" class="tag">chie03-dev.github.io</text>
  </svg>`;

  const bg = sharp({
    create: { width: W, height: H, channels: 4, background: NAVY },
  });

  await bg
    .composite([
      { input: portraitCircle, top: Math.round((H - portraitSize) / 2), left: W - portraitSize - 120 },
      { input: Buffer.from(textSvg), top: 0, left: 0 },
    ])
    .png()
    .toFile(path.join(PUBLIC, "og.png"));

  console.log("wrote og.png");
}

async function apple() {
  const S = 180;
  const portrait = await sharp(path.join(PUBLIC, "portrait.webp"))
    .resize(S, S, { fit: "cover" })
    .toBuffer();
  const mask = Buffer.from(
    `<svg width="${S}" height="${S}"><circle cx="${S/2}" cy="${S/2}" r="${S/2}" fill="white"/></svg>`
  );
  const circle = await sharp(portrait).composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
  await sharp({ create: { width: S, height: S, channels: 4, background: NAVY } })
    .composite([{ input: circle, top: 0, left: 0 }])
    .png()
    .toFile(path.join(PUBLIC, "apple-touch-icon.png"));
  console.log("wrote apple-touch-icon.png");
}

await og();
await apple();

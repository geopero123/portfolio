// From the repository root: PW_CHANNEL= node scripts/capture-rebirth-clip.mjs
// Review frames 60, 180, 300, 420 and 540 before encoding or publishing.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';

const viewport = { width: 1280, height: 720 };
const fps = 60;
const frameCount = 600;
const stepMs = 1000 / fps;
const auditFrames = new Set([60, 180, 300, 420, 540]);

function installCaptureClock() {
  const realPerformanceNow = performance.now.bind(performance);
  const realDateNow = Date.now.bind(Date);
  const requestFrame = window.requestAnimationFrame.bind(window);
  const cancelFrame = window.cancelAnimationFrame.bind(window);
  const nativeFrames = new Map();
  const virtualFrames = new Map();
  let nextHandle = 0;
  let lastNativeTime;
  let virtualTime;
  let epochOffset;

  performance.now = () => virtualTime ?? realPerformanceNow();
  Date.now = () => virtualTime === undefined ? realDateNow() : Math.floor(epochOffset + virtualTime);

  window.requestAnimationFrame = callback => {
    const id = ++nextHandle;
    if (virtualTime === undefined) {
      const nativeId = requestFrame(timestamp => {
        nativeFrames.delete(id);
        lastNativeTime = timestamp;
        callback(timestamp);
      });
      nativeFrames.set(id, { nativeId, callback });
    } else {
      virtualFrames.set(id, callback);
    }
    return id;
  };

  window.cancelAnimationFrame = id => {
    const frame = nativeFrames.get(id);
    if (frame) {
      cancelFrame(frame.nativeId);
      nativeFrames.delete(id);
    }
    virtualFrames.delete(id);
  };

  window.__startCaptureClock = () => {
    // Keep the game's first fixed step continuous with its last real frame.
    virtualTime = lastNativeTime ?? realPerformanceNow();
    epochOffset = realDateNow() - virtualTime;
    for (const [id, frame] of nativeFrames) {
      cancelFrame(frame.nativeId);
      virtualFrames.set(id, frame.callback);
    }
    nativeFrames.clear();
  };

  window.__step = ms => {
    virtualTime += ms;
    // Frames requested while callbacks run belong to the next step.
    for (const id of [...virtualFrames.keys()]) {
      const callback = virtualFrames.get(id);
      virtualFrames.delete(id);
      callback?.(virtualTime);
    }
  };
}

async function stageBattle(page) {
  await page.goto('https://play.tempestarchive.com/?debug');
  await page.getByRole('button', { name: 'PLAY', exact: true }).click();
  await page.waitForFunction(() => window.__game?.dialogue.active);
  await page.mouse.move(640, 360);

  await page.evaluate(step => {
    // Stage a private run at the ruins using the live game's debug interface.
    // Fresh saves only have Predator. Unlock the two basic spells before filming.
    const game = window.__game;
    game.dialogue.end();
    game.input.releaseLock();
    game.input.mouseDX = game.input.mouseDY = 0;
    game.prog.acquireSkill('waterBlade', true);
    game.prog.acquireSkill('blackFlame', true);
    const warlord = game.enemies.find(enemy => enemy.kind === 'warlord');
    if (!warlord) throw new Error('The Goblin Warlord checkpoint is unavailable.');

    const start = warlord.pos.clone();
    start.z += 15.5;
    game.player.spawn(start);
    game.player.yaw = Math.PI;
    game.player.facing.set(0, 0, -1);
    game.gcam.yaw = 0;
    game.gcam.pitch = 0.3;
    game.gcam.distance = 7.3;
    game.gcam.smoothPivot.copy(game.player.pos).setY(game.player.pos.y + 1);
    game.checkSpawns();

    window.__startCaptureClock();
    // Let the Warlord walk to the grass so the camera can see both fighters.
    for (let frame = 0; frame < 300; frame++) {
      if (warlord.pos.distanceTo(game.player.pos) <= 5.5) return;
      window.__step(step);
    }
    throw new Error('The Warlord did not approach the checkpoint.');
  }, stepMs);
}

function combatInputs(page) {
  const press = key => () => page.keyboard.press(key);
  const down = key => () => page.keyboard.down(key);
  const up = key => () => page.keyboard.up(key);
  const hit = () => page.mouse.click(640, 360);

  return new Map([
    [1, [press('Tab'), down('w')]],
    [21, [up('w'), hit]],
    [36, [hit]],
    [51, [hit]],
    [83, [down('a')]],
    [92, [press('ShiftLeft')]],
    [109, [up('a')]],
    [158, [press('q')]],
    [192, [down('d')]],
    [220, [up('d')]],
    [229, [down('w')]],
    [248, [up('w'), hit]],
    [263, [hit]],
    [278, [hit]],
    [306, [press('e')]],
    [364, [down('a')]],
    [373, [press('ShiftLeft')]],
    [395, [up('a')]],
    [405, [press('q')]],
    [443, [down('w')]],
    [460, [up('w'), hit]],
    [475, [hit]],
    [490, [hit]],
    [533, [down('d')]],
    [537, [press('ShiftLeft')]],
    [551, [up('d'), down('s')]],
    [580, [press('e')]],
    [600, [up('s')]],
  ]);
}

const channel = process.env.PW_CHANNEL;
const browser = await chromium.launch({
  ...(channel ? { channel } : {}),
  args: ['--ignore-gpu-blocklist', '--enable-gpu'],
});

try {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.addInitScript(installCaptureClock);
  await stageBattle(page);

  const bounds = await page.locator('#game').boundingBox();
  if (!bounds || bounds.width !== viewport.width || bounds.height !== viewport.height) {
    throw new Error('The game canvas does not match the capture viewport.');
  }

  const cdp = await page.context().newCDPSession(page);
  const inputs = combatInputs(page);
  let previousHash;
  let repeats = 0;
  let maxCombo = 0;
  let dodged = false;
  let waterBlade = false;
  let blackFlame = false;
  await mkdir('frames', { recursive: true });

  for (let frame = 1; frame <= frameCount; frame++) {
    for (const input of inputs.get(frame) ?? []) await input();

    const state = await page.evaluate(step => {
      window.__step(step);
      const { state, dialogue, menus, player, prog, time } = window.__game;
      return {
        delta: time.rawDt,
        inWorld: state === 'playing' && !dialogue.active && menus.screen === 'none',
        target: player.target?.alive,
        combo: player.combo,
        dodging: player.state === 'dodge',
        waterBlade: prog.skills.get('waterBlade').cooldown > 0,
        blackFlame: prog.skills.get('blackFlame').cooldown > 0,
      };
    }, stepMs);

    if (Math.abs(state.delta - 1 / fps) > 0.00001) {
      throw new Error(`Frame ${frame} did not advance exactly one fixed step.`);
    }
    if (!state.inWorld || (auditFrames.has(frame) && !state.target)) {
      throw new Error(`Frame ${frame} left active combat.`);
    }

    maxCombo = Math.max(maxCombo, state.combo);
    dodged ||= state.dodging;
    waterBlade ||= state.waterBlade;
    blackFlame ||= state.blackFlame;

    const { data } = await cdp.send('Page.captureScreenshot', {
      clip: { ...bounds, scale: 1 },
      format: 'jpeg',
      quality: 90,
      optimizeForSpeed: true,
    });
    const image = Buffer.from(data, 'base64');
    const hash = createHash('sha256').update(image).digest('hex');
    if (hash === previousHash) repeats++;
    previousHash = hash;
    const name = String(frame).padStart(6, '0');
    await writeFile(`frames/${name}.jpg`, image);

    if (frame % 100 === 0) console.log(`Captured ${frame}/${frameCount} frames`);
  }

  const repeatRate = repeats / (frameCount - 1);
  console.log(`${repeats} of ${frameCount - 1} adjacent frames identical (${(repeatRate * 100).toFixed(2)}%).`);
  console.log(`Longest combo: ${maxCombo}. Dodge: ${dodged}. Water Blade: ${waterBlade}. Black Flame: ${blackFlame}.`);
  if (repeatRate >= 0.02 || maxCombo < 3 || !dodged || !waterBlade || !blackFlame) {
    throw new Error('The captured sequence failed its motion or combat checks.');
  }
} finally {
  await browser.close();
}

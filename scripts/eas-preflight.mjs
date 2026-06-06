#!/usr/bin/env node
// ── EAS iOS pre-flight guard ─────────────────────────────────────────────────
// Run this BEFORE every `eas build -p ios`. It fails (exit 1) if the iOS build
// image is floating — i.e. "image": "latest" or missing — because EAS rolls the
// "latest" alias to new Xcode versions without warning, and a newer Xcode's
// Clang breaks the fmt/folly compile on older Expo SDKs (the
// "fmt::basic_format_string is not a constant expression" failure that burns a
// build credit). Pin the image to the slug that matches your Expo SDK.
//
// Usage:  node scripts/eas-preflight.mjs [profile]      (default: production)
//         npm run eas:preflight
//
// Keep RECOMMENDED in sync with https://docs.expo.dev/build-reference/infrastructure/

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
const profile = process.argv[2] || 'production'

// Expo SDK major → known-good pinned macOS image (NOT "latest").
const RECOMMENDED = {
  '52': 'macos-sequoia-15.3-xcode-16.2',
  '53': 'macos-sequoia-15.5-xcode-16.4',
  '54': 'macos-sequoia-15.6-xcode-26.0',
  '55': 'macos-sequoia-15.6-xcode-26.2',
}

function die(msg) {
  console.error(`\n✖ EAS pre-flight FAILED\n${msg}\n`)
  process.exit(1)
}

let eas
try {
  eas = JSON.parse(readFileSync(join(mobileRoot, 'eas.json'), 'utf8'))
} catch (e) {
  die(`Could not read mobile/eas.json: ${e.message}`)
}

const sdkRange = (() => {
  try {
    const pkg = JSON.parse(readFileSync(join(mobileRoot, 'package.json'), 'utf8'))
    const m = String(pkg.dependencies?.expo ?? '').match(/(\d+)\./)
    return m ? m[1] : null
  } catch {
    return null
  }
})()

const prof = eas?.build?.[profile]
if (!prof) die(`No build profile "${profile}" in eas.json.`)

const image = prof.ios?.image
if (!image || image === 'latest') {
  const rec = sdkRange && RECOMMENDED[sdkRange] ? RECOMMENDED[sdkRange] : '<your-SDK\'s image slug>'
  die(
    `build.${profile}.ios.image is ${image ? `"${image}"` : 'unset'} — that's the floating "latest" alias.\n` +
    `EAS will pick whatever Xcode it last rolled to, which has broken SDK<=53 builds.\n` +
    `Pin it. For Expo SDK ${sdkRange ?? '?'} set:\n\n` +
    `    "build": { "${profile}": { "ios": { "image": "${rec}" } } }\n`,
  )
}

// Soft warning if the pin doesn't match this SDK's recommended image.
if (sdkRange && RECOMMENDED[sdkRange] && image !== RECOMMENDED[sdkRange]) {
  console.warn(
    `⚠ build.${profile}.ios.image is "${image}" but SDK ${sdkRange}'s recommended image is ` +
    `"${RECOMMENDED[sdkRange]}". Make sure this is intentional.`,
  )
}

console.log(`✓ EAS pre-flight OK — ${profile} iOS image pinned to "${image}" (Expo SDK ${sdkRange ?? '?'}).`)
console.log('  Next: npx expo export --platform ios   (free local bundle check) before eas build.')

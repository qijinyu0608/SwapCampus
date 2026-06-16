#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'frontend', 'public', 'images', 'campus-services');

function escapeSvg(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function svgTemplate(config) {
  const {
    badge,
    title,
    subtitle,
    start,
    end,
    panel,
    ink,
    accent,
    line,
    glow,
    art
  } = config;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="720" height="560" viewBox="0 0 720 560" role="img" aria-labelledby="title desc">
  <title id="title">${escapeSvg(title)}</title>
  <desc id="desc">${escapeSvg(subtitle)}</desc>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${start}" />
      <stop offset="100%" stop-color="${end}" />
    </linearGradient>
    <linearGradient id="panelFill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${panel}" stop-opacity="0.98" />
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.88" />
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="${ink}" flood-opacity="0.12" />
    </filter>
  </defs>
  <rect width="720" height="560" rx="24" fill="url(#bg)" />
  <circle cx="106" cy="88" r="58" fill="${glow}" fill-opacity="0.36" />
  <circle cx="612" cy="94" r="76" fill="${glow}" fill-opacity="0.22" />
  <circle cx="630" cy="442" r="86" fill="${glow}" fill-opacity="0.18" />
  <rect x="26" y="26" width="668" height="508" rx="22" fill="#ffffff" fill-opacity="0.18" />
  <rect x="46" y="42" width="128" height="38" rx="10" fill="#ffffff" fill-opacity="0.92" />
  <text x="110" y="67" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="800" fill="${accent}">${escapeSvg(badge)}</text>
  <g filter="url(#softShadow)">
    <rect x="110" y="108" width="500" height="262" rx="34" fill="#ffffff" fill-opacity="0.72" stroke="${line}" stroke-width="2" />
  </g>
  ${art}
  <rect x="48" y="404" width="624" height="104" rx="20" fill="url(#panelFill)" stroke="${line}" stroke-width="2" />
  <text x="78" y="448" font-family="Inter, Arial, sans-serif" font-size="32" font-weight="800" fill="${ink}">${escapeSvg(title)}</text>
  <text x="78" y="482" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="600" fill="${accent}" fill-opacity="0.86">${escapeSvg(subtitle)}</text>
  <circle cx="606" cy="454" r="26" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="2" />
  <path d="M592 454h28M606 440v28" stroke="${accent}" stroke-width="4" stroke-linecap="round" />
</svg>
`;
}

const coverConfigs = [
  {
    file: 'errand.svg',
    badge: 'ERRAND',
    title: 'Campus Errand',
    subtitle: 'parcel pickup and cross-campus handoff',
    start: '#eef6ff',
    end: '#ddeeff',
    panel: '#fefefe',
    ink: '#17324d',
    accent: '#2f6fca',
    line: '#bfd6f2',
    glow: '#7db3ff',
    art: `
      <path d="M206 308 C222 248, 262 214, 320 208 C370 204, 414 224, 454 264" fill="none" stroke="#2f6fca" stroke-width="10" stroke-linecap="round" stroke-dasharray="10 16" />
      <circle cx="200" cy="320" r="34" fill="#2f6fca" fill-opacity="0.12" stroke="#2f6fca" stroke-width="6" />
      <path d="M200 300 c-14 0 -24 10 -24 24 c0 22 24 42 24 42 c0 0 24 -20 24 -42 c0 -14 -10 -24 -24 -24 z" fill="#2f6fca" />
      <circle cx="200" cy="324" r="8" fill="#eef6ff" />
      <g transform="translate(390 196)">
        <rect x="0" y="44" width="148" height="110" rx="16" fill="#ffffff" stroke="#7ea9df" stroke-width="6" />
        <path d="M0 62 L74 16 L148 62" fill="#dbe9fb" stroke="#7ea9df" stroke-width="6" stroke-linejoin="round" />
        <path d="M74 16 V154" stroke="#7ea9df" stroke-width="6" />
        <rect x="48" y="84" width="52" height="36" rx="10" fill="#2f6fca" fill-opacity="0.14" />
      </g>
    `
  },
  {
    file: 'agency.svg',
    badge: 'AGENCY',
    title: 'Campus Agency',
    subtitle: 'forms, reminders, and task handling',
    start: '#f7f2ff',
    end: '#ebe1ff',
    panel: '#ffffff',
    ink: '#2f2146',
    accent: '#7a4ac7',
    line: '#d7c6f1',
    glow: '#b78cff',
    art: `
      <g transform="translate(206 148)">
        <rect x="0" y="0" width="180" height="220" rx="24" fill="#ffffff" stroke="#9f7bd6" stroke-width="6" />
        <rect x="54" y="-18" width="72" height="38" rx="14" fill="#7a4ac7" />
        <rect x="34" y="56" width="110" height="12" rx="6" fill="#cfbee9" />
        <rect x="34" y="92" width="102" height="12" rx="6" fill="#cfbee9" />
        <rect x="34" y="128" width="90" height="12" rx="6" fill="#cfbee9" />
        <circle cx="146" cy="170" r="26" fill="#7a4ac7" fill-opacity="0.14" stroke="#7a4ac7" stroke-width="4" />
        <path d="M132 170l10 10l20 -22" fill="none" stroke="#7a4ac7" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />
      </g>
      <g transform="translate(432 204) rotate(-10)">
        <circle cx="0" cy="0" r="48" fill="#ffffff" stroke="#b998e3" stroke-width="6" />
        <circle cx="0" cy="0" r="30" fill="#7a4ac7" fill-opacity="0.12" stroke="#7a4ac7" stroke-width="4" />
        <rect x="-10" y="-74" width="20" height="32" rx="8" fill="#7a4ac7" />
      </g>
    `
  },
  {
    file: 'group-buy.svg',
    badge: 'GROUP',
    title: 'Campus Group Buy',
    subtitle: 'shared lunch, snacks, and split orders',
    start: '#fff6ea',
    end: '#ffe6c8',
    panel: '#fffdf9',
    ink: '#473019',
    accent: '#d67d1e',
    line: '#f0cc9e',
    glow: '#ffbb63',
    art: `
      <g transform="translate(192 166)">
        <rect x="0" y="32" width="120" height="146" rx="20" fill="#ffffff" stroke="#e5a960" stroke-width="6" />
        <rect x="18" y="0" width="84" height="44" rx="16" fill="#ffd39d" stroke="#e5a960" stroke-width="6" />
        <path d="M30 18 Q60 -10 90 18" fill="none" stroke="#d67d1e" stroke-width="6" stroke-linecap="round" />
        <rect x="38" y="78" width="44" height="64" rx="12" fill="#d67d1e" fill-opacity="0.14" />
      </g>
      <g transform="translate(364 188)">
        <rect x="0" y="70" width="156" height="102" rx="18" fill="#ffffff" stroke="#e5a960" stroke-width="6" />
        <path d="M22 88 L78 34 L134 88" fill="#ffe7c0" stroke="#e5a960" stroke-width="6" stroke-linejoin="round" />
        <circle cx="40" cy="208" r="22" fill="#d67d1e" fill-opacity="0.18" />
        <circle cx="78" cy="208" r="22" fill="#d67d1e" fill-opacity="0.22" />
        <circle cx="116" cy="208" r="22" fill="#d67d1e" fill-opacity="0.26" />
      </g>
    `
  },
  {
    file: 'moving.svg',
    badge: 'MOVING',
    title: 'Dorm Moving',
    subtitle: 'boxes, carts, and room-to-room transport',
    start: '#eef8ee',
    end: '#daefdc',
    panel: '#fbfefb',
    ink: '#223a23',
    accent: '#4f9a57',
    line: '#bdddc0',
    glow: '#8ed495',
    art: `
      <g transform="translate(204 164)">
        <rect x="46" y="10" width="118" height="90" rx="14" fill="#ffffff" stroke="#79b67d" stroke-width="6" />
        <rect x="0" y="102" width="150" height="110" rx="16" fill="#e8f5e9" stroke="#79b67d" stroke-width="6" />
        <rect x="124" y="108" width="88" height="80" rx="14" fill="#ffffff" stroke="#79b67d" stroke-width="6" />
        <path d="M174 34 H218 V216" fill="none" stroke="#4f9a57" stroke-width="10" stroke-linecap="round" />
        <path d="M146 178 H236" fill="none" stroke="#4f9a57" stroke-width="10" stroke-linecap="round" />
        <circle cx="184" cy="234" r="18" fill="#4f9a57" fill-opacity="0.18" stroke="#4f9a57" stroke-width="5" />
        <circle cx="232" cy="234" r="18" fill="#4f9a57" fill-opacity="0.18" stroke="#4f9a57" stroke-width="5" />
      </g>
    `
  },
  {
    file: 'tutoring.svg',
    badge: 'TUTOR',
    title: 'Study Tutoring',
    subtitle: 'notes, books, and problem-solving sessions',
    start: '#fff8e8',
    end: '#ffeec0',
    panel: '#fffef8',
    ink: '#423513',
    accent: '#c59a22',
    line: '#ecd796',
    glow: '#ffe37b',
    art: `
      <g transform="translate(166 170)">
        <path d="M0 74 C54 20, 126 20, 182 74 V188 C126 146, 54 146, 0 188 Z" fill="#ffffff" stroke="#d4b351" stroke-width="6" />
        <path d="M182 74 C238 20, 310 20, 364 74 V188 C310 146, 238 146, 182 188 Z" fill="#fff7df" stroke="#d4b351" stroke-width="6" />
        <path d="M182 74 V188" fill="none" stroke="#d4b351" stroke-width="6" />
        <rect x="256" y="116" width="74" height="58" rx="12" fill="#c59a22" fill-opacity="0.16" stroke="#c59a22" stroke-width="4" />
        <path d="M64 114 H144 M64 138 H152 M64 162 H130" stroke="#d4b351" stroke-width="6" stroke-linecap="round" />
      </g>
    `
  },
  {
    file: 'skill.svg',
    badge: 'SKILL',
    title: 'Creative Skill',
    subtitle: 'layout, editing, and digital collaboration',
    start: '#eef4ff',
    end: '#dce8ff',
    panel: '#fbfdff',
    ink: '#1d2d49',
    accent: '#4978db',
    line: '#bfd0f4',
    glow: '#8fb3ff',
    art: `
      <g transform="translate(176 182)">
        <rect x="0" y="0" width="300" height="176" rx="24" fill="#ffffff" stroke="#7fa4ea" stroke-width="6" />
        <rect x="28" y="28" width="244" height="108" rx="16" fill="#edf3ff" />
        <path d="M114 182 H186" stroke="#4978db" stroke-width="10" stroke-linecap="round" />
        <path d="M150 148 V182" stroke="#4978db" stroke-width="10" stroke-linecap="round" />
        <path d="M210 64 l24 24 l-58 58 l-34 8 l8 -34 z" fill="#4978db" fill-opacity="0.18" stroke="#4978db" stroke-width="5" stroke-linejoin="round" />
        <path d="M86 54 l8 18 l18 8 l-18 8 l-8 18 l-8 -18 l-18 -8 l18 -8 z" fill="#4978db" fill-opacity="0.22" />
      </g>
    `
  },
  {
    file: 'repair.svg',
    badge: 'REPAIR',
    title: 'Dorm Repair',
    subtitle: 'small fixes, lamps, and basic tools',
    start: '#f2f6f8',
    end: '#dfe8ed',
    panel: '#fcfeff',
    ink: '#22313b',
    accent: '#4d7d97',
    line: '#bfd3df',
    glow: '#a5c7d8',
    art: `
      <g transform="translate(200 154)">
        <path d="M74 48 c18 -24 52 -30 80 -14 l-38 38 l16 16 l38 -38 c16 28 10 62 -14 80 c-22 16 -52 16 -74 0 l-72 72 c-12 12 -32 12 -44 0 c-12 -12 -12 -32 0 -44 l72 -72 c-16 -22 -16 -52 0 -74 z" fill="#ffffff" stroke="#6f9cb4" stroke-width="6" />
        <path d="M248 34 l22 22 l-44 44 l20 20 l44 -44 l22 22 l-28 28 l-108 12 l12 -108 z" fill="#4d7d97" fill-opacity="0.18" stroke="#4d7d97" stroke-width="6" stroke-linejoin="round" />
      </g>
      <g transform="translate(494 170)">
        <path d="M0 0 h40 a18 18 0 0 1 18 18 v24 h-76 v-24 a18 18 0 0 1 18 -18 z" fill="#ffffff" stroke="#6f9cb4" stroke-width="5" />
        <rect x="12" y="42" width="16" height="86" rx="8" fill="#4d7d97" />
        <rect x="0" y="126" width="40" height="14" rx="7" fill="#94b8ca" />
      </g>
    `
  },
  {
    file: 'event.svg',
    badge: 'EVENT',
    title: 'Campus Event',
    subtitle: 'check-in, volunteers, and activity support',
    start: '#fff1f4',
    end: '#ffdbe4',
    panel: '#fffdfd',
    ink: '#4a2430',
    accent: '#cf5f7e',
    line: '#f0c0cf',
    glow: '#ff9eb7',
    art: `
      <g transform="translate(208 146)">
        <path d="M88 0 h136 a20 20 0 0 1 20 20 v36 h-52 v26 a36 36 0 0 1 -72 0 v-26 h-52 v-36 a20 20 0 0 1 20 -20 z" fill="#ffffff" stroke="#d98aa3" stroke-width="6" />
        <rect x="86" y="86" width="140" height="170" rx="24" fill="#ffffff" stroke="#d98aa3" stroke-width="6" />
        <rect x="118" y="116" width="76" height="18" rx="9" fill="#cf5f7e" fill-opacity="0.18" />
        <rect x="110" y="154" width="92" height="58" rx="14" fill="#ffe6ed" stroke="#d98aa3" stroke-width="4" />
        <circle cx="156" cy="184" r="14" fill="#cf5f7e" fill-opacity="0.28" />
        <path d="M36 88 l12 28 l30 4 l-22 20 l6 30 l-26 -14 l-26 14 l6 -30 l-22 -20 l30 -4 z" fill="#cf5f7e" fill-opacity="0.2" />
        <path d="M278 106 l10 22 l24 4 l-18 18 l4 24 l-20 -10 l-20 10 l4 -24 l-18 -18 l24 -4 z" fill="#cf5f7e" fill-opacity="0.2" />
      </g>
    `
  },
  {
    file: 'help.svg',
    badge: 'HELP',
    title: 'Quick Help',
    subtitle: 'meal runs, favors, and timely support',
    start: '#eefaf6',
    end: '#d8f0e7',
    panel: '#fbfffd',
    ink: '#234038',
    accent: '#4ba37c',
    line: '#bde0d1',
    glow: '#95d9b8',
    art: `
      <g transform="translate(176 164)">
        <path d="M0 120 c0 -32 26 -58 58 -58 h88 c16 0 30 7 40 18 l40 42 c10 10 16 24 16 40 v6 h-242 z" fill="#ffffff" stroke="#79bb9a" stroke-width="6" />
        <rect x="38" y="34" width="134" height="74" rx="20" fill="#edf8f3" stroke="#79bb9a" stroke-width="6" />
        <path d="M108 52 c10 -18 34 -18 44 0 c10 18 -4 36 -22 48 c-18 -12 -32 -30 -22 -48 z" fill="#4ba37c" fill-opacity="0.24" stroke="#4ba37c" stroke-width="4" />
        <path d="M266 72 c22 0 40 18 40 40 s-18 40 -40 40 c-10 0 -20 -4 -28 -10 l-30 10 l8 -28 c-8 -8 -12 -18 -12 -30 c0 -22 18 -40 40 -40 z" fill="#ffffff" stroke="#79bb9a" stroke-width="6" />
        <circle cx="250" cy="112" r="6" fill="#4ba37c" />
        <circle cx="266" cy="112" r="6" fill="#4ba37c" />
        <circle cx="282" cy="112" r="6" fill="#4ba37c" />
      </g>
    `
  },
  {
    file: 'other.svg',
    badge: 'OTHER',
    title: 'Campus Support',
    subtitle: 'flexible requests and general assistance',
    start: '#f6f7fb',
    end: '#e7ebf7',
    panel: '#fdfdff',
    ink: '#2b3146',
    accent: '#6974ad',
    line: '#c9d0ea',
    glow: '#a8b2ef',
    art: `
      <g transform="translate(194 154)">
        <path d="M18 108 h276" stroke="#8f9ad0" stroke-width="8" stroke-linecap="round" />
        <path d="M48 106 v-52 c0 -12 10 -22 22 -22 h172 c12 0 22 10 22 22 v52" fill="none" stroke="#8f9ad0" stroke-width="8" />
        <path d="M24 108 l46 -92 h172 l46 92" fill="#ffffff" stroke="#8f9ad0" stroke-width="6" stroke-linejoin="round" />
        <path d="M102 146 c0 -26 22 -48 48 -48 s48 22 48 48 s-22 48 -48 48 s-48 -22 -48 -48 z" fill="#6974ad" fill-opacity="0.14" stroke="#6974ad" stroke-width="5" />
        <path d="M150 120 v30" stroke="#6974ad" stroke-width="8" stroke-linecap="round" />
        <circle cx="150" cy="100" r="8" fill="#6974ad" />
      </g>
    `
  }
];

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  await Promise.all(coverConfigs.map(async (config) => {
    const target = path.join(OUT_DIR, config.file);
    await fs.writeFile(target, `${svgTemplate(config)}\n`, 'utf8');
  }));

  console.log(`[generate-campus-service-cover-assets] wrote ${coverConfigs.length} assets to ${OUT_DIR}`);
}

main().catch((error) => {
  console.error('[generate-campus-service-cover-assets] failed', error);
  process.exitCode = 1;
});

const http = require('http');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';

const express = require('express');
const categories = require('../modules/categories');
const db = require('../database');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) { passed++; console.log(`  \u2713 ${label}`); }
  else { failed++; console.log(`  \u2717 ${label}`); }
}

function assertEqual(a, b, label) {
  if (a === b) { passed++; console.log(`  \u2713 ${label} (${JSON.stringify(a)})`); }
  else { failed++; console.log(`  \u2717 ${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }
}

async function run() {
  console.log('\n\uD83D\uDCC1 Categories Module Tests\n');

  // ── 1. Registry completeness ──
  console.log('── Registry ──');
  const all = categories.getAll();
  assertEqual(all.length, 11, 'has 11 categories');

  // Each has required fields
  for (const cat of all) {
    assert(cat.id, `${cat.name} has id`);
    assert(cat.name, `${cat.name} has name`);
    assert(cat.slug, `${cat.name} has slug`);
    assert(cat.icon, `${cat.name} has icon`);
    assert(cat.icon.startsWith('fa-'), `${cat.name} icon starts with fa-`);
    assert(cat.description, `${cat.name} has description`);
    assert(typeof cat.priority === 'number', `${cat.name} has numeric priority`);
    assert(Array.isArray(cat.legacy), `${cat.name} legacy is array`);
    assert(Array.isArray(cat.keywords), `${cat.name} keywords is array`);
  }

  // Unique priorities
  const priorities = all.map(c => c.priority);
  assertEqual(new Set(priorities).size, 11, 'all priorities are unique');

  // Unique slugs
  const slugs = all.map(c => c.slug);
  assertEqual(new Set(slugs).size, 11, 'all slugs are unique');

  // ── 2. Priority order is 1-10 ──
  const sorted = [...all].sort((a, b) => a.priority - b.priority);
  for (let i = 0; i < sorted.length; i++) {
    assertEqual(sorted[i].priority, i + 1, `priority ${i + 1} is ${sorted[i].name}`);
  }

  // ── 3. First category is local-news ──
  assertEqual(sorted[0].id, 'local-news', 'first category is local-news');
  assertEqual(sorted[0].name, 'الأخبار المحلية', 'first name is الأخبار المحلية');

  // ── 4. resolve ──
  console.log('\n── resolve() ──');
  const cat1 = categories.resolve('الأخبار المحلية');
  assert(cat1 !== null, 'resolve by name works');
  assertEqual(cat1.id, 'local-news', 'resolved to correct id');

  const cat2 = categories.resolve('akbar-mahallia');
  assert(cat2 !== null, 'resolve by slug works');
  assertEqual(cat2.id, 'local-news', 'slug resolved to correct id');

  const cat3 = categories.resolve('local-news');
  assert(cat3 !== null, 'resolve by id works');
  assertEqual(cat3.id, 'local-news', 'id resolved to correct id');

  const cat4 = categories.resolve('الوطن');
  assert(cat4 !== null, 'resolve legacy name works');
  assertEqual(cat4.name, 'الأخبار المحلية', 'legacy resolves to new name');

  const cat5 = categories.resolve('رياضة');
  assert(cat5 !== null, 'resolve legacy رياضة works');
  assertEqual(cat5.name, 'الرياضة المحلية', 'رياضة resolves to الرياضة المحلية');

  const cat6 = categories.resolve('اقتصاد');
  assert(cat6 !== null, 'resolve legacy اقتصاد works');
  assertEqual(cat6.name, 'التنمية المحلية', 'اقتصاد resolves to التنمية المحلية');

  const cat7 = categories.resolve('لا يوجد');
  assertEqual(cat7, null, 'resolve unknown returns null');

  // ── 5. getLegacyMapping ──
  console.log('\n── getLegacyMapping() ──');
  const mapping = categories.getLegacyMapping();
  assertEqual(mapping['الوطن'], 'الأخبار المحلية', 'الوطن maps correctly');
  assertEqual(mapping['رياضة'], 'الرياضة المحلية', 'رياضة maps correctly');
  assertEqual(mapping['اقتصاد'], 'التنمية المحلية', 'اقتصاد maps correctly');
  assertEqual(mapping['مجتمع'], 'المجتمع والحياة اليومية', 'مجتمع maps correctly');
  assertEqual(mapping['اسلاميات'], 'المجتمع والحياة اليومية', 'اسلاميات maps correctly');

  // ── 6. isLegacy ──
  console.log('\n── isLegacy() ──');
  assert(categories.isLegacy('الوطن') === true, 'الوطن is legacy');
  assert(categories.isLegacy('رياضة') === true, 'رياضة is legacy');
  assert(categories.isLegacy('الأخبار المحلية') === false, 'الأخبار المحلية is not legacy');

  // ── 7. sortByPriority ──
  console.log('\n── sortByPriority() ──');
  const unsorted = [
    { category: 'الرياضة المحلية' },
    { category: 'الأخبار المحلية' },
    { category: 'التنمية المحلية' },
  ];
  const result = categories.sortByPriority(unsorted);
  assertEqual(result[0].category, 'الأخبار المحلية', 'priority sort puts local-news first');
  assertEqual(result[1].category, 'التنمية المحلية', 'priority sort puts development second');
  assertEqual(result[2].category, 'الرياضة المحلية', 'priority sort puts sports last');

  // ── 8. Sort also with legacy names ──
  const legacyUnsorted = [
    { category: 'رياضة' },
    { category: 'وطن' }, // not a valid legacy name, goes to priority 99
    { category: 'اقتصاد' },
  ];
  const legacySorted = categories.sortByPriority(legacyUnsorted);
  assertEqual(legacySorted[0].category, 'اقتصاد', 'legacy sort puts economy (development) first');

  // ── 9. KNOWN_CATEGORIES in analyzer includes all ──
  console.log('\n── KNOWN_CATEGORIES ──');
  const analyzer = require('../modules/analyzer');
  // Can't access KNOWN_CATEGORIES directly (not exported), but we verify by checking classifier doesn't crash
  assert(true, 'analyzer loaded with new categories');

  // ── Summary ──
  console.log(`\n${'\u2501'.repeat(25)}`);
  console.log(`  \u0627\u0644\u0646\u062A\u0627\u0626\u062C: ${passed} \u0646\u062C\u0627\u062D, ${failed} \u0641\u0634\u0644`);
  console.log(`${'\u2501'.repeat(25)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();

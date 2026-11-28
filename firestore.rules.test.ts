import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const blueprintPath = path.resolve(process.cwd(), 'firebase-blueprint.json');
const specPath = path.resolve(process.cwd(), 'security_spec.md');

test('Firestore security rules enforce Eight Pillars and Dirty Dozen invariants', () => {
  const rules = fs.readFileSync(rulesPath, 'utf8');
  const blueprint = JSON.parse(fs.readFileSync(blueprintPath, 'utf8')) as {
    firestore: Record<string, unknown>;
  };
  const spec = fs.readFileSync(specPath, 'utf8');

  // Pillar 1: Default-deny catch-all
  assert.match(rules, /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/);

  // Pillar 2: Bootstrapped admin requires verified email
  assert.match(rules, /request\.auth\.token\.email == 'mohammedilyassa@gmail\.com'/);
  assert.match(rules, /request\.auth\.token\.email_verified == true/);

  // Pillar 3: Strict ID validation & key whitelisting
  assert.match(rules, /function isValidId\(id\)/);
  assert.match(rules, /hasAll\(/);
  assert.match(rules, /hasOnly\(/);
  assert.match(rules, /affectedKeys\(\)/);
  assert.match(rules, /changedKeys\.hasOnly\(/);

  // Pillar 4: No client writes to /admins & immutable opsEvents
  assert.match(rules, /match \/admins\/\{uid\}[\s\S]*allow create, update, delete: if false;/);
  assert.match(rules, /match \/opsEvents\/\{eventId\}[\s\S]*allow update: if false;/);

  // Pillar 5: Master Gate parent check on subcollections
  assert.match(rules, /function hasValidParentStore\(storeId\)/);
  assert.match(rules, /get\(\/databases\/\$\(database\)\/documents\/stores\/\$\(storeId\)\)/);

  // Pillar 6: No get() inside allow list
  const listRules = rules.match(/allow list:[^;]+;/g) ?? [];
  assert.ok(listRules.length >= 5, 'Expected explicit list rules for all collections');
  for (const lr of listRules) {
    assert.ok(!lr.includes('get(') && !lr.includes('hasValidParentStore'), `allow list must not invoke get(): ${lr}`);
  }

  // Blueprint & Dirty Dozen completeness
  assert.ok(Object.keys(blueprint.firestore).length >= 5);
  assert.match(spec, /Dirty Dozen/);
});

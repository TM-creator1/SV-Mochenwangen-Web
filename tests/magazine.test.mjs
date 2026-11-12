import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMagazine } from '../scripts/update-magazine.mjs';
test('magazine discovery follows renamed links and selects newest issue', () => {
  const html = `<a href="/fileadmin/user_upload/flado/SVM_Stadionheft_01.11.2026_klein.pdf">Old</a>
  <a href="https://other.example/fileadmin/user_upload/Stadionheft_30.11.2026.pdf">External</a>
  <a href="/fileadmin/user_upload/flado/SVM_Stadionheft_15.11.2026.pdf">New</a>
  <a href="/fileadmin/user_upload/Mietvertrag.pdf">Other</a>`;
  assert.equal(findMagazine(html), 'https://sv-mochenwangen.de/fileadmin/user_upload/flado/SVM_Stadionheft_15.11.2026.pdf');
  assert.throws(() => findMagazine('<a href="/other.pdf">Other</a>'), /Kein Stadionheft/);
});
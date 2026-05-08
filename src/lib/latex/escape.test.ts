import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { escapeLatex } from './escape';

describe('escapeLatex', () => {
  it('escapes backslash first', () => {
    assert.equal(escapeLatex('\\'), '\\textbackslash{}');
  });
  it('escapes ampersand', () => {
    assert.equal(escapeLatex('&'), '\\&');
  });
  it('escapes percent', () => {
    assert.equal(escapeLatex('%'), '\\%');
  });
  it('escapes dollar', () => {
    assert.equal(escapeLatex('$'), '\\$');
  });
  it('escapes hash', () => {
    assert.equal(escapeLatex('#'), '\\#');
  });
  it('escapes underscore', () => {
    assert.equal(escapeLatex('_'), '\\_');
  });
  it('escapes braces', () => {
    assert.equal(escapeLatex('{}'), '\\{\\}');
  });
  it('escapes tilde', () => {
    assert.equal(escapeLatex('~'), '\\textasciitilde{}');
  });
  it('escapes caret', () => {
    assert.equal(escapeLatex('^'), '\\textasciicircum{}');
  });
  it('handles combined string', () => {
    const result = escapeLatex('100% de cobertura & R$ 5_000');
    assert.equal(result, '100\\% de cobertura \\& R\\$ 5\\_000');
  });
});

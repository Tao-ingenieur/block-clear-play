import test from 'node:test';
import assert from 'node:assert/strict';
import {KINDS, SHAPES, calculateScore, cells, classifySpin, clearLines, collides, draw, emptyBoard, ghost,
  nextRandom, occupied, rotate} from '../packages/core/src/index.ts';
import type {Piece, RandomState, Rotation} from '../packages/core/src/index.ts';

test('7-bag: every bag has exactly seven kinds; reproducible over 1000 seeds', () => {
  for (let seed = 0; seed < 1000; seed++) {
    const a: RandomState = {value: seed, bag: []}, b: RandomState = {value: seed, bag: []};
    for (let bag = 0; bag < 10; bag++) {
      const kinds = Array.from({length: 7}, () => draw(a));
      assert.deepEqual([...kinds].sort(), [...KINDS].sort());
      assert.deepEqual(kinds, Array.from({length: 7}, () => draw(b)));
    }
  }
  assert.notEqual(nextRandom(1), nextRandom(2));
});
test('all shapes have four unique cells, four turns restore geometry', () => {
  const board = emptyBoard();
  for (const kind of KINDS) {
    let piece: Piece = {kind, rotation: 0, x: 3, y: 22};
    const start = cells(piece);
    for (let i = 0; i < 4; i++) {
      assert.equal(new Set(cells(piece).map(p => p.join(','))).size, 4);
      assert.equal(SHAPES[kind][i]!.length, 4);
      const next = rotate(board, piece, 1)!;
      assert.equal(next.kick, 0);
      assert.deepEqual(rotate(board, next.piece, -1)!.piece, piece);
      piece = next.piece;
    }
    assert.deepEqual(cells(piece), start);
  }
});
test('floor kicks: JLSTZ and I use different correct offsets', () => {
  const board = emptyBoard();
  assert.deepEqual(rotate(board, {kind: 'T', rotation: 0, x: 3, y: 38}, 1),
    {piece: {kind: 'T', rotation: 1, x: 2, y: 37}, kick: 2});
  assert.deepEqual(rotate(board, {kind: 'I', rotation: 0, x: 3, y: 38}, 1),
    {piece: {kind: 'I', rotation: 1, x: 4, y: 36}, kick: 4});
  assert.deepEqual(rotate(board, {kind: 'O', rotation: 0, x: 3, y: 38}, 1),
    {piece: {kind: 'O', rotation: 1, x: 3, y: 38}, kick: 0});
  assert.equal(rotate(board, {kind: 'T', rotation: 0, x: 3, y: 38}, 2), null);
});
test('wall kick direction, blocked rotations and 180 direct rotation', () => {
  const board = emptyBoard();
  assert.deepEqual(rotate(board, {kind: 'T', rotation: 1, x: -1, y: 22}, -1),
    {piece: {kind: 'T', rotation: 0, x: 0, y: 22}, kick: 1});
  assert.deepEqual(rotate(board, {kind: 'I', rotation: 1, x: -2, y: 22}, -1),
    {piece: {kind: 'I', rotation: 0, x: 0, y: 22}, kick: 1});
  assert.equal(rotate(Array.from({length: 40}, () => Array(10).fill('G')), {kind: 'T', rotation: 0, x: 3, y: 22}, -1), null);
  assert.equal(rotate(board, {kind: 'T', rotation: 0, x: 3, y: 22}, 2)!.piece.rotation, 2);
});
test('every orientation can rotate in both directions adjacent to legal edges', () => {
  const board = emptyBoard();
  for (const kind of KINDS) for (const rotation of [0,1,2,3] as Rotation[]) {
    for (const delta of [-1,1] as const) for (let x = -2; x < 10; x++) {
      const piece: Piece = {kind, rotation, x, y: 30};
      if (collides(board, piece)) continue;
      const result = rotate(board, piece, delta);
      assert.ok(result, `${kind}/${rotation}/${delta}/${x}`);
      assert.equal(collides(board, result.piece), false);
    }
  }
});
test('collision covers all boundaries and occupied cells; ghost is pure', () => {
  const board = emptyBoard();
  for (const [x,y] of [[-1,20],[10,20],[0,-1],[0,40]]) assert.equal(occupied(board,x!,y!), true);
  board[38]![4] = 'G';
  assert.equal(occupied(board,4,38), true);
  assert.equal(occupied(board,0,20), false);
  const piece: Piece = {kind: 'O', rotation: 0, x: 3, y: 20};
  assert.equal(ghost(board, piece).y, 36);
  assert.equal(piece.y, 20);
  assert.equal(collides(board, {...piece, y: 37}), true);
});
test('line clear handles 0 through 4 lines, compacting without row aliasing', () => {
  for (let count = 0; count <= 4; count++) {
    const board = emptyBoard();
    board[30]![0] = 'T';
    for (let i = 0; i < count; i++) board[39-i]!.fill('G');
    assert.equal(clearLines(board), count);
    assert.equal(board[30+count]![0], 'T');
    assert.equal(board.length, 40);
    assert.equal(new Set(board).size, 40);
  }
});
test('Spin front-corner classification for all four rotations, kick upgrade and exceptions', () => {
  const frontPairs = [[0,1],[1,2],[2,3],[3,0]];
  const corners = [[3,30],[5,30],[5,32],[3,32]];
  for (const rotation of [0,1,2,3] as Rotation[]) {
    const piece: Piece = {kind: 'T', rotation, x: 3, y: 30};
    for (let missing = 0; missing < 4; missing++) {
      const board = emptyBoard();
      corners.forEach(([x,y],i) => { if (i !== missing) board[y!]![x!] = 'G'; });
      const expected = frontPairs[rotation]!.includes(missing) ? 'mini' : 'full';
      assert.equal(classifySpin(board,piece,{kick: 0,extended: false}), expected);
      assert.equal(classifySpin(board,piece,{kick: 4,extended: false}), 'full');
      assert.equal(classifySpin(board,piece,null), 'none');
      assert.equal(classifySpin(board,piece,{kick: 0,extended: true}), 'none');
      assert.equal(classifySpin(board,{...piece,kind:'J'},{kick:0,extended:false}), 'none');
    }
    assert.equal(classifySpin(emptyBoard(),piece,{kick:0,extended:false}), 'none');
  }
});
test('base score, attack and level tables', () => {
  for (const [lines,base,attack] of [[0,0,0],[1,100,0],[2,300,1],[3,500,2],[4,800,4]]) {
    const score = calculateScore(lines!,'none',2,-1,false,false,7);
    assert.equal(score.base,base!*2);
    assert.equal(score.total,base!*2+7);
    assert.equal(score.attack,attack);
  }
  for (const [spin,table,attacks] of [['full',[400,800,1200,1600],[0,2,4,6]], ['mini',[100,200,400],[0,0,1]]] as const) {
    table.forEach((base,lines) => {
      const score = calculateScore(lines,spin,1,-1,false,false,0);
      assert.equal(score.base,base);
      assert.equal(score.attack,attacks[lines]);
    });
  }
});
test('combo, B2B preservation/breaking and additive perfect clear', () => {
  const score = calculateScore(4,'none',2,3,true,true,4);
  assert.equal(score.base,2400);
  assert.equal(score.comboScore,400);
  assert.equal(score.perfectScore,4000);
  assert.equal(score.total,6804);
  assert.equal(score.attack,17);
  assert.equal(calculateScore(0,'none',1,5,true,false,0).b2b,true);
  assert.equal(calculateScore(0,'none',1,5,true,false,0).combo,-1);
  assert.equal(calculateScore(1,'none',1,5,true,false,0).b2b,false);
  for (let combo = 0; combo < 15; combo++) assert.equal(calculateScore(1,'none',1,combo-1,false,false,0).attack,Math.min(4,Math.floor(combo/2)));
  for (const [lines,base] of [[1,800],[2,1200],[3,1800],[4,2000]]) assert.equal(calculateScore(lines!,'none',1,-1,false,true,0).perfectScore,base);
});
test('scoring rejects impossible clear counts and non-integer inputs', () => {
  for (const args of [[-1,'none',1,-1,false,false,0],[1.5,'none',1,-1,false,false,0],
    [5,'none',1,-1,false,false,0],[4,'full',1,-1,false,false,0],[3,'mini',1,-1,false,false,0],
    [1,'none',0,-1,false,false,0],[1,'none',41,-1,false,false,0],
    [1,'none',1,-2,false,false,0],[1,'none',1,-1,false,false,-1],
    [0,'none',1,-1,false,true,0]]) {
    assert.throws(()=>calculateScore(...args as Parameters<typeof calculateScore>));
  }
});

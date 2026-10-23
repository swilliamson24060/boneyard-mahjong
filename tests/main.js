import { run } from './run.js';
import './engine.test.js';
import './site.test.js';
import './score.test.js';
import './magnifier.test.js';
import './leaderboard.test.js';
import { drawBoard } from './preview.js';
import { Game } from '../js/engine/game.js';
import { TURTLE } from '../js/engine/layouts.js';

drawBoard(document.getElementById('board'), new Game(TURTLE, { seed: 1 }));
run(document.getElementById('results'), document.getElementById('summary'));
